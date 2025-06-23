import json
import logging

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from typing import Optional

from consts.model import GlobalConfig
from utils.config_utils import config_manager, get_env_key, safe_value, safe_list, tenant_config_manager, get_model_name_from_config
from utils.auth_utils import get_current_user_id
from database.model_management_db import get_model_id_by_display_name
router = APIRouter(prefix="/config")

# Get logger instance
logger = logging.getLogger("app config")

def handle_model_config(tenant_id: str, user_id: str, config_key: str, model_id: int, tenant_config_dict: dict) -> None:
    """
    处理模型配置的更新、删除和设置操作
    
    Args:
        tenant_id: 租户ID
        user_id: 用户ID
        config_key: 配置键名
        model_id: 模型ID
        tenant_config_dict: 租户配置字典
    """
    if not model_id and config_key in tenant_config_dict:
        tenant_config_manager.delete_single_config(tenant_id, config_key)
    elif config_key in tenant_config_dict:
        try:
            existing_model_id = int(tenant_config_dict[config_key]) if tenant_config_dict[config_key] else None
            if existing_model_id == model_id:
                tenant_config_manager.update_single_config(tenant_id, config_key)
            else:
                tenant_config_manager.delete_single_config(tenant_id, config_key)
                if model_id:
                    tenant_config_manager.set_single_config(user_id, tenant_id, config_key, model_id)
        except (ValueError, TypeError):
            tenant_config_manager.delete_single_config(tenant_id, config_key)
            if model_id:
                tenant_config_manager.set_single_config(user_id, tenant_id, config_key, model_id)
    else:
        if model_id:
            tenant_config_manager.set_single_config(user_id, tenant_id, config_key, model_id)

@router.post("/save_config")
async def save_config(config: GlobalConfig, authorization: Optional[str] = Header(None)):
    try:
        user_id, tenant_id = get_current_user_id(authorization)
        config_dict = config.model_dump(exclude_none=False)
        env_config = {}

        print(f"config_dict: {config_dict}")

        tenant_config_dict = tenant_config_manager.load_config(tenant_id)
        print(f"Tenant {tenant_id} config: {tenant_config_dict}")

        # Process app configuration - use key names directly without prefix
        for key, value in config_dict.get("app", {}).items():
            env_key = get_env_key(key)
            env_config[env_key] = safe_value(value)
            
            # Check if the key exists and has the same value in tenant_config_dict
            if env_key in tenant_config_dict and tenant_config_dict[env_key] == safe_value(value):
                tenant_config_manager.update_single_config(tenant_id, env_key)
            elif env_key in tenant_config_dict and env_config[env_key] == '':
                tenant_config_manager.delete_single_config(tenant_id, env_key)
            elif env_key in tenant_config_dict:
                tenant_config_manager.delete_single_config(tenant_id, env_key)
                tenant_config_manager.set_single_config(user_id, tenant_id, env_key, safe_value(value))
            else:
                tenant_config_manager.set_single_config(user_id, tenant_id, env_key, safe_value(value))


        # Process model configuration
        for model_type, model_config in config_dict.get("models", {}).items():
            if not model_config:
                continue

            model_name = model_config.get("modelName")
            model_displayName = model_config.get("displayName")

            config_key = get_env_key(model_type) + "_ID"
            model_id = get_model_id_by_display_name(model_displayName, tenant_id)

            if not model_name:
                continue

            handle_model_config(tenant_id, user_id, config_key, model_id, tenant_config_dict)

            model_prefix = get_env_key(model_type)

            # Process basic model attributes
            for key, value in model_config.items():
                if key == "apiConfig":
                    # Process API configuration - use model name as prefix directly, without API_
                    api_config = value or {}
                    if api_config:
                        for api_key, api_value in api_config.items():
                            env_key = f"{model_prefix}_{get_env_key(api_key)}"
                            env_config[env_key] = safe_value(api_value)
                    else:
                        # Set default empty values
                        env_config[f"{model_prefix}_API_KEY"] = ""
                        env_config[f"{model_prefix}_MODEL_URL"] = ""
                else:
                    env_key = f"{model_prefix}_{get_env_key(key)}"
                    env_config[env_key] = safe_value(value)
            
            # Only store dimension for embedding or multiEmbedding models
            if model_type in ["embedding", "multiEmbedding"] and model_config.get("dimension") is not None:
                env_key = f"{model_prefix}_DIMENSION"
                env_config[env_key] = safe_value(model_config.get("dimension"))

        # Batch update environment variables
        for key, value in env_config.items():
            config_manager.set_config(key, value)

        logger.info("Configuration saved successfully")
        return JSONResponse(
            status_code=200,
            content={"message": "Configuration saved successfully", "status": "saved"}
        )
    except Exception as e:
        logger.error(f"Failed to save configuration: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"message": f"Failed to save configuration: {str(e)}", "status": "unsaved"}
        )


