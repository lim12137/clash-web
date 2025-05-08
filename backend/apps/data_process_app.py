import logging
import time
from contextlib import asynccontextmanager

from nexent.data_process.core import DataProcessCore
from fastapi import HTTPException, APIRouter

from consts.model import TaskResponse, TaskRequest, BatchTaskResponse, BatchTaskRequest, SimpleTaskStatusResponse, \
    SimpleTasksListResponse
from utils.task_status_utils import format_status_for_api, get_status_display

# Configure logging
logger = logging.getLogger("data_process.service")


class DataProcessService:
    def __init__(self, host: str = "0.0.0.0", port: int = 5000,
                 num_workers: int = 3):
        """
        Initialize the Data Process Service
        
        Args:
            host: Host to bind to
            port: Port to bind to
            num_workers: Number of worker threads for parallel processing
        """
        self.host = host
        self.port = port

        # Initialize core
        self.core = DataProcessCore(num_workers=num_workers)

        # Create FastAPI app
        self.router = self._create_router()

    def _create_router(self) -> APIRouter:
        """Create FastAPI application"""

        @asynccontextmanager
        async def lifespan(app: APIRouter):
            # Startup
            try:
                await self.core.start()
                yield
            finally:
                # Shutdown
                await self.core.stop()

        router = APIRouter(
            prefix="/tasks",
            lifespan=lifespan
        )

        # API Endpoints
        @router.post("", response_model=TaskResponse, status_code=201)
        async def create_task(request: TaskRequest):
            """
            Create a new data processing task

            Creates a data processing task and immediately returns the task ID.
            The task will be processed asynchronously in the background,
            and will be forwarded to Elasticsearch service upon completion.

            After processing, the task status will change to forwarding, then
            automatically forwarded to Elasticsearch, and finally the status
            will become completed or failed.
            """
            # Extract parameters
            params = {}
            if request.additional_params:
                params.update(request.additional_params)

            # Create task directly - no need to wait for processing
            start_time = time.time()
            task_id = await self.core.create_task(
                source=request.source,
                source_type=request.source_type,
                chunking_strategy=request.chunking_strategy,
                index_name=request.index_name,
                **params
            )
            logger.info(f"Task creation took {(time.time() - start_time) * 1000:.2f}ms",
                        extra={'task_id': task_id, 'stage': 'API-CREATE', 'source': 'service'})

            return TaskResponse(task_id=task_id)

        @router.post("/batch", response_model=BatchTaskResponse, status_code=201)
        async def create_batch_tasks(request: BatchTaskRequest):
            """
            Create a batch of data processing tasks

            Creates multiple data processing tasks and immediately returns the task ID list.
            Tasks will be processed asynchronously in the background,
            and will be forwarded to Elasticsearch service upon completion.

            After processing, each task status will change to forwarding, then
            automatically forwarded to Elasticsearch, and finally the status
            will become completed or failed.
            """
            # Create batch tasks directly - no need to wait for processing
            start_time = time.time()
            batch_id = f"batch-{int(time.time())}"

            logger.info(f"Processing batch request with {len(request.sources)} sources",
                        extra={'task_id': batch_id, 'stage': 'API-BATCH', 'source': 'service'})

            task_ids = await self.core.create_batch_tasks(request.sources)

            elapsed_ms = (time.time() - start_time) * 1000
            logger.info(f"Batch task creation took {elapsed_ms:.2f}ms for {len(task_ids)} tasks",
                        extra={'task_id': batch_id, 'stage': 'API-BATCH', 'source': 'service'})

            return BatchTaskResponse(task_ids=task_ids)

        @router.get("/{task_id}", response_model=SimpleTaskStatusResponse)
        async def get_task(task_id: str):
            """Get task status (without results and metadata)"""
            task = self.core.get_task(task_id)

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
            """List all tasks (without results and metadata)"""
            tasks = self.core.get_all_tasks()

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
            Get all active tasks for a specific index that are in WAITING, PROCESSING, FORWARDING or FAILED state

            Args:
                index_name: Name of the index to filter tasks for

            Returns:
                Dictionary containing index name and list of file information
            """
            try:
                return self.core.get_index_tasks(index_name)
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @router.get("/{task_id}/details")
        async def get_task_details(task_id: str):
            """Get task status and results."""
            task = self.core.get_task(task_id)

            if not task:
                raise HTTPException(status_code=404, detail="Task not found")

            # Use utility method to get formatted task status information
            return get_status_display(task)

        return router


router = DataProcessService().router
