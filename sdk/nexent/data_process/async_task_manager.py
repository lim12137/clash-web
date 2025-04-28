import asyncio
import logging
import uuid
from typing import Dict, Any, TYPE_CHECKING

from .task_store import TaskStore, TaskStatus

# Get logger for async task manager
logger = logging.getLogger("data_process.async_task_manager")

# Type checking imports
if TYPE_CHECKING:
    from .process_worker_pool import ProcessWorkerPool


class AsyncTaskManager:
    def __init__(self, task_store: TaskStore, worker_pool: 'ProcessWorkerPool'):
        """
        Initialize the Async Task Manager
        
        Args:
            task_store: Task store instance
            worker_pool: Worker pool instance
        """
        self.task_store = task_store
        self.worker_pool = worker_pool
        self._status_queue = asyncio.Queue()  # 状态更新队列
        self._cleanup_task = None

        logger.info("Async Task Manager initialized",
                    extra={'task_id': ' ' * 36, 'stage': 'STARTUP', 'source': 'async'})

    async def start(self) -> None:
        """Start the async task manager"""
        # Start status update processor
        self._status_processor = asyncio.create_task(self._process_status_updates())

        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._run_cleanup())

        logger.info("Async Task Manager started", extra={'task_id': ' ' * 36, 'stage': 'STARTUP', 'source': 'async'})

    async def stop(self) -> None:
        """Stop the async task manager"""
        if self._status_processor:
            self._status_processor.cancel()
            try:
                await self._status_processor
            except asyncio.CancelledError:
                pass

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        logger.info("Async Task Manager stopped", extra={'task_id': ' ' * 36, 'stage': 'SHUTDOWN', 'source': 'async'})

    async def create_task(self, task_data: Dict[str, Any]) -> str:
        """
        Create a new task
        
        Args:
            task_data: Task data dictionary
            
        Returns:
            Task ID
        """
        task_id = str(uuid.uuid4())

        # Add task to store
        self.task_store.add_task(task_id, task_data)

        # Submit to worker pool
        self.worker_pool.submit(task_id, task_data)

        logger.info(f"Created new task with ID: {task_id}",
                    extra={'task_id': task_id, 'stage': 'CREATED', 'source': 'async'})
        return task_id

    async def create_batch_tasks(self, sources: list[Dict[str, Any]]) -> list[str]:
        """
        Create multiple tasks in batch
        
        Args:
            sources: List of source dictionaries
            
        Returns:
            List of task IDs
        """
        task_ids = []

        for source_data in sources:
            task_id = await self.create_task(source_data)
            task_ids.append(task_id)

        logger.info(f"Created batch of {len(task_ids)} tasks",
                    extra={'task_id': task_ids[0] if task_ids else ' ' * 36, 'stage': 'BATCH', 'source': 'async'})
        return task_ids

    async def update_task_status(self, task_id: str, status: TaskStatus, result: Any = None, error: str = None) -> None:
        """
        Update task status
        
        Args:
            task_id: Task ID
            status: New status
            result: Optional result data
            error: Optional error message
        """
        await self._status_queue.put((task_id, status, result, error))

    async def _process_status_updates(self) -> None:
        """Process status updates from the queue"""
        while True:
            try:
                task_id, status, result, error = await self._status_queue.get()

                # Update task status in store
                self.task_store.update_status(task_id, status, result, error)

                # If task is completed, trigger cleanup
                if status == TaskStatus.COMPLETED:
                    await self.task_store.cleanup_tasks()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error processing status update: {str(e)}",
                             extra={'task_id': task_id if 'task_id' in locals() else ' ' * 36, 'stage': 'ERROR',
                                    'source': 'async'})

    async def _run_cleanup(self) -> None:
        """Run periodic cleanup of completed tasks"""
        while True:
            try:
                await asyncio.sleep(self.task_store.cleanup_interval)
                await self.task_store.cleanup_tasks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error during cleanup: {str(e)}",
                             extra={'task_id': ' ' * 36, 'stage': 'CLEANUP', 'source': 'async'})