@router.get("/load_config")
async def load_config(authorization: Optional[str] = Header(None)):
    """
    Load configuration from environment variables
    
    Returns:
        JSONResponse: JSON object containing configuration content
    """
    try:
        # Build configuration object
        # TODO: Clean up the default values
        user_id, tenant_id = get_current_user_id(authorization)
        llm_model_name = tenant_config_manager.get_model_config("LLM_ID", tenant_id=tenant_id)
        llm_secondary_model_name = tenant_config_manager.get_model_config("LLM_SECONDARY_ID", tenant_id=tenant_id)
        embedding_model_name = tenant_config_manager.get_model_config("EMBEDDING_ID", tenant_id=tenant_id)
        multi_embedding_model_name = tenant_config_manager.get_model_config("MULTI_EMBEDDING_ID", tenant_id=tenant_id)
        rerank_model_name = tenant_config_manager.get_model_config("RERANK_ID", tenant_id=tenant_id)
        vlm_model_name = tenant_config_manager.get_model_config("VLM_ID", tenant_id=tenant_id)
        stt_model_name = tenant_config_manager.get_model_config("STT_ID", tenant_id=tenant_id)
        tts_model_name = tenant_config_manager.get_model_config("TTS_ID", tenant_id=tenant_id)

        config = {
            "app": {
                "name": tenant_config_manager.get_app_config("APP_NAME", tenant_id=tenant_id) or "Nexent 智能体",
                "description": tenant_config_manager.get_app_config("APP_DESCRIPTION", tenant_id=tenant_id) or "Nexent 是一个开源智能体SDK和平台，能够将单一提示词转化为完整的多模态服务 —— 无需编排，无需复杂拖拉拽。基于 MCP 工具生态系统构建，Nexent 提供灵活的模型集成、可扩展的数据处理和强大的知识库管理。我们的目标很简单：将数据、模型和工具整合到一个智能中心中，让任何人都能轻松地将 Nexent 集成到项目中，使日常工作流程更智能、更互联。",
                "icon": {
                    "type": tenant_config_manager.get_app_config("ICON_TYPE", tenant_id=tenant_id) or "preset",
                    "avatarUri": tenant_config_manager.get_app_config("AVATAR_URI", tenant_id=tenant_id) or "",
                    "customUrl": tenant_config_manager.get_app_config("CUSTOM_ICON_URL", tenant_id=tenant_id) or ""
                }
            },
            "models": {
                "llm": {
                    "name": get_model_name_from_config(llm_model_name) if llm_model_name else "",
                    "displayName": llm_model_name.get("display_name", ""),
                    "apiConfig": {
                        "apiKey": llm_model_name.get("api_key", ""),
                        "modelUrl": llm_model_name.get("base_url", "")
                    }
                },
                "llmSecondary": {
                    "name": get_model_name_from_config(llm_secondary_model_name) if llm_secondary_model_name else "",
                    "displayName": llm_secondary_model_name.get("display_name", ""),
                    "apiConfig": {
                        "apiKey": llm_secondary_model_name.get("api_key", ""),
                        "modelUrl": llm_secondary_model_name.get("base_url", "")
                    }
                },
                "embedding": {
                    "name": get_model_name_from_config(embedding_model_name) if embedding_model_name else "",
                    "displayName": embedding_model_name.get("display_name", ""),
                    "apiConfig": {
                        "apiKey": embedding_model_name.get("api_key", ""),
                        "modelUrl": embedding_model_name.get("base_url", "")
                    },
                    "dimension": int(config_manager.get_config("EMBEDDING_DIMENSION", "0")) or None
                },
                "multiEmbedding": {
                    "name": get_model_name_from_config(multi_embedding_model_name) if multi_embedding_model_name else "",
                    "displayName": multi_embedding_model_name.get("display_name", ""),
                    "apiConfig": {
                        "apiKey": multi_embedding_model_name.get("api_key", ""),
                        "modelUrl": multi_embedding_model_name.get("base_url", "")
                    },
                    "dimension": int(config_manager.get_config("MULTI_EMBEDDING_DIMENSION", "0")) or None
                },
                "rerank": {
                    "name": get_model_name_from_config(rerank_model_name) if rerank_model_name else "",
                    "displayName": rerank_model_name.get("display_name", ""),
                    "apiConfig": {
                        "apiKey": rerank_model_name.get("api_key", ""),
                        "modelUrl": rerank_model_name.get("base_url", "")
                    }
                },
                "vlm": {
                    "name": get_model_name_from_config(vlm_model_name) if vlm_model_name else "",
                    "displayName": vlm_model_name.get("display_name", ""),
                    "apiConfig": {
                        "apiKey": vlm_model_name.get("api_key", ""),
                        "modelUrl": vlm_model_name.get("base_url", "")
                    }
                },
                "stt": {
                    "name": get_model_name_from_config(stt_model_name) if stt_model_name else "",
                    "displayName": stt_model_name.get("display_name", ""),
                    "apiConfig": {
                        "apiKey": stt_model_name.get("api_key", ""),
                        "modelUrl": stt_model_name.get("base_url", "")
                    }
                },
                "tts": {
                    "name": get_model_name_from_config(tts_model_name) if tts_model_name else "",
                    "displayName": tts_model_name.get("display_name", ""),
                    "apiConfig": {
                        "apiKey": tts_model_name.get("api_key", ""),
                        "modelUrl": tts_model_name.get("base_url", "")
                    }
                }
            }
        }

        return JSONResponse(
            status_code=200,
            content={"config": config}
        )
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"message": f"Failed to load configuration: {str(e)}", "status": "error"}
        )

