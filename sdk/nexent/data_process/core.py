import logging
import os
import time
from typing import Dict, List, Any, Optional

from .async_task_manager import AsyncTaskManager
from .process_worker_pool import ProcessWorkerPool
from .task_store import TaskStore, TaskStatus

logger = logging.getLogger("data_process.core")


class DataProcessCore:
    def __init__(self, num_workers: int = 5):
        """
        Initialize the Data Process Core
        
        Args:
            num_workers: Number of worker threads for parallel processing
        """
        # Initialize components
        self.task_store = TaskStore()
        self.worker_pool = ProcessWorkerPool(max_workers=num_workers)
        self.task_manager = AsyncTaskManager(self.task_store, self.worker_pool)

        # Set task manager in worker pool
        self.worker_pool.set_task_manager(self.task_manager)

        logger.info(f"Data Process Core initialized with {num_workers} workers",
                    extra={'task_id': ' ' * 36, 'stage': 'STARTUP', 'source': 'core'})

    async def start(self) -> None:
        """Start the data process core"""
        await self.task_manager.start()
        logger.info("Data Process Core started", extra={'task_id': ' ' * 36, 'stage': 'STARTUP', 'source': 'core'})

    async def stop(self) -> None:
        """Stop the data process core"""
        await self.task_manager.stop()
        self.worker_pool.shutdown()
        logger.info("Data Process Core stopped", extra={'task_id': ' ' * 36, 'stage': 'SHUTDOWN', 'source': 'core'})

    async def create_task(self, source: str, source_type: str = "file", chunking_strategy: Optional[str] = None,
                          index_name: Optional[str] = None, **kwargs) -> str:
        """
        Create a new data processing task
        
        Args:
            source: Source data (file path, URL, or text)
            source_type: Type of source ("file", "url", or "text")
            chunking_strategy: Strategy for chunking the document
            **kwargs: Additional parameters
            
        Returns:
            Task ID
        """
        # Create task data
        task_data = {"source": source, "source_type": source_type,
            "chunking_strategy": "basic" if chunking_strategy == "" else chunking_strategy, "index_name": index_name}

        # Add additional parameters
        task_data.update(kwargs)

        # Create task
        task_id = await self.task_manager.create_task(task_data)
        logger.info(f"Created new task for source: {source}",
                    extra={'task_id': task_id, 'stage': 'CREATED', 'source': 'core'})
        return task_id

    async def create_batch_tasks(self, sources: List[Dict[str, Any]]) -> List[str]:
        """
        Create multiple data processing tasks in batch
        
        Args:
            sources: List of source dictionaries
            
        Returns:
            List of task IDs
        """
        task_ids = await self.task_manager.create_batch_tasks(sources)
        logger.info(f"Created batch of {len(task_ids)} tasks",
                    extra={'task_id': task_ids[0] if task_ids else ' ' * 36, 'stage': 'BATCH', 'source': 'core'})
        return task_ids

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get task information
        
        Args:
            task_id: Task ID
            
        Returns:
            Task information or None if not found
        """
        return self.task_store.get_task(task_id)

    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """
        Get all tasks
        
        Returns:
            List of all tasks
        """
        return self.task_store.get_all_tasks()

    def get_index_tasks(self, index_name: str) -> Dict[str, Any]:
        """
        Get all active tasks for a specific index
        
        Args:
            index_name: Name of the index
            
        Returns:
            Dictionary containing index name and list of file information
        """
        # Filter for active statuses
        active_statuses = [TaskStatus.WAITING, TaskStatus.PROCESSING, TaskStatus.FORWARDING, TaskStatus.FAILED]
        active_tasks = []

        # Get tasks for each active status
        for status in active_statuses:
            status_tasks = self.task_store.get_status_tasks(status)
            # Filter tasks by index
            index_status_tasks = [task for task in status_tasks if task["data"].get("index_name") == index_name]
            active_tasks.extend(index_status_tasks)

        # Format file information
        files = []
        for task in active_tasks:
            task_data = task["data"]
            source = task_data.get("source", "")
            source_type = task_data.get("source_type", "file")

            file_info = {"path_or_url": source, "file": os.path.basename(source) if source_type == "file" else source,
                "file_size": None, "create_time": None, "status": task["status"].value}

            # Try to get file size and creation time for file type
            if source_type == "file" and os.path.exists(source):
                try:
                    stats = os.stat(source)
                    file_info["file_size"] = stats.st_size // 1024  # Convert to KB
                    file_info["create_time"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stats.st_ctime))
                except Exception as e:
                    logger.warning(f"Could not get file stats for {source}: {str(e)}")

            files.append(file_info)

        return {"index_name": index_name, "files": files}
