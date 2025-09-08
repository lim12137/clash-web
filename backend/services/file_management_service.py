# Concurrency control
import asyncio
import json
import logging
import os
import uuid
from io import BytesIO
from pathlib import Path
from typing import List, Optional, AsyncGenerator

import httpx
import requests
from fastapi import UploadFile

from agents.preprocess_manager import preprocess_manager
from consts.const import UPLOAD_FOLDER, MAX_CONCURRENT_UPLOADS, DATA_PROCESS_SERVICE
from database.attachment_db import upload_fileobj, get_file_url, get_content_type, get_file_stream, delete_file, \
    list_files
from utils.attachment_utils import convert_image_to_text, convert_long_text_to_text
from utils.file_management_utils import save_upload_file

# Create upload directory
upload_dir = Path(UPLOAD_FOLDER)
upload_dir.mkdir(exist_ok=True)
upload_semaphore = asyncio.Semaphore(MAX_CONCURRENT_UPLOADS)

logger = logging.getLogger("file_management_service")


async def upload_files_impl(destination: str, file: List[UploadFile], folder: str = None) -> tuple:
    """
    Upload files to local storage or MinIO based on destination.

    Args:
        destination: "local" or "minio"
        file: List of UploadFile objects
        folder: Folder name for MinIO uploads

    Returns:
        tuple: (errors, uploaded_file_paths, uploaded_filenames)
    """
    uploaded_filenames = []
    uploaded_file_paths = []
    errors = []
    if destination == "local":
        async with upload_semaphore:
            for f in file:
                if not f:
                    continue

                safe_filename = os.path.basename(f.filename or "")
                upload_path = upload_dir / safe_filename
                absolute_path = upload_path.absolute()

                # Save file
                if await save_upload_file(f, upload_path):
                    uploaded_filenames.append(safe_filename)
                    uploaded_file_paths.append(str(absolute_path))
                    logger.info(f"Successfully saved file: {safe_filename}")
                else:
                    errors.append(f"Failed to save file: {f.filename}")

    elif destination == "minio":
        minio_results = await upload_to_minio(files=file, folder=folder)
        for result in minio_results:
            if result.get("success"):
                uploaded_filenames.append(result.get("file_name"))
                uploaded_file_paths.append(result.get("object_name"))
            else:
                file_name = result.get('file_name')
                error_msg = result.get('error', 'Unknown error')
                errors.append(f"Failed to upload {file_name}: {error_msg}")
    else:
        raise Exception("Invalid destination. Must be 'local' or 'minio'.")
    return errors, uploaded_file_paths, uploaded_filenames


async def upload_to_minio(files: List[UploadFile], folder: str) -> List[dict]:
    """Helper function to upload files to MinIO and return results."""
    results = []
    for f in files:
        try:
            # Read file content
            file_content = await f.read()

            # Convert file content to BytesIO object
            file_obj = BytesIO(file_content)

            # Upload file
            result = upload_fileobj(
                file_obj=file_obj,
                file_name=f.filename or "",
                prefix=folder
            )

            # Reset file pointer for potential re-reading
            await f.seek(0)
            results.append(result)

        except Exception as e:
            # Log single file upload failure but continue processing other files
            logger.error(
                f"Failed to upload file {f.filename}: {e}", exc_info=True)
            results.append({
                "success": False,
                "file_name": f.filename,
                "error": "An error occurred while processing the file."
            })
    return results


async def get_file_url_impl(object_name: str, expires: int):
    result = get_file_url(object_name=object_name, expires=expires)
    if not result["success"]:
        raise Exception(
            f"File does not exist or cannot be accessed: {result.get('error', 'Unknown error')}")
    return result


async def get_file_stream_impl(object_name: str):
    file_stream = get_file_stream(object_name=object_name)
    if file_stream is None:
        raise Exception("File not found or failed to read from storage")
    content_type = get_content_type(object_name)
    return file_stream, content_type


async def delete_file_impl(object_name: str):
    result = delete_file(object_name=object_name)
    if not result["success"]:
        raise Exception(
            f"File does not exist or deletion failed: {result.get('error', 'Unknown error')}")
    return result


async def list_files_impl(prefix: str, limit: Optional[int] = None):
    files = list_files(prefix=prefix)
    if limit:
        files = files[:limit]
    return files


def get_parsing_file_message(language: str, index: int, total_files: int, filename: str) -> str:
    """
    Get internationalized parsing file message
    
    Args:
        language: Language code ('zh' or 'en')
        index: Current file index (0-based)
        total_files: Total number of files
        filename: Name of the file being parsed
        
    Returns:
        str: Internationalized message
    """
    if language == 'zh':
        return f"正在解析文件 {index + 1}/{total_files}: {filename}"
    else:
        return f"Parsing file {index + 1}/{total_files}: {filename}"


def get_truncation_message(language: str, filename: str, truncation_percentage: int) -> str:
    """
    Get internationalized truncation message
    
    Args:
        language: Language code ('zh' or 'en')
        filename: Name of the file being truncated
        truncation_percentage: Percentage of content that was read
        
    Returns:
        str: Internationalized truncation message
    """
    if language == 'zh':
        return f"{filename} 超出字数限制，只阅读了前 {truncation_percentage}%"
    else:
        return f"{filename} exceeds word limit, only read the first {truncation_percentage}%"


