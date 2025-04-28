import asyncio
import logging
import time
from collections import defaultdict
from enum import Enum
from typing import Dict, List, Optional, Any


# Task status enum
class TaskStatus(str, Enum):
    WAITING = "WAITING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FORWARDING = "FORWARDING"
    FAILED = "FAILED"


# Get logger for task store
logger = logging.getLogger("data_process.task_store")


class TaskStore:
    def __init__(self, cleanup_interval: int = 600):
        """
        Initialize the Task Store
        
        Args:
            cleanup_interval: Interval in seconds to clean up completed tasks
        """
        self.tasks = {}
        self.index_tasks = defaultdict(dict)
        self.status_tasks = defaultdict(dict)
        self.completion_times = {}
        self._lock = asyncio.Lock()  # 异步锁
        self.cleanup_interval = cleanup_interval

        logger.info("Task Store initialized", extra={'task_id': ' ' * 36, 'stage': 'STARTUP', 'source': 'store'})

    def add_task(self, task_id: str, task_data: Dict) -> None:
        """
        Add a new task to the store
        
        Args:
            task_id: Unique identifier for the task
            task_data: Task data dictionary
        """
        # Create task record
        task = {"id": task_id, "status": TaskStatus.WAITING, "created_at": time.time(), "updated_at": time.time(),
            "data": task_data, "result": None, "error": None}

        # Add to main tasks dictionary
        self.tasks[task_id] = task

        # Add to index tasks if index_name is present
        index_name = task_data.get("index_name", "default")
        self.index_tasks[index_name][task_id] = task

        # Add to status tasks - ensure the status exists in the dictionary
        if TaskStatus.WAITING not in self.status_tasks:
            self.status_tasks[TaskStatus.WAITING] = {}
        self.status_tasks[TaskStatus.WAITING][task_id] = task

        logger.info(f"Added new task with ID: {task_id}",
                    extra={'task_id': task_id, 'stage': 'CREATED', 'source': 'store'})

    def update_status(self, task_id: str, status: TaskStatus, result: Any = None, error: str = None) -> bool:
        """
        Update task status
        
        Args:
            task_id: Task ID
            status: New status
            result: Optional result data
            error: Optional error message
            
        Returns:
            True if task was updated, False otherwise
        """
        if task_id not in self.tasks:
            logger.warning(f"Attempted to update non-existent task",
                           extra={'task_id': task_id, 'stage': 'UPDATE', 'source': 'store'})
            return False

        task = self.tasks[task_id]
        old_status = task["status"]

        # Remove from old status tasks
        if old_status in self.status_tasks:
            self.status_tasks[old_status].pop(task_id, None)

        # Update task data
        task["status"] = status
        task["updated_at"] = time.time()

        if result is not None:
            task["result"] = result
        if error is not None:
            task["error"] = error

        # Ensure the new status exists in the dictionary
        if status not in self.status_tasks:
            self.status_tasks[status] = {}

        # Add to new status tasks
        self.status_tasks[status][task_id] = task

        # Update completion time if task is completed
        if status == TaskStatus.COMPLETED:
            self.completion_times[task_id] = time.time()

        logger.info(f"Updated task status from {old_status} to {status}",
                    extra={'task_id': task_id, 'stage': str(status), 'source': 'store'})
        return True

    async def cleanup_tasks(self) -> None:
        """Clean up completed tasks that are older than cleanup_interval"""
        current_time = time.time()
        tasks_to_remove = []

        # Find tasks to remove
        for task_id, completion_time in self.completion_times.items():
            if current_time - completion_time >= self.cleanup_interval:
                tasks_to_remove.append(task_id)

        # Remove tasks
        for task_id in tasks_to_remove:
            task = self.tasks.pop(task_id, None)
            if task:
                # Remove from index tasks
                index_name = task["data"].get("index_name", "default")
                self.index_tasks[index_name].pop(task_id, None)

                # Remove from status tasks
                self.status_tasks[TaskStatus.COMPLETED].pop(task_id, None)

                # Remove from completion times
                self.completion_times.pop(task_id, None)

                logger.info(f"Cleaned up completed task",
                            extra={'task_id': task_id, 'stage': 'CLEANUP', 'source': 'store'})

    def get_task(self, task_id: str) -> Optional[Dict]:
        """
        Get task by ID
        
        Args:
            task_id: Task ID
            
        Returns:
            Task data or None if not found
        """
        return self.tasks.get(task_id)

    def get_all_tasks(self) -> List[Dict]:
        """
        Get all tasks
        
        Returns:
            List of all tasks
        """
        return list(self.tasks.values())

    def get_index_tasks(self, index_name: str) -> List[Dict]:
        """
        Get all tasks for a specific index
        
        Args:
            index_name: Index name
            
        Returns:
            List of tasks for the index
        """
        return list(self.index_tasks[index_name].values())

    def get_status_tasks(self, status: TaskStatus) -> List[Dict]:
        """
        Get all tasks with specific status
        
        Args:
            status: Task status
            
        Returns:
            List of tasks with the status
        """
        return list(self.status_tasks[status].values())

    def get_tasks_by_statuses(self, statuses: List[TaskStatus]) -> List[Dict]:
        """
        Get all tasks with any of the specified statuses
        
        Args:
            statuses: List of task statuses
            
        Returns:
            List of tasks with any of the specified statuses
        """
        tasks = []
        for status in statuses:
            tasks.extend(self.get_status_tasks(status))
        return tasks
