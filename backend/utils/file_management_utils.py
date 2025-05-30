import logging
from pathlib import Path
from typing import List

import aiofiles
import httpx
from fastapi import UploadFile

from consts.const import DATA_PROCESS_SERVICE
from consts.model import ProcessParams

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


def get_all_files_status(index_name: str):
    """
    Get status for all files according to index_name, matching corresponding tasks, 
    and then convert to custom state
    
    Args:
        index_name: Index name to filter tasks
        
    Returns:
        Dictionary with path_or_url as keys and custom_state as values
    """
    try:
        from services.data_process_service import DataProcessService
        service = DataProcessService()
        tasks_list = service.get_all_tasks()
        
        # Dictionary to store file statuses: {path_or_url: {process_state, forward_state, timestamps}}
        file_states = {}
        
        for task_info in tasks_list:
            # Check if this task matches our criteria
            task_index_name = task_info.get('index_name', '')
            task_path_or_url = task_info.get('path_or_url', '')
            task_name = task_info.get('task_name', '')
            task_status = task_info.get('status', '')
            task_created_at = task_info.get('created_at', 0)
            
            # Match by index_name
            if task_index_name == index_name and task_path_or_url:
                
                # Initialize file state if not exists
                if task_path_or_url not in file_states:
                    file_states[task_path_or_url] = {
                        'process_state': '',
                        'forward_state': '',
                        'latest_process_created_at': 0,
                        'latest_forward_created_at': 0
                    }
                
                file_state = file_states[task_path_or_url]
                
                # Update latest task states
                if task_name == 'process' and task_created_at > file_state['latest_process_created_at']:
                    file_state['latest_process_created_at'] = task_created_at
                    file_state['process_state'] = task_status
                elif task_name == 'forward' and task_created_at > file_state['latest_forward_created_at']:
                    file_state['latest_forward_created_at'] = task_created_at
                    file_state['forward_state'] = task_status
        
        # Convert states to custom states for each file
        result = {}
        for path_or_url, file_state in file_states.items():
            custom_state = _convert_to_custom_state(
                process_celery_state=file_state['process_state'] or '',
                forward_celery_state=file_state['forward_state'] or ''
            )
            result[path_or_url] = custom_state
            
            logging.debug(f"File status for {path_or_url} in index {index_name}: "
                         f"process={file_state['process_state']}, forward={file_state['forward_state']} -> {custom_state}")
        
        return result
        
    except Exception as e:
        logging.error(f"Error getting all files status for index {index_name}: {str(e)}")
        return {}  # Return empty dict on error


def _convert_to_custom_state(process_celery_state: str, forward_celery_state: str) -> str:
    """
    Convert Celery task state to frontend representation
    
    Args:
        state: Celery task state
        task_name: Task name (process/forward)
        
    Returns:
        Converted state for frontend, value set:
        - WAIT_FOR_PROCESSING
        - PROCESSING
        - WAIT_FOR_FORWARDING
        - FORWARDING
        - COMPLETED
        - PROCESS_FAILED
        - FORWARD_FAILED
    """
    from celery import states
    if process_celery_state == states.SUCCESS and forward_celery_state == states.SUCCESS:
        return "COMPLETED"
    
    if process_celery_state == states.FAILURE:
        return "PROCESS_FAILED"
    if forward_celery_state == states.FAILURE:
        return "FORWARD_FAILED"
    # Not started
    if not (process_celery_state or forward_celery_state):
        return "WAIT_FOR_PROCESSING"

    # Failed
    if process_celery_state == states.FAILURE:
        return "PROCESS_FAILED"
    if forward_celery_state == states.FAILURE:
        return "FORWARD_FAILED"
    
    # Completed
    if process_celery_state == states.SUCCESS and forward_celery_state == states.SUCCESS:
        return "COMPLETED"
    forward_state_map = {
        states.PENDING: "WAIT_FOR_FORWARDING",
        states.STARTED: "FORWARDING",
        states.FAILURE: "FORWARD_FAILED",
    }
    process_state_map = {
        states.PENDING: "WAIT_FOR_PROCESSING",
        states.STARTED: "PROCESSING",
        states.FAILURE: "PROCESS_FAILED",
    }
    
    # Processing
    if forward_celery_state:
        return forward_state_map[forward_celery_state]
    else:
        return process_state_map[process_celery_state]