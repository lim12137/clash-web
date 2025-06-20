import logging
import httpx
import requests
from typing import Optional
from fastapi import Header
from nexent.core import MessageObserver
from nexent.core.models import OpenAIModel, OpenAIVLModel
from nexent.core.models.embedding_model import JinaEmbedding, OpenAICompatibleEmbedding
from utils.auth_utils import get_current_user_id

from apps.voice_app import VoiceService
from consts.const import MODEL_ENGINE_APIKEY, MODEL_ENGINE_HOST
from consts.model import ModelConnectStatusEnum, ModelResponse
from database.model_management_db import get_model_by_display_name, update_model_record


async def _perform_connectivity_check(
    model_name: str,
    model_type: str,
    model_base_url: str,
    model_api_key: str,
    embedding_dim: int = 1024
) -> bool:
    """
    执行具体的模型连通性检查
    Args:
        model_name: 模型名称
        model_type: 模型类型
        model_base_url: 模型基础URL
        model_api_key: API密钥
        embedding_dim: 嵌入维度（仅用于嵌入模型）
    Returns:
        bool: 连通性检查结果
    """
    connectivity: bool
    
    # Test connectivity based on different model types
    if model_type == "embedding":
        connectivity = OpenAICompatibleEmbedding(
            model_name=model_name, 
            base_url=model_base_url, 
            api_key=model_api_key, 
            embedding_dim=embedding_dim
        ).check_connectivity()
    elif model_type == "multi_embedding":
        connectivity = JinaEmbedding(
            model_name=model_name, 
            base_url=model_base_url, 
            api_key=model_api_key, 
            embedding_dim=embedding_dim
        ).check_connectivity()
    elif model_type == "llm":
        observer = MessageObserver()
        connectivity = OpenAIModel(
            observer, 
            model_id=model_name, 
            api_base=model_base_url, 
            api_key=model_api_key
        ).check_connectivity()
    elif model_type == "rerank":
        connectivity = False
    elif model_type == "vlm":
        observer = MessageObserver()
        connectivity = OpenAIVLModel(
            observer, 
            model_id=model_name, 
            api_base=model_base_url, 
            api_key=model_api_key
        ).check_connectivity()
    elif model_type in ["tts", "stt"]:
        connectivity = await VoiceService().check_connectivity(model_type)
    else:
        raise ValueError(f"Unsupported model type: {model_type}")
    
    return connectivity


