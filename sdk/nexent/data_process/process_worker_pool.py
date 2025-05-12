import logging
import asyncio
from typing import Dict, Any, TYPE_CHECKING
from concurrent.futures import ThreadPoolExecutor

from .task_store import TaskStatus

logger = logging.getLogger("data_process.worker_pool")

if TYPE_CHECKING:
    from .async_task_manager import AsyncTaskManager


class ProcessWorkerPool:
    def __init__(self, max_workers: int):
        """
        Initialize the Process Worker Pool
        
        Args:
            max_workers: Maximum number of worker threads
        """
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.task_manager = None  # Will be set after initialization

        logger.info(f"Process Worker Pool initialized with {max_workers} workers",
                    extra={'task_id': ' ' * 36, 'stage': 'STARTUP', 'source': 'pool'})

    def set_task_manager(self, task_manager: 'AsyncTaskManager') -> None:
        """
        Set the task manager instance
        
        Args:
            task_manager: Async task manager instance
        """
        self.task_manager = task_manager

    def submit(self, task_id: str, task_data: Dict[str, Any]) -> None:
        """
        Submit a task to the worker pool
        
        Args:
            task_id: Task ID
            task_data: Task data dictionary
        """
        self.executor.submit(self._process_task, task_id, task_data)

        logger.info(f"Submitted task to worker pool", extra={'task_id': task_id, 'stage': 'SUBMIT', 'source': 'pool'})

    def _process_task(self, task_id: str, task_data: Dict[str, Any]) -> None:
        """
        Process a task in the worker pool
        
        Args:
            task_id: Task ID
            task_data: Task data dictionary
        """
        try:
            # Update status to processing
            asyncio.run(self.task_manager.update_task_status(task_id=task_id, status=TaskStatus.PROCESSING))

            # Extract task parameters
            source = task_data.get("source")
            source_type = task_data.get("source_type", "file")
            chunking_strategy = task_data.get("chunking_strategy")

            # Extract additional parameters
            kwargs = {k: v for k, v in task_data.items() if k not in ["source", "source_type", "chunking_strategy"]}

            # Process data
            logger.info(f"Processing source: {source} ({source_type})",
                        extra={'task_id': task_id, 'stage': 'PROCESSING', 'source': 'pool'})

            # Process data
            result = self._process_data(source, source_type, chunking_strategy, **kwargs)

            if not result:
                # Update status to completed
                asyncio.run(
                    self.task_manager.update_task_status(task_id=task_id, status=TaskStatus.COMPLETED, result=result))

                logger.info("Task completed successfully",
                            extra={'task_id': task_id, 'stage': 'COMPLETED', 'source': 'pool'})

                return

            # Update status to forwarding
            asyncio.run(
                self.task_manager.update_task_status(task_id=task_id, status=TaskStatus.FORWARDING, result=result))

            # Forward to Elasticsearch
            logger.info("Forwarding data to Elasticsearch",
                        extra={'task_id': task_id, 'stage': 'FORWARDING', 'source': 'pool'})

            self._forward_to_elasticsearch(task_id, result, task_data)

            # Update status to completed
            asyncio.run(
                self.task_manager.update_task_status(task_id=task_id, status=TaskStatus.COMPLETED, result=result))

            logger.info("Task completed successfully",
                        extra={'task_id': task_id, 'stage': 'COMPLETED', 'source': 'pool'})

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Task failed with error: {error_msg}",
                         extra={'task_id': task_id, 'stage': 'FAILED', 'source': 'pool'})

            # Update status to failed
            asyncio.run(
                self.task_manager.update_task_status(task_id=task_id, status=TaskStatus.FAILED, error=error_msg))

    @staticmethod
    def process_data(source: Any) -> list[Dict[str, Any]]:
        """
        Process data from xlsx to markdown data

        Args:
            source: Source data (file path, URL, or text)

        Returns:
            List of processed data items
        """

        from .excel_process import ExcelProcessor
        if isinstance(source, str):
            clean_excel = ExcelProcessor(input_file=source)
        elif isinstance(source, bytes):
            clean_excel = ExcelProcessor(file_data=source)
        elements = clean_excel.process()

        result = []
        for element in elements:
            result.append({"text": element, "metadata": "", "source": "", "source_type": ""})
        return result

    def _process_data(self, source: str, source_type: str, chunking_strategy: str, **kwargs) -> list[Dict[str, Any]]:
        """
        Process data from various sources
        
        Args:
            source: Source data (file path, URL, or text)
            source_type: Type of source ("file", "url", or "text")
            chunking_strategy: Strategy for chunking the document
            **kwargs: Additional parameters
            
        Returns:
            List of processed data items
        """
        # Dynamic imports with error handling
        try:
            from unstructured.partition.auto import partition
            from unstructured.chunking.basic import chunk_elements
        except ImportError:
            raise ImportError(
                "Processing features require additional dependencies. "
                "Please install them with: pip install nexent[process]"
            )

        # Validate source_type
        if source_type not in ["file", "url", "text"]:
            raise ValueError("source_type must be one of: 'file', 'url', 'text'")

        # Set up partition parameters
        partition_kwargs = kwargs.copy()
        if chunking_strategy:
            partition_kwargs["chunking_strategy"] = chunking_strategy

        # Process based on source type
        try:
            if source_type == "file":
                elements = partition(filename=source, max_characters=1500, new_after_n_chars=500, strategy="fast",
                                     infer_table_structure=True, **partition_kwargs)
            elif source_type == "url":
                elements = partition(filename=source, max_characters=1500, new_after_n_chars=500, **partition_kwargs)
            else:  # text
                # For text type, write to temporary file
                import tempfile
                with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as temp_file:
                    temp_file.write(source)
                    temp_path = temp_file.name

                try:
                    elements = partition(filename=source, max_characters=1500, new_after_n_chars=500,
                                         **partition_kwargs)
                finally:
                    import os
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)

            elements = chunk_elements(elements, max_characters=1500, new_after_n_chars=500)

            # Process elements
            result = []
            for element in elements:
                metadata = element.metadata.to_dict()
                result.append(
                    {"text": element.text, "metadata": metadata, "source": source, "source_type": source_type})

            return result

        except Exception as e:
            raise ValueError(f"Error processing document: {str(e)}")

    def _forward_to_elasticsearch(self, task_id: str, result: list[Dict[str, Any]], task_data: Dict[str, Any]) -> None:
        """
        Forward processed data to Elasticsearch
        
        Args:
            task_id: Task ID
            result: Processed data
            task_data: Task data dictionary
        """
        import httpx
        import os

        # Get Elasticsearch service URL
        es_service_url = os.environ.get("ELASTICSEARCH_SERVICE", "http://localhost:8000")
        index_name = task_data.get("index_name", "knowledge_base")

        # Prepare payload
        payload = {"task_id": task_id, "index_name": index_name, "results": result}

        # Send request to Elasticsearch service
        with httpx.Client(timeout=600.0) as client:
            try:
                response = client.post(f"{es_service_url}/indices/{index_name}/documents", json=payload, timeout=500.0)
                response.raise_for_status()

                logger.info(f"Successfully indexed {response.json().get('total_indexed', 0)} documents",
                            extra={'task_id': task_id, 'stage': 'FORWARDING', 'source': 'pool'})

            except httpx.HTTPStatusError as e:
                raise ValueError(
                    f"HTTP error during Elasticsearch indexing ({e.response.status_code}): {e.response.text}")
            except httpx.TimeoutException:
                raise ValueError("Timeout during Elasticsearch indexing")
            except Exception as e:
                raise ValueError(f"Unexpected error during Elasticsearch indexing: {str(e)}")

    def shutdown(self) -> None:
        """Shutdown the worker pool"""
        self.executor.shutdown()
        logger.info("Process Worker Pool shutdown complete",
                    extra={'task_id': ' ' * 36, 'stage': 'SHUTDOWN', 'source': 'pool'})
