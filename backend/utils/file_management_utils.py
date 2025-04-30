from pathlib import Path
from typing import List, BinaryIO, Union

import aiofiles
import httpx
from fastapi import UploadFile
from nexent.core import MessageObserver
from nexent.core.models import OpenAIVLModel

from consts.const import DATA_PROCESS_SERVICE
from consts.model import ProcessParams
from utils.config_utils import config_manager

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'docx', 'pptx', 'xlsx', 'md', 'eml', 'msg', 'epub',
                      'xls', 'html', 'htm', 'org', 'odt', 'log', 'ppt', 'rst', 'rtf', 'tsv', 'doc', 'xml', 'js', 'py',
                      'java', 'cpp', 'cc', 'cxx', 'c', 'cs', 'php', 'rb', 'swift', 'ts', 'go'}


def allowed_file(filename: str) -> bool:
    if not filename:
        return False
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


async def save_upload_file(file: UploadFile, upload_path: Path) -> bool:
    try:
        async with aiofiles.open(upload_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        return True
    except Exception as e:
        print(f"Error saving file {file.filename}: {str(e)}")
        return False


async def trigger_data_process(file_paths: List[str], process_params: ProcessParams):
    """Trigger data processing service to handle uploaded files"""
    try:
        print("Files to process: ", file_paths)

        if not file_paths:
            return None

        # Build source data list
        if len(file_paths) == 1:
            # Single file request
            payload = {"source": file_paths[0], "source_type": "file",
                "chunking_strategy": process_params.chunking_strategy, "index_name": process_params.index_name}

            print(f"Payload: {payload}")

            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(f"{DATA_PROCESS_SERVICE}/tasks", json=payload, timeout=30.0)

                print(f"Data process service response: {response}")

                if response.status_code == 201:
                    return response.json()
                else:
                    print(
                        f"Error from data process service: {response} - {response.text if hasattr(response, 'text') else 'No response text'}")
                    return {"status": "error", "code": response.status_code,
                        "message": f"Data process service error: {response.status_code}"}
            except httpx.RequestError as e:
                print(f"Failed to connect to data process service: {str(e)}")
                return {"status": "error", "code": "CONNECTION_ERROR",
                    "message": f"Failed to connect to data process service: {str(e)}"}

        else:
            # Batch file request
            sources = []
            for file_path in file_paths:
                source = {"source": file_path, "source_type": "file", "index_name": process_params.index_name}

                sources.append(source)

            payload = {"sources": sources}

            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(f"{DATA_PROCESS_SERVICE}/tasks/batch", json=payload, timeout=30.0)

                if response.status_code == 201:
                    return response.json()
                else:
                    print(
                        f"Error from data process service: {response} - {response.text if hasattr(response, 'text') else 'No response text'}")
                    return {"status": "error", "code": response.status_code,
                        "message": f"Data process service error: {response.status_code}"}
            except httpx.RequestError as e:
                print(f"Failed to connect to data process service: {str(e)}")
                return {"status": "error", "code": "CONNECTION_ERROR",
                    "message": f"Failed to connect to data process service: {str(e)}"}
    except Exception as e:
        print(f"Error triggering data process: {str(e)}")
        return {"status": "error", "code": "INTERNAL_ERROR", "message": f"Internal error: {str(e)}"}


def convert_image_to_text(query: str, image_input: Union[str, BinaryIO]):
    print(config_manager.get_config("VL_MODEL_NAME"), config_manager.get_config("VL_MODEL_URL"))
    image_to_text_model = OpenAIVLModel(observer=MessageObserver(), model_id=config_manager.get_config("VL_MODEL_NAME"),
        api_base=config_manager.get_config("VL_MODEL_URL"), api_key=config_manager.get_config("VL_API_KEY"),
        temperature=0.7, top_p=0.7, frequency_penalty=0.5, max_tokens=512)
    prompt = f"用户提出了一个问题：{query}，请从回答这个问题的角度精简、仔细描述一下这个图片，200字以内。"
    text = image_to_text_model.analyze_image(image_input=image_input, system_prompt=prompt).content
    return text
