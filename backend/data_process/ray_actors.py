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

    def process_file(self, source: str, chunking_strategy: str, source_type: str, task_id: str, **params) -> List[Dict[str, Any]]:
        """Process a generic file."""
        logger.info(f"[RayActor] Processing file: {source}")
        raw_chunks = self._processor._process_file(
            source, chunking_strategy, source_type=source_type, task_id=task_id, **params
        )
        
        if not raw_chunks:
            logger.warning(f"[RayActor] _process_file returned no chunks for {source}")
            return []

        # Inspect the first chunk to determine its type
        first_chunk = raw_chunks[0]
        
        # If it's already a dict, assume it's correctly formatted and return as is.
        if isinstance(first_chunk, dict):
            logger.debug("[RayActor] Chunks are already dicts, returning as is.")
            return raw_chunks

        # If it's an object, convert to dict for serialization.
        logger.debug("[RayActor] Chunks are objects, converting to dicts for serialization.")
        return [
            {"text": chunk.text, "metadata": chunk.metadata.to_dict()}
            for chunk in raw_chunks if hasattr(chunk, 'text') and hasattr(chunk, 'metadata')
        ]

    def process_excel_file(self, source: str, chunking_strategy: str, **params) -> List[Dict[str, Any]]:
        """Process an Excel file."""
        logger.info(f"[RayActor] Processing Excel file: {source}")
        raw_chunks = self._processor.process_excel_file(
            source, chunking_strategy, **params
        )
        
        if not raw_chunks:
            logger.warning(f"[RayActor] _process_excel_file returned no chunks for {source}")
            return []

        # Inspect the first chunk to determine its type
        first_chunk = raw_chunks[0]
        
        # If it's already a dict, assume it's correctly formatted and return as is.
        if isinstance(first_chunk, dict):
            logger.debug("[RayActor] Chunks are already dicts, returning as is.")
            return raw_chunks

        # If it's an object, convert to dict for serialization.
        logger.debug("[RayActor] Chunks are objects, converting to dicts for serialization.")
        return [
            {"text": chunk.text, "metadata": chunk.metadata.to_dict()}
            for chunk in raw_chunks if hasattr(chunk, 'text') and hasattr(chunk, 'metadata')
        ] 