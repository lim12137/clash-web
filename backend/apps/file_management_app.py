import asyncio
import os
import json
from pathlib import Path
from typing import List, Optional
from io import BytesIO
import requests
import logging

from utils.auth_utils import get_current_user_id
from fastapi import UploadFile, File, HTTPException, Form, APIRouter, Query, Path as PathParam, Body, Header
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse

from consts.model import ProcessParams
from consts.const import MAX_CONCURRENT_UPLOADS, UPLOAD_FOLDER
from utils.file_management_utils import save_upload_file, trigger_data_process
from utils.attachment_utils import convert_image_to_text, convert_long_text_to_text
from database.attachment_db import (
    upload_fileobj, delete_file, get_file_url, list_files
)
logger = logging.getLogger("file_management_app")

# Create upload directory
upload_dir = Path(UPLOAD_FOLDER)
upload_dir.mkdir(exist_ok=True)

# Concurrency control
upload_semaphore = asyncio.Semaphore(MAX_CONCURRENT_UPLOADS)

# Create API router
router = APIRouter(prefix="/file")


# Handle preflight requests
@router.options("/{full_path:path}")
async def options_route(full_path: str):
    return JSONResponse(
        status_code=200,
        content={"detail": "OK"},
    )


@router.post("/upload")
async def upload_files(
        file: List[UploadFile] = File(..., alias="file"),
        chunking_strategy: Optional[str] = Form(None),
        index_name: str = Form(...)
):
    print(f"Received upload request with {len(file)} files")

    if not file:
        raise HTTPException(status_code=400, detail="No files in the request")

    # Build processing parameters
    process_params = ProcessParams(
        chunking_strategy=chunking_strategy,
        index_name=index_name
    )

    uploaded_filenames = []
    uploaded_file_paths = []
    errors = []

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
                print(f"Successfully saved file: {safe_filename}")
            else:
                errors.append(f"Failed to save file: {f.filename}")

    # Trigger data processing
    if uploaded_file_paths:
        print(f"Triggering data process for {len(uploaded_file_paths)} files")
        process_result = await trigger_data_process(uploaded_file_paths, process_params)

        # If data processing service fails, the entire upload fails
        if process_result is None or (isinstance(process_result, dict) and process_result.get("status") == "error"):
            error_message = "Data process service failed"
            if isinstance(process_result, dict) and "message" in process_result:
                error_message = process_result["message"]

            # Delete uploaded files
            for path in uploaded_file_paths:
                try:
                    os.remove(path)
                except Exception as e:
                    print(f"Failed to remove file {path}: {str(e)}")

            return JSONResponse(
                status_code=500,
                content={
                    "error": error_message,
                    "files": uploaded_filenames
                }
            )

        # Data processing successful
        return JSONResponse(
            status_code=201,
            content={
                "message": "Files uploaded successfully",
                "uploaded_files": uploaded_filenames,
                "process_tasks": process_result
            }
        )
    else:
        print(f"Errors: {errors}")
        return JSONResponse(
            status_code=400,
            content={
                "error": "No valid files uploaded",
                "errors": errors
            }
        )


@router.post("/storage")
async def storage_upload_files(
    files: List[UploadFile] = File(..., description="List of files to upload"),
    folder: str = Form("attachments", description="Storage folder path (optional)")
):
    """
    Upload one or more files to MinIO storage

    - **files**: List of files to upload
    - **folder**: Storage folder path (optional, defaults to 'attachments')

    Returns upload results including file information and access URLs
    """
    results = []

    for file in files:
        try:
            # Read file content
            file_content = await file.read()

            # Convert file content to BytesIO object
            file_obj = BytesIO(file_content)

            # Upload file
            result = upload_fileobj(
                file_obj=file_obj,
                file_name=file.filename or "",
                prefix=folder,
                metadata={
                    "original-filename": str(file.filename or ""),
                    "content-type": str(file.content_type or "application/octet-stream"),
                    "folder": str(folder)
                }
            )

            # Reset file pointer for potential re-reading
            await file.seek(0)

            results.append(result)

        except Exception as e:
            # Log single file upload failure but continue processing other files
            results.append({
                "success": False,
                "file_name": file.filename,
                "error": str(e)
            })

    # Return upload results for all files
    return {
        "message": f"Processed {len(results)} files",
        "success_count": sum(1 for r in results if r.get("success", False)),
        "failed_count": sum(1 for r in results if not r.get("success", False)),
        "results": results
    }


