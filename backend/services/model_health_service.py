import logging

import requests
from nexent.core import MessageObserver
from nexent.core.models import OpenAIModel
from nexent.core.models.embedding_model import JinaEmbedding

from apps.voice_app import VoiceService
from consts.const import MODEL_ENGINE_APIKEY, MODEL_ENGINE_HOST
from consts.model import ModelConnectStatusEnum, ModelResponse
from database.model_management_db import get_model_by_name, update_model_record
from utils.model_name_utils import split_repo_name


async def check_model_connectivity(model_name: str):
    try:
        # Split model_name
        repo, name = split_repo_name(model_name)
        # Ensure repo is empty string instead of null
        repo = repo if repo else ""
        # Find model based on split model_repo and model_name
        logging.info(f"Checking model connectivity: {repo}/{name}")
        model = get_model_by_name(name, repo)
        if not model:
            return ModelResponse(code=404, message=f"Model configuration not found for {model_name}",
                data={"connectivity": False, "connect_status": ""})

        # Set model to "detecting" status
        update_data = {"connect_status": ModelConnectStatusEnum.DETECTING.value}
        update_model_record(model["model_id"], update_data)

        model_type = model["model_type"]
        model_base_url = model["base_url"]
        model_api_key = model["api_key"]
        connectivity: bool

        # print model_name, model_base_url, model_api_key
        print(
            f"Check connectivity: model_name: {model_name}, model_base_url: {model_base_url}, model_api_key: {model_api_key}")

        # Test connectivity based on different model types
        if model_type == "embedding":
            # TODO: Implement non-Jina model instantiation in the future
            connectivity = JinaEmbedding(model_name=model_name, base_url=model_base_url, api_key=model_api_key,
                                         embedding_dim=1024).check_connectivity()

        elif model_type == "llm":
            observer = MessageObserver()
            connectivity = OpenAIModel(observer, model_id=model_name, api_base=model_base_url,
                                       api_key=model_api_key).check_connectivity()

        elif model_type == "rerank":
            # connectivity =  RerankModel.check_connectivity()
            # TODO: Implement RerankModel connectivity test
            connectivity = False
        elif model_type in ["tts", "stt"]:
            connectivity = await VoiceService().check_connectivity(model_type)

        else:
            # Unsupported model type, update to unavailable status
            update_data = {"connect_status": ModelConnectStatusEnum.UNAVAILABLE.value}
            update_model_record(model["model_id"], update_data)
            return ModelResponse(code=400, message=f"Unsupported model type: {model_type}",
                data={"connectivity": False, "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value})

        # Update model status based on connectivity result
        connect_status = ModelConnectStatusEnum.AVAILABLE.value if connectivity else ModelConnectStatusEnum.UNAVAILABLE.value
        update_data = {"connect_status": connect_status}
        update_model_record(model["model_id"], update_data)

        return ModelResponse(code=200, message=f"Model {model_name} connectivity {'successful' if connectivity else 'failed'}",
            data={"connectivity": connectivity, "connect_status": connect_status})

    except Exception as e:
        # Update to unavailable status when exception occurs
        if model:
            update_data = {"connect_status": ModelConnectStatusEnum.UNAVAILABLE.value}
            update_model_record(model["model_id"], update_data)

        return ModelResponse(code=500, message=f"Connectivity test error: {str(e)}",
            data={"connectivity": False, "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value})


async def check_me_model_connectivity(model_name: str):
    try:
        headers = {'Authorization': f'Bearer {MODEL_ENGINE_APIKEY}'}
        response = requests.get(f"{MODEL_ENGINE_HOST}/open/router/v1/models", headers=headers, verify=False)
        response.raise_for_status()
        result = response.json()['data']

        # Find model
        model_data = next((item for item in result if item['id'] == model_name), None)
        if not model_data:
            return ModelResponse(code=404, message="Specified model not found",
                data={"connectivity": False, "message": "Specified model not found", "connect_status": ""})

        model_type = model_data['type']

        if model_type == 'llm':
            payload = {"model": model_name, "messages": [{"role": "user", "content": "hello"}]}
            api_response = requests.post(f"{MODEL_ENGINE_HOST}/open/router/v1/chat/completions", headers=headers,
                json=payload, verify=False)
        elif model_type == 'embedding':
            payload = {"model": model_name, "input": "Hello"}
            api_response = requests.post(f"{MODEL_ENGINE_HOST}/open/router/v1/embeddings", headers=headers,
                json=payload, verify=False)
        else:
            return ModelResponse(code=400, message=f"Health check not supported for {model_type} type models",
                data={"connectivity": False, "message": f"Health check not supported for {model_type} type models",
                      "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value})

        if api_response.status_code == 200:
            connect_status = ModelConnectStatusEnum.AVAILABLE.value
            return ModelResponse(code=200, message=f"Model {model_name} responded normally",
                data={"connectivity": True, "message": f"Model {model_name} responded normally", "connect_status": connect_status})
        else:
            connect_status = ModelConnectStatusEnum.UNAVAILABLE.value
            return ModelResponse(code=api_response.status_code, message=f"Model {model_name} response failed",
                data={"connectivity": False, "message": f"Model {model_name} response failed: {api_response.text}",
                      "connect_status": connect_status})

    except Exception as e:
        return ModelResponse(code=500, message=f"Unknown error occurred: {str(e)}",
            data={"connectivity": False, "message": f"Unknown error occurred: {str(e)}",
                  "connect_status": ModelConnectStatusEnum.UNAVAILABLE.value})
