import logging
from contextlib import asynccontextmanager
from fastapi import HTTPException, APIRouter, Form, File, UploadFile
import base64
import io
import tempfile
import os

from consts.model import TaskResponse, TaskRequest, BatchTaskResponse, BatchTaskRequest, SimpleTaskStatusResponse, \
    SimpleTasksListResponse
from data_process.utils import get_task_info
from data_process.tasks import process_and_forward, process_sync
from services.data_process_service import get_data_process_service

# Configure logging
logger = logging.getLogger("data_process.app")

# Use shared service instance
service = get_data_process_service()

@asynccontextmanager
async def lifespan(app: APIRouter):
    # Startup
    try:
        await service.start()
        yield
    finally:
        # Shutdown
        await service.stop()

router = APIRouter(
    prefix="/tasks",
    lifespan=lifespan
)


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(request: TaskRequest):
    """
    Create a new data processing task (Process → Forward chain)
    
    Returns task ID immediately. Processing happens in the background.
    Tasks are forwarded to Elasticsearch when complete.
    """
    # Create task using the new process_and_forward task
    task_result = process_and_forward.delay(
        source=request.source,
        source_type=request.source_type,
        chunking_strategy=request.chunking_strategy,
        index_name=request.index_name,
        original_filename=request.original_filename
    )

    return TaskResponse(task_id=task_result.id)


@router.post("/process", response_model=dict, status_code=200)
async def process_sync_endpoint(
    source: str = Form(...),
    source_type: str = Form("url"),
    chunking_strategy: str = Form("basic"),
    timeout: int = Form(30)
):
    """
    Process a file synchronously and return extracted text immediately
    
    This endpoint provides real-time file processing for immediate text extraction.
    Uses high-priority processing queue for fast response.
    
    Parameters:
        source: File path, URL, or text content to process
        source_type: Type of source ("file", "url", or "text")
        chunking_strategy: Strategy for chunking the document
        timeout: Maximum time to wait for processing (seconds)
    
    Returns:
        JSON object containing extracted text and metadata
    """
    try:
        # Use the synchronous process task with high priority
        task_result = process_sync.apply_async(
            kwargs={
                'source': source,
                'source_type': source_type,
                'chunking_strategy': chunking_strategy,
                'timeout': timeout
            },
            priority=0,  # High priority for real-time processing
            queue='process_q'
        )
        
        # Wait for the result with timeout
        result = task_result.get(timeout=timeout)
        
        return {
            "success": True,
            "task_id": task_result.id,
            "source": source,
            "text": result.get("text", ""),
            "chunks": result.get("chunks", []),
            "chunks_count": result.get("chunks_count", 0),
            "processing_time": result.get("processing_time", 0),
            "text_length": result.get("text_length", 0)
        }
        
    except Exception as e:
        logger.error(f"Error in synchronous processing: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error processing file: {str(e)}"
        )


@router.post("/batch", response_model=BatchTaskResponse, status_code=201)
async def create_batch_tasks(request: BatchTaskRequest):
    """
    Create multiple data processing tasks at once (individual Process → Forward chains)
    
    Returns list of task IDs immediately. Each file gets its own task for better status tracking.
    Processing happens in the background for each file independently.
    """
    try:
        task_ids = []
        
        # Create individual tasks for each source
        for source_config in request.sources:
            # Extract parameters
            source = source_config.get('source')
            source_type = source_config.get('source_type', 'url')
            chunking_strategy = source_config.get('chunking_strategy')
            index_name = source_config.get('index_name')
            original_filename = source_config.get('original_filename')

            # Validate required fields
            if not source:
                logger.error(f"Missing required field 'source' in source config: {source_config}")
                continue
            if not index_name:
                logger.error(f"Missing required field 'index_name' in source config: {source_config}")
                continue
            
            # Create individual task for this source
            task_result = process_and_forward.delay(
                source=source,
                source_type=source_type,
                chunking_strategy=chunking_strategy,
                index_name=index_name,
                original_filename=original_filename
            )
            
            task_ids.append(task_result.id)
            logger.debug(f"Created task {task_result.id} for source: {source}")
        
        logger.info(f"Created {len(task_ids)} individual tasks for batch processing")
        return BatchTaskResponse(task_ids=task_ids)
        
    except Exception as e:
        logger.error(f"Error creating batch tasks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create batch tasks: {str(e)}")