@router.get("/storage")
async def get_storage_files(
    prefix: str = Query("", description="File prefix filter"),
    limit: int = Query(100, description="Maximum number of files to return"),
    include_urls: bool = Query(True, description="Whether to include presigned URLs")
):
    """
    Get list of files from MinIO storage

    - **prefix**: File prefix filter (optional)
    - **limit**: Maximum number of files to return (default 100)
    - **include_urls**: Whether to include presigned URLs (default True)

    Returns file list and metadata
    """
    try:
        # Get file list
        files = list_files(prefix=prefix)

        # Limit return count
        files = files[:limit]

        # Remove URLs if not needed
        if not include_urls:
            for file in files:
                if "url" in file:
                    del file["url"]

        return {
            "total": len(files),
            "files": files
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get file list: {str(e)}"
        )


@router.get("/storage/{path}/{object_name}")
async def get_storage_file(
    object_name: str = PathParam(..., description="File object name"),
    download: bool = Query(False, description="Whether to download file directly"),
    expires: int = Query(3600, description="URL validity period (seconds)")
):
    """
    Get information or download link for a single file

    - **object_name**: File object name
    - **download**: Whether to download file directly (default False)
    - **expires**: URL validity period in seconds (default 3600)

    Returns file information or redirects to download link
    """
    try:
        # Get file URL
        result = get_file_url(object_name=object_name, expires=expires)
        if not result["success"]:
            raise HTTPException(
                status_code=404,
                detail=f"File does not exist or cannot be accessed: {result.get('error', 'Unknown error')}"
            )

        # If download requested, redirect to file URL
        if download:
            return RedirectResponse(url=result["url"])

        # Otherwise return file information
        return result

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e

        raise HTTPException(
            status_code=500,
            detail=f"Failed to get file information: {str(e)}"
        )


@router.delete("/storage/{object_name}")
async def remove_storage_file(
    object_name: str = PathParam(..., description="File object name to delete")
):
    """
    Delete file from MinIO storage

    - **object_name**: File object name to delete

    Returns deletion operation result
    """
    try:
        # Delete file
        result = delete_file(object_name=object_name)

        if not result["success"]:
            raise HTTPException(
                status_code=404,
                detail=f"File does not exist or deletion failed: {result.get('error', 'Unknown error')}"
            )

        return {
            "success": True,
            "message": f"File {object_name} successfully deleted"
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e

        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete file: {str(e)}"
        )


@router.post("/storage/batch-urls")
async def get_storage_file_batch_urls(
    request_data: dict = Body(..., description="JSON containing list of file object names"),
    expires: int = Query(3600, description="URL validity period (seconds)")
):
    """
    Batch get download URLs for multiple files (JSON request)

    - **request_data**: JSON request body containing object_names list
    - **expires**: URL validity period in seconds (default 3600)

    Returns URL and status information for each file
    """
    # Extract object_names from request body
    object_names = request_data.get("object_names", [])
    if not object_names or not isinstance(object_names, list):
        raise HTTPException(status_code=400, detail="Request body must contain object_names array")
    
    results = []

    for object_name in object_names:
        try:
            # Get file URL
            result = get_file_url(object_name=object_name, expires=expires)
            results.append({
                "object_name": object_name,
                "success": result["success"],
                "url": result.get("url"),
                "error": result.get("error")
            })
        except Exception as e:
            results.append({
                "object_name": object_name,
                "success": False,
                "error": str(e)
            })

    return {
        "total": len(results),
        "success_count": sum(1 for r in results if r.get("success", False)),
        "failed_count": sum(1 for r in results if not r.get("success", False)),
        "results": results
    }


