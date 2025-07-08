from abc import ABC, abstractmethod
from typing import List, Dict

class FileProcess(ABC):
    @abstractmethod
    def process_local_file(self, file_path: str, chunking_strategy: str, **params) -> List[Dict]:
        pass

    @abstractmethod
    def process_minio_file(self, file_data: bytes, chunking_strategy: str, filename: str = None, path_or_url: str = None, **params) -> List[Dict]:
        pass 