async def preprocess_files_generator(
    query: str,
    file_cache: List[dict],
    tenant_id: str,
    language: str,
    task_id: str,
    conversation_id: int
) -> AsyncGenerator[str, None]:
    """
    Generate streaming response for file preprocessing
    
    Args:
        query: User query string
        file_cache: List of cached file data
        tenant_id: Tenant ID
        language: Language preference
        task_id: Unique task ID
        conversation_id: Conversation ID
    
    Yields:
        str: JSON formatted streaming messages
    """
    file_descriptions = []
    total_files = len(file_cache)

    # Create and register the preprocess task
    task = asyncio.current_task()
    if task:
        preprocess_manager.register_preprocess_task(task_id, conversation_id, task)

    try:
        for index, file_data in enumerate(file_cache):
            if task and task.done():
                logger.info(f"Preprocess task {task_id} was cancelled")
                break

            progress = int((index / total_files) * 100)
            progress_message = json.dumps({
                "type": "progress",
                "progress": progress,
                "message": get_parsing_file_message(language, index, total_files, file_data['filename'])
            }, ensure_ascii=False)
            yield f"data: {progress_message}\n\n"
            await asyncio.sleep(0.1)

            try:
                # Check if file already has an error
                if "error" in file_data:
                    raise Exception(file_data["error"])

                if file_data["ext"] in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                    description = await process_image_file(query, file_data["filename"], file_data["content"], tenant_id, language)
                    truncation_percentage = None
                else:
                    description, truncation_percentage = await process_text_file(query, file_data["filename"], file_data["content"], tenant_id, language)
                file_descriptions.append(description)

                # Send processing result for each file
                file_message_data = {
                    "type": "file_processed",
                    "filename": file_data["filename"],
                    "description": description
                }
                file_message = json.dumps(file_message_data, ensure_ascii=False)
                yield f"data: {file_message}\n\n"
                await asyncio.sleep(0.1)
                
                # Send truncation notice immediately if file was truncated
                if truncation_percentage is not None and int(truncation_percentage) < 100:
                    if int(truncation_percentage) == 0:
                        truncation_percentage = "< 1"

                    truncation_msg = get_truncation_message(language, file_data['filename'], truncation_percentage)
                    
                    truncation_message = json.dumps({
                        "type": "truncation",
                        "message": truncation_msg
                    }, ensure_ascii=False)
                    yield f"data: {truncation_message}\n\n"
                    await asyncio.sleep(0.1)
            except Exception as e:
                error_description = f"Error parsing file {file_data['filename']}: {str(e)}"
                logger.exception(error_description)
                file_descriptions.append(error_description)
                error_message = json.dumps({
                    "type": "error",
                    "filename": file_data["filename"],
                    "message": error_description
                }, ensure_ascii=False)
                yield f"data: {error_message}\n\n"
                await asyncio.sleep(0.1)

        # Send completion message
        complete_message = json.dumps({
            "type": "complete",
            "progress": 100,
            "final_query": query
        }, ensure_ascii=False)
        yield f"data: {complete_message}\n\n"
    finally:
        preprocess_manager.unregister_preprocess_task(task_id)


async def process_image_file(query: str, filename: str, file_content: bytes, tenant_id: str, language: str = 'zh') -> str:
    """
    Process image file, convert to text using external API
    """
    try:
        image_stream = BytesIO(file_content)
        text = convert_image_to_text(query, image_stream, tenant_id, language)
        return f"Image file {filename} content: {text}"
    except Exception as e:
        return f"Image file {filename} content: Error processing image file {filename}: {str(e)}"


async def process_text_file(query: str, filename: str, file_content: bytes, tenant_id: str, language: str = 'zh') -> tuple[str, Optional[str]]:
    """
    Process text file, convert to text using external API
    """
    # file_content is byte data, need to send to API through file upload
    data_process_service_url = DATA_PROCESS_SERVICE
    api_url = f"{data_process_service_url}/tasks/process_text_file"
    logger.info(f"Processing text file {filename} with API: {api_url}")

    try:
        # Upload byte data as a file
        files = {
            'file': (filename, file_content, 'application/octet-stream')
        }
        data = {
            'chunking_strategy': 'basic',
            'timeout': 60
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, files=files, data=data, timeout=60)

        if response.status_code == 200:
            result = response.json()
            raw_text = result.get("text", "")
            logger.info(
                f"File processed successfully: {raw_text[:200]}...{raw_text[-200:]}...， length: {len(raw_text)}")
        else:
            error_detail = response.json().get('detail', '未知错误') if response.headers.get(
                'content-type', '').startswith('application/json') else response.text
            logger.error(
                f"File processing failed (status code: {response.status_code}): {error_detail}")
            raise Exception(
                f"File processing failed (status code: {response.status_code}): {error_detail}")

    except Exception as e:
        return f"File {filename} content: Error processing text file {filename}: {str(e)}", None

    try:
        text, truncation_percentage = convert_long_text_to_text(query, raw_text, tenant_id, language)
        return f"File {filename} content: {text}", truncation_percentage
    except Exception as e:
        return f"File {filename} content: Error processing text file {filename}: {str(e)}", None


def get_file_description(files: List[UploadFile]) -> str:
    """
    Generate file description text
    """
    if not files:
        return "User provided some reference files:\nNo files provided"
    
    description = "User provided some reference files:\n"
    for file in files:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
            description += f"- Image file {file.filename or ''}\n"
        else:
            description += f"- File {file.filename or ''}\n"
    return description
