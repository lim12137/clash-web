"""
数据处理模块

此模块提供使用Unstructured分区库从各种源清洗数据的功能。
它支持处理文件、URL和文本内容，并提供用于管理清洗任务的简单API。

组件:
- core: 数据处理核心实现
- task_store: 任务存储管理
- async_task_manager: 异步任务管理
- process_worker_pool: 数据处理工作池
"""

# 导出核心组件
from .task_store import TaskStore, TaskStatus
from .process_worker_pool import ProcessWorkerPool
from .async_task_manager import AsyncTaskManager
from .core import DataProcessCore

__all__ = [
    "TaskStore",
    "TaskStatus",
    "ProcessWorkerPool",
    "AsyncTaskManager",
    "DataProcessCore"
] 