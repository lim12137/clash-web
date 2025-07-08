import logging
import os
import ray
from typing import List, Dict, Any

from nexent.data_process import DataProcessCore

logger = logging.getLogger(__name__)
NUM_CPUS = os.getenv("RAY_NUM_CPUS", 1)


@ray.remote(num_cpus=NUM_CPUS)
class DataProcessorRayActor:
    """
    Ray actor for handling data processing tasks.
    Encapsulates the DataProcessCore to be used in a Ray cluster.
    """
    def __init__(self):
        logger.info(f"Ray starting using {NUM_CPUS} CPUs...")
        self._processor = DataProcessCore()

    def process_file(self, source: str, chunking_strategy: str, destination: str, task_id: str = None, **params) -> List[Dict[str, Any]]:
        """
        Process a file, auto-detecting its type using DataProcessCore.file_process.

        Args:
            source (str): The file path or URL.
            chunking_strategy (str): The strategy for chunking the file.
            destination (str): The source type of the file, e.g., 'local', 'minio', 'url'.
            task_id (str, optional): The task ID for processing. Defaults to None.
            **params: Additional parameters for the processing task.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries representing the processed chunks.
        """
        logger.info(f"[RayActor] Processing file: {source}, destination: {destination}")
        
        if task_id:
            params['task_id'] = task_id

        chunks = self._processor.file_process(
            file_path_or_url=source,
            chunking_strategy=chunking_strategy,
            destination=destination,
            **params
        )

        if not chunks:
            logger.warning(f"[RayActor] file_process returned no chunks for {source}")
            return []

        logger.debug(f"[RayActor] file_process returned {len(chunks)} chunks, returning as is.")
        return chunks 