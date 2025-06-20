import os
import logging
import time

import ray

from data_process.tasks import get_ray_actor

logger = logging.getLogger("file_management_service")


class FileManagementService:
    def __init__(self):
        self.ray_actor = get_ray_actor()

    def get_text_from_file(self, source):
        if not os.path.exists(source):
            raise FileNotFoundError(f"File does not exist: {source}")

        file_size = os.path.getsize(source)
        file_size_mb = file_size / (1024 * 1024)

        logger.info(f"PROCESS TASK: File size: {file_size_mb:.2f}MB")

        # Get file extension
        _, file_ext = os.path.splitext(source)
        file_ext = file_ext.lower()

        if file_ext in ['.xlsx', '.xls']:
            # For Excel files, use specialized processor
            chunks_ref = self.ray_actor.process_excel_file.remote(source, chunking_strategy="basic")
        else:
            chunks_ref = self.ray_actor.process_file.remote(
                source, chunking_strategy="basic", source_type=source_type, task_id=task_id,
            )

        chunks = ray.get(chunks_ref)
        return chunks[0].get("text", "") if chunks else ""


file_management_service = FileManagementService()