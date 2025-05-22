import logging
from contextlib import asynccontextmanager
from fastapi import HTTPException, APIRouter, Form
import base64
import io

from consts.model import TaskResponse, TaskRequest, BatchTaskResponse, BatchTaskRequest, SimpleTaskStatusResponse, \
    SimpleTasksListResponse
from utils.task_status_utils import format_status_for_api, get_status_display
from services.data_process_service import DataProcessService

# Configure logging
logger = logging.getLogger("data_process.app")

# Initialize service
service = DataProcessService(num_workers=3)

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
    Create a new data processing task
    
    Returns task ID immediately. Processing happens in the background.
    Tasks are forwarded to Elasticsearch when complete.
    """
    # Extract parameters
    params = {}
    if request.additional_params:
        params.update(request.additional_params)

    # Create task using service
    task_id = await service.create_task(
        source=request.source,
        source_type=request.source_type,
        chunking_strategy=request.chunking_strategy,
        index_name=request.index_name,
        **params
    )

    return TaskResponse(task_id=task_id)


@router.post("/batch", response_model=BatchTaskResponse, status_code=201)
async def create_batch_tasks(request: BatchTaskRequest):
    """
    Create multiple data processing tasks at once
    
    Returns list of task IDs immediately. Processing happens in the background.
    """
    # Create batch tasks using service
    task_ids = await service.create_batch_tasks(request.sources)
    
    return BatchTaskResponse(task_ids=task_ids)


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
    task = service.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")

    # Get status and convert to lowercase - using utility function
    status = format_status_for_api(task["status"])

    return SimpleTaskStatusResponse(
        id=task["id"],
        status=status,
        created_at=task["created_at"],
        updated_at=task["updated_at"],
        error=task.get("error")
    )


@router.get("", response_model=SimpleTasksListResponse)
async def list_tasks():
    """Get a list of all tasks with their basic status information"""
    tasks = service.get_all_tasks()

    task_responses = []
    for task in tasks:
        # Use unified status conversion method
        status = format_status_for_api(task["status"])

        task_responses.append(
            SimpleTaskStatusResponse(
                id=task["id"],
                status=status,
                created_at=task["created_at"],
                updated_at=task["updated_at"],
                error=task.get("error")
            )
        )

    return SimpleTasksListResponse(tasks=task_responses)


@router.get("/indices/{index_name}/tasks")
async def get_index_tasks(index_name: str):
    """
    Get all active tasks for a specific index
    
    Returns tasks that are being processed or waiting to be processed
    """
    try:
        return service.get_index_tasks(index_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{task_id}/details")
async def get_task_details(task_id: str):
    """Get detailed information about a task, including results"""
    task = service.get_task(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Use utility method to get formatted task status information
    return get_status_display(task)


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
