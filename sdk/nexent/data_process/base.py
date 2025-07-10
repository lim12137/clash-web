from abc import ABC, abstractmethod
from typing import List, Dict, Optional

class FileProcessor(ABC):
    @abstractmethod
    def process_file(self, file_data: bytes, chunking_strategy: str, filename: Optional[str], path_or_url: Optional[str], **params) -> List[Dict]:
        pass 