@router.post("/preprocess")
async def agent_preprocess_api(query: str = Form(...), files: List[UploadFile] = File(...), authorization: Optional[str] = Header(None)):
    """
    Preprocess uploaded files and return streaming response
    """
    try:
        # Pre-read and cache all file contents
        user_id, tenant_id = get_current_user_id(authorization)
        file_cache = []
        for file in files:
            import time
            try:
                content = await file.read()
                file_cache.append({
                    "filename": file.filename or "",
                    "content": content,
                    "ext": os.path.splitext(file.filename or "")[1].lower()
                })
            except Exception as e:
                file_cache.append({
                    "filename": file.filename or "",
                    "error": str(e)
                })

        async def generate():
            file_descriptions = []
            total_files = len(file_cache)

            for index, file_data in enumerate(file_cache):
                progress = int((index / total_files) * 100)

                progress_message = json.dumps({
                    "type": "progress",
                    "progress": progress,
                    "message": f"Parsing file {index + 1}/{total_files}: {file_data['filename']}"
                }, ensure_ascii=False)
                yield f"data: {progress_message}\n\n"
                await asyncio.sleep(0.1)

                try:
                    # Check if file already has an error
                    if "error" in file_data:
                        raise Exception(file_data["error"])

                    if file_data["ext"] in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                        description = await process_image_file(query, file_data["filename"], file_data["content"], tenant_id)
                    else:
                        description = await process_text_file(query, file_data["filename"], file_data["content"], tenant_id)
                    file_descriptions.append(description)

                    # Send processing result for each file
                    file_message = json.dumps({
                        "type": "file_processed",
                        "filename": file_data["filename"],
                        "description": description
                    }, ensure_ascii=False)
                    yield f"data: {file_message}\n\n"
                    await asyncio.sleep(0.1)
                except Exception as e:
                    error_description = f"Error parsing file {file_data['filename']}: {str(e)}"
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

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File preprocessing error: {str(e)}")


async def process_image_file(query, filename, file_content, tenant_id: str) -> str:
    """
    Process image file, convert to text using external API
    """
    image_stream = BytesIO(file_content)
    text = convert_image_to_text(query, image_stream, tenant_id)

    return f"Image file {filename} content: {text}"


async def process_text_file(query, filename, file_content, tenant_id: str) -> str:
    """
    Process text file, convert to text using external API
    """
    # file_content is byte data, need to send to API through file upload
    data_process_service_url = os.environ.get('DATA_PROCESS_SERVICE')
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
        
        response = requests.post(
            api_url,
            files=files,
            data=data,
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()
            logger.info(f"File processed successfully: {result}...")
            raw_text = result.get("text", "")
            logger.info(f"File processed successfully: {raw_text[:100]}...")
        else:
            error_detail = response.json().get('detail', '未知错误') if response.headers.get('content-type', '').startswith('application/json') else response.text
            logger.error(f"File processing failed (status code: {response.status_code}): {error_detail}")
            raise Exception(f"File processing failed (status code: {response.status_code}): {error_detail}")

    except requests.exceptions.Timeout:
        raise Exception("API call timeout")
    except requests.exceptions.ConnectionError:
        raise Exception(f"Cannot connect to data processing service: {api_url}")
    except Exception as e:
        raise Exception(f"Error processing file: {str(e)}")

    text = convert_long_text_to_text(query, raw_text, tenant_id)
    return f"File {filename} content: {text}"


def get_file_description(files: List[UploadFile]) -> str:
    """
    Generate file description text
    """
    description = "User provided some reference files:\n"
    for file in files:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
            description += f"- Image file {file.filename or ''}\n"
        else:
            description += f"- File {file.filename or ''}\n"
    return description