async def check_model_connectivity(display_name: str, authorization: Optional[str] = Header(None)):
    try:
        # 用 display_name 查库
        user_id, tenant_id = get_current_user_id(authorization)
        model = get_model_by_display_name(display_name, tenant_id=tenant_id)
        if not model:
            return ModelResponse(code=404, message=f"Model configuration not found for {display_name}",
                data={"connectivity": False, "connect_status": "未找到"})
            
        # 仍然用 repo/name 拼接用于模型实例化
        repo, name = model.get("model_repo", ""), model.get("model_name", "")
        model_name = f"{repo}/{name}" if repo else name
        log_str = f"Checking model connectivity: {model_name}; "
        if model.get("base_url"):
            log_str += f"base_url: {model.get('base_url')}; "
        if model.get("api_key"):
            log_str += f"api_key: {model.get('api_key')}; "
        logging.info(log_str)
        
        # Set model to "detecting" status
        update_data = {"connect_status": ModelConnectStatusEnum.DETECTING.value}
        update_model_record(model["model_id"], update_data)
        
        model_type = model["model_type"]
        model_base_url = model["base_url"]
        model_api_key = model["api_key"]
        
        try:
            # 使用公共的连通性检查函数
            connectivity = await _perform_connectivity_check(
                model_name, model_type, model_base_url, model_api_key
            )
        except ValueError as e:
            update_data = {"connect_status": ModelConnectStatusEnum.UNAVAILABLE.value}
            logging.error(str(e))
            update_model_record(model["model_id"], update_data)
            return ModelResponse(code=400, message=str(e),
                data={"connectivity": False, "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value})
        
        connect_status = ModelConnectStatusEnum.AVAILABLE.value if connectivity else ModelConnectStatusEnum.UNAVAILABLE.value
        update_data = {"connect_status": connect_status}
        update_model_record(model["model_id"], update_data)
        return ModelResponse(code=200, message=f"Model {display_name} connectivity {'successful' if connectivity else 'failed'}",
            data={"connectivity": connectivity, "connect_status": connect_status})
    except Exception as e:
        if 'model' in locals() and model:
            update_data = {"connect_status": ModelConnectStatusEnum.UNAVAILABLE.value}
            update_model_record(model["model_id"], update_data)
        return ModelResponse(code=500, message=f"Connectivity test error: {str(e)}",
            data={"connectivity": False, "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value})


async def check_me_model_connectivity(model_name: str):
    try:
        headers = {'Authorization': f'Bearer {MODEL_ENGINE_APIKEY}'}
        async with httpx.AsyncClient(verify=False) as client:
            # Get models list
            response = await client.get(f"{MODEL_ENGINE_HOST}/open/router/v1/models", headers=headers)
            response.raise_for_status()
            result = response.json()['data']

            # Find model
            model_data = next((item for item in result if item['id'] == model_name), None)
            if not model_data:
                return ModelResponse(code=404, message="Specified model not found",
                    data={"connectivity": False, "message": "Specified model not found", "connect_status": ""})

            model_type = model_data['type']

            # Test model based on type
            if model_type == 'llm':
                payload = {"model": model_name, "messages": [{"role": "user", "content": "hello"}]}
                api_response = await client.post(
                    f"{MODEL_ENGINE_HOST}/open/router/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
            elif model_type == 'embedding':
                payload = {"model": model_name, "input": "Hello"}
                api_response = await client.post(
                    f"{MODEL_ENGINE_HOST}/open/router/v1/embeddings",
                    headers=headers,
                    json=payload
                )
            else:
                return ModelResponse(code=400, message=f"Health check not supported for {model_type} type models",
                    data={"connectivity": False, "message": f"Health check not supported for {model_type} type models",
                          "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value})

            status_code = api_response.status_code
            response_text = api_response.text

            if status_code == 200:
                connect_status = ModelConnectStatusEnum.AVAILABLE.value
                return ModelResponse(code=200, message=f"Model {model_name} responded normally",
                    data={"connectivity": True, "message": f"Model {model_name} responded normally", "connect_status": connect_status})
            else:
                connect_status = ModelConnectStatusEnum.UNAVAILABLE.value
                return ModelResponse(code=status_code, message=f"Model {model_name} response failed",
                    data={"connectivity": False, "message": f"Model {model_name} response failed: {response_text}",
                          "connect_status": connect_status})

    except Exception as e:
        return ModelResponse(code=500, message=f"Unknown error occurred: {str(e)}",
            data={"connectivity": False, "message": f"Unknown error occurred: {str(e)}",
                  "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value})


async def verify_model_config_connectivity(model_config: dict):
    """
    验证模型配置的连通性，不保存到数据库
    Args:
        model_config: 模型配置字典，包含必要的连接参数
    Returns:
        ModelResponse: 包含连通性测试结果
    """
    try:
        model_name = model_config.get("model_name", "")
        model_type = model_config["model_type"]
        model_base_url = model_config["base_url"]
        model_api_key = model_config["api_key"]
        embedding_dim = model_config.get("embedding_dim", model_config.get("max_tokens", 1024))
        
        log_str = f"Verifying model config connectivity: {model_name}; "
        if model_base_url:
            log_str += f"base_url: {model_base_url}; "
        if model_api_key:
            log_str += f"api_key: {model_api_key}; "
        logging.info(log_str)
        
        try:
            # 使用公共的连通性检查函数
            connectivity = await _perform_connectivity_check(
                model_name, model_type, model_base_url, model_api_key, embedding_dim
            )
        except ValueError as e:
            logging.error(str(e))
            return ModelResponse(
                code=400, 
                message=str(e),
                data={
                    "connectivity": False, 
                    "message": str(e),
                    "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value
                }
            )
        
        connect_status = ModelConnectStatusEnum.AVAILABLE.value if connectivity else ModelConnectStatusEnum.UNAVAILABLE.value
        success_message = f"模型配置 {model_name} 连通性验证{'成功' if connectivity else '失败'}"
        
        return ModelResponse(
            code=200, 
            message=success_message,
            data={
                "connectivity": connectivity, 
                "message": success_message,
                "connect_status": connect_status
            }
        )
    except Exception as e:
        error_message = f"连通性测试出错: {str(e)}"
        logging.error(f"Verify model config connectivity error: {str(e)}")
        return ModelResponse(
            code=500, 
            message=error_message,
            data={
                "connectivity": False, 
                "message": error_message,
                "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value
            }
        )
