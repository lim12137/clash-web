"""
Utility functions for Celery tasks
"""
import logging
import time
import os
import redis
from typing import Dict, Any, Optional, List
from celery.result import AsyncResult
from celery import current_app

# Configure logging
logger = logging.getLogger("data_process.utils")


def get_all_task_ids_from_redis() -> List[str]:
    """
    Get all task IDs from Redis backend
    
    Returns:
        List of task IDs found in Redis
    """
    task_ids = []
    try:
        redis_url = os.environ.get('REDIS_BACKEND_URL')
        if redis_url:
            redis_client = redis.from_url(redis_url)
            
            # Get all keys matching Celery result pattern
            result_keys = redis_client.keys('celery-task-meta-*')
            
            # Extract task IDs from keys
            for key in result_keys:
                if isinstance(key, bytes):
                    key = key.decode('utf-8')
                
                # Extract task ID from key format: celery-task-meta-<task_id>
                if key.startswith('celery-task-meta-'):
                    task_id = key.replace('celery-task-meta-', '')
                    task_ids.append(task_id)
            
            logger.debug(f"Found {len(task_ids)} task IDs in Redis")
    except Exception as e:
        logger.warning(f"Failed to get task IDs from Redis: {str(e)}")
    
    return task_ids


def get_task_info(task_id: str) -> Dict[str, Any]:
    """
    Get task status and metadata
    
    Args:
        task_id: Celery task ID
        
    Returns:
        Task status information
    """
    try:
        # Get AsyncResult object for the task
        result = AsyncResult(task_id, app=current_app)
        
        # Get current time for updated_at if not available
        current_time = time.time()
        
        # Construct basic status information
        status_info = {
            'id': task_id,
            'index_name': '',
            'task_name': '',
            'path_or_url': '',
            'status': result.status if result.status else 'PENDING',
            'created_at': current_time,
            'updated_at': current_time,
            'error': None
        }
        # Add metadata from task state
        if result.info:
            if isinstance(result.info, dict):
                # For successful tasks, the result may contain metadata
                metadata = result.info
                
                # Get task_name from metadata if available
                if 'task_name' in metadata:
                    status_info['task_name'] = metadata['task_name']
                
                # Add timestamps if available
                if 'start_time' in metadata:
                    status_info['created_at'] = metadata['start_time']
                
                # Extract index_name from metadata
                if 'index_name' in metadata:
                    status_info['index_name'] = metadata['index_name']

                if 'source' in metadata:
                    status_info['path_or_url'] = metadata['source']
                
                # Add any metadata to the status info
                # for key, value in metadata.items():
                #     if key not in status_info:
                #         status_info[key] = value
                        
        # Add error information for failed tasks
        if result.failed():
            error_info = str(result.result) if result.result else "Unknown error"
            status_info['error'] = error_info
            logger.debug(f"Task {task_id} failed with error: {error_info}")
        
        # Add result information for successful tasks
        if result.successful() and result.result:
            if isinstance(result.result, dict):
                # Include specific result fields that are useful for API
                for key in ['chunks_count', 'processing_time', 'storage_time', 'es_result']:
                    if key in result.result:
                        status_info[key] = result.result[key]
        
        logger.debug(f"Task {task_id} status: {status_info['status']}, index: {status_info['index_name']}, task_name: {status_info['task_name']}")
        return status_info
        
    except Exception as e:
        logger.warning(f"Error getting status for task {task_id}: {str(e)}")
        # Return minimal information if task status cannot be retrieved
        return {
            'id': task_id,
            'status': 'unknown',
            'created_at': time.time(),
            'updated_at': time.time(),
            'error': f"Cannot retrieve task status: {str(e)}",
            'index_name': '',
            'task_name': '',
            'path_or_url': '',
        }
    

def get_task_details(task_id: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed task information
    
    Args:
        task_id: Celery task ID
        
    Returns:
        Detailed task information or None if not found
    """
    # Get basic status information
    task_info = get_task_info(task_id)
    
    # Add additional details for completed tasks
    result = AsyncResult(task_id)
    
    if result.successful():
        if result.result:
            # For successful tasks, include the result if available
            if isinstance(result.result, dict):
                # Include result details
                if 'chunks_count' in result.result:
                    task_info['chunks_count'] = result.result['chunks_count']
                if 'processing_time' in result.result:
                    task_info['processing_time'] = result.result['processing_time']
                if 'storage_time' in result.result:
                    task_info['storage_time'] = result.result['storage_time']
                if 'es_result' in result.result:
                    task_info['es_result'] = result.result['es_result']
                
                # Add result field
                task_info['result'] = result.result

    return task_info