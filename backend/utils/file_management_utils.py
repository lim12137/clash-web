from pathlib import Path
from typing import List, BinaryIO, Union
import logging

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
        logging.info(f"Error saving file {file.filename}: {str(e)}")
        return False


async def trigger_data_process(file_paths: List[str], process_params: ProcessParams):
    """Trigger data processing service to handle uploaded files"""
    try:
        logging.info("Files to process: %s", file_paths)

        if not file_paths:
            return None

        # Build source data list
        if len(file_paths) == 1:
            # Single file request
            payload = {"source": file_paths[0], "source_type": "file",
                "chunking_strategy": process_params.chunking_strategy, "index_name": process_params.index_name}

            logging.info("Payload: %s", payload)

            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(f"{DATA_PROCESS_SERVICE}/tasks", json=payload, timeout=30.0)

                logging.info("Data process service response: %s", response)

                if response.status_code == 201:
                    return response.json()
                else:
                    logging.info(
                        "Error from data process service: %s - %s", response,
                        response.text if hasattr(response, 'text') else 'No response text')
                    return {"status": "error", "code": response.status_code,
                        "message": f"Data process service error: {response.status_code}"}
            except httpx.RequestError as e:
                logging.info("Failed to connect to data process service: %s", str(e))
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
                    logging.info(
                        "Error from data process service: %s - %s", response,
                        response.text if hasattr(response, 'text') else 'No response text')
                    return {"status": "error", "code": response.status_code,
                        "message": f"Data process service error: {response.status_code}"}
            except httpx.RequestError as e:
                logging.info("Failed to connect to data process service: %s", str(e))
                return {"status": "error", "code": "CONNECTION_ERROR",
                    "message": f"Failed to connect to data process service: {str(e)}"}
    except Exception as e:
        logging.info("Error triggering data process: %s", str(e))
        return {"status": "error", "code": "INTERNAL_ERROR", "message": f"Internal error: {str(e)}"}