@router.get("/load_image")
async def load_image(url: str):
    """
    Load an image from URL and return it as base64 encoded data
    
    Parameters:
        url: Image URL to load
    
    Returns:
        JSON object containing base64 encoded image data and content type
    """
    try:
        # Use the service to load the image
        image = await service.load_image(url)
        
        if image is None:
            raise HTTPException(status_code=404, detail="Failed to load image or image format not supported")
        
        # Convert PIL image to base64
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format=image.format or 'JPEG')
        img_byte_arr.seek(0)
        
        # Convert to base64
        image_data = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        
        # Determine correct content_type
        content_type = f"image/{image.format.lower() if image.format else 'jpeg'}"
        
        return {"success": True, "base64": image_data, "content_type": content_type}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading image: {str(e)}")


@router.get("/{task_id}", response_model=SimpleTaskStatusResponse)
async def get_task(task_id: str):
    """Get basic status information for a specific task"""
    task = await get_task_info(task_id)

    if not task:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
    return SimpleTaskStatusResponse(
        id=task["id"],
        task_name=task["task_name"],
        index_name=task["index_name"],
        path_or_url=task["path_or_url"],
        original_filename=task["original_filename"],
        status=task["status"],
        created_at=task["created_at"],
        updated_at=task["updated_at"],
        error=task["error"]
    )


@router.get("", response_model=SimpleTasksListResponse)
async def list_tasks():
    """Get a list of all tasks with their basic status information"""
    tasks = await service.get_all_tasks()

    task_responses = []
    for task in tasks:
        task_responses.append(
            SimpleTaskStatusResponse(
                id=task["id"],
                task_name=task["task_name"],
                index_name=task["index_name"],
                path_or_url=task["path_or_url"],
                original_filename=task["original_filename"],
                status=task["status"],
                created_at=task["created_at"],
                updated_at=task["updated_at"],
                error=task["error"]
            )
        )

    return SimpleTasksListResponse(tasks=task_responses)


@router.get("/indices/{index_name}")
async def get_index_tasks(index_name: str):
    """
    Get all active tasks for a specific index
    
    Returns tasks that are being processed or waiting to be processed
    """
    try:
        return await service.get_index_tasks(index_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}/details")
async def get_task_details(task_id: str):
    """Get detailed information about a task, including results"""
    from data_process.utils import get_task_details as utils_get_task_details
    task = await utils_get_task_details(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/filter_important_image", response_model=dict)
async def filter_important_image(
    image_url: str = Form(...),
    positive_prompt: str = Form("an important image"),
    negative_prompt: str = Form("an unimportant image")
):
    """
    Check if an image is important
    
    Uses AI to determine image importance based on provided prompts.
    Returns importance score and confidence level.
    """
    try:
        result = await service.filter_important_image(
            image_url=image_url,
            positive_prompt=positive_prompt,
            negative_prompt=negative_prompt
        )
        return result
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error processing image: {str(e)}")


@router.post("/process_text_file", response_model=dict, status_code=200)
async def process_text_file(
    file: UploadFile = File(...),
    chunking_strategy: str = Form("basic"),
    timeout: int = Form(60)
):
    """
    Transfer the uploaded file to text content
    
    This interface is specifically used for file-to-text conversion, supporting multiple file formats including PDF, Word, Excel, etc.
    Use high-priority processing queue for fast response.
    
    Parameters:
        file: Uploaded file object
        chunking_strategy: Chunking strategy, default is "basic"
        timeout: Processing timeout (seconds), default is 60 seconds
    
    Returns:
        JSON object, containing the extracted full text content and processing metadata
    """
    temp_file_path = None
    try:
        logger.info(f"Processing uploaded file: {file.filename}")
        
        # Save the uploaded file to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "")[1]) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        logger.info(f"Saved uploaded file to temporary path: {temp_file_path}")

        result = process_sync(source=temp_file_path, source_type='file', chunking_strategy=chunking_strategy, timeout=timeout)
        logger.info(f"Successfully processed uploaded file: {file.filename}, extracted {result.get('text_length', 0)} characters")
        
        return {
            "success": True,
            "task_id": result.get("task_id"),
            "filename": file.filename,
            "text": result.get("text", ""),
            "chunks_count": result.get("chunks_count", 0),
            "text_length": result.get("text_length", 0),
            "processing_time": result.get("processing_time", 0),
            "chunking_strategy": chunking_strategy
        }
        
    except Exception as e:
        logger.exception(f"Error processing uploaded file {file.filename}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"An error occurred while processing the file: {str(e)}"
        )
    finally:
        # Clean up temporary files
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(f"Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file {temp_file_path}: {str(e)}")
