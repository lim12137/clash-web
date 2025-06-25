import logging
import os
import time
from typing import Dict, List

# Import for Excel processing
from .excel_process import process_excel_file

# Setup logging
logger = logging.getLogger("data_process.core")
logger.setLevel(logging.DEBUG)

class DataProcessCore:
    """Core data processing functionality with distributed processing capabilities"""

    def __init__(self):
        """
        Initialize data processing core
        
        Args:
            No arguments
        """


    def process_excel_file(self, file_path: str, chunking_strategy: str = "basic", **params) -> List[Dict]:
        """
        Process an Excel file and return chunks in the expected format
        
        Args:
            file_path: Path to the Excel file
            chunking_strategy: Strategy for chunking (not used in Excel processing)
            **params: Additional parameters
            
        Returns:
            List of processed chunks in standard format
        """
        logger.info(f"Processing Excel file {file_path}")
        
        # Process Excel file using the excel_process module which now returns proper chunks
        chunks = process_excel_file(file_path, chunking_strategy, **params)
        
        logger.info(f"Processed Excel file {file_path}: {len(chunks)} chunks")
        return chunks
    
    async def process_file(self, file_path: str, chunking_strategy: str, **params) -> List[Dict]:
        """
        Process a file using specified chunking strategy
        
        Args:
            file_path: Path to the file to process
            chunking_strategy: Strategy for chunking the data, could be chosen from basic/by_title/none
            **params: Additional parameters for processing
            
        Returns:
            List of processed chunks
        """
        logger.info(f"Processing file {file_path} with strategy {chunking_strategy}")
        
        # Process the file based on its type
        _, file_ext = os.path.splitext(file_path)
        file_ext = file_ext.lower()
        
        if file_ext in ['.xlsx', '.xls']:
            return await self._process_excel(file_path, chunking_strategy, **params)
        else:
            # For text and other files
            return await self._process_generic_file(file_path, chunking_strategy, **params)
    
    async def _process_excel(self, file_path: str, chunking_strategy: str, **params) -> List[Dict]:
        """Process Excel files using the excel_process module"""
        logger.info(f"Processing Excel file {file_path}")
        return process_excel_file(file_path, chunking_strategy, **params)
    
    async def _process_generic_file(self, file_path: str, chunking_strategy: str, **params) -> List[Dict]:
        """Process generic files"""
        chunks = self._process_file(file_path, chunking_strategy, **params)
        
        return chunks


    def _process_file(self, file_path: str, chunking_strategy: str, **params) -> List[Dict]:
        """
        Args:
            file_path: Path to the file to process
            chunking_strategy: Strategy for chunking the data, could be chosen from basic/by_title/none
            **params: Additional parameters for processing
            
        Returns:
            List of processed chunks
        """
        # Extract parameters with defaults
        max_characters = params.get("max_characters", 1500)  # Only useful under basic chunking_strategy
        new_after_n_chars = params.get("new_after_n_chars", 1200)  # Only useful under basic chunking_strategy
        strategy = params.get("strategy", "fast")
        skip_infer_table_types = params.get("skip_infer_table_types", [])  # Only useful under hi-res strategy
        source_type = params.get("source_type", "file")
        task_id = params.get("task_id", "unknown")
        
        # Dynamic imports with error handling
        try:
            from unstructured.partition.auto import partition
            from unstructured.file_utils.filetype import detect_filetype
        except ImportError:
            raise ImportError(
                "Processing features require additional dependencies. "
                "Please install them with: pip install nexent[process]"
            )
        
        start_time = time.time()
        
        try:
            # Log start of processing
            logger.debug(f"Starting to process file: {file_path}", 
                      extra={'task_id': task_id, 'stage': 'PROCESSING', 'source': 'local'})
            
            # Debug info about the file
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                logger.debug(f"File exists, size: {file_size} bytes", 
                          extra={'task_id': task_id, 'stage': 'DEBUG', 'source': 'local'})
                
                # Check file type
                try:
                    filetype = detect_filetype(file_path=file_path)
                    logger.debug(f"Detected file type: {filetype}", 
                              extra={'task_id': task_id, 'stage': 'DEBUG', 'source': 'local'})
                    
                    # Skip unsupported file types
                    unsupported_types = ["image", "audio", "video", "unknown"]
                    if filetype in unsupported_types:
                        logger.warning(f"Skipping unsupported file type {filetype}: {file_path}", 
                                     extra={'task_id': task_id, 'stage': 'WARNING', 'source': 'local'})
                        return []  # Return empty list for unsupported files
                except Exception as e:
                    logger.warning(f"Could not detect file type: {str(e)}", 
                                 extra={'task_id': task_id, 'stage': 'WARNING', 'source': 'local'})
            else:
                logger.error(f"File does not exist: {file_path}", 
                           extra={'task_id': task_id, 'stage': 'ERROR', 'source': 'local'})
                raise FileNotFoundError(f"File does not exist: {file_path}")
            
            # Process file based on source type
            if source_type == "file":
                logger.debug(f"Starting partition with strategy={strategy}, max_chars={max_characters}", 
                          extra={'task_id': task_id, 'stage': 'DEBUG', 'source': 'local'})
                elements = partition(
                    filename=file_path, 
                    max_characters=max_characters, 
                    new_after_n_chars=new_after_n_chars, 
                    strategy=strategy,
                    skip_infer_table_types=skip_infer_table_types,
                    chunking_strategy=chunking_strategy if chunking_strategy != "none" else None
                )
                logger.debug(f"Partition complete, got {len(elements)} elements", 
                          extra={'task_id': task_id, 'stage': 'DEBUG', 'source': 'local'})
            else:
                # Handle other source types
                raise ValueError(f"Source type {source_type} not supported for local processing")
            
            # If "none" strategy, combine all elements into a single chunk
            if chunking_strategy == "none":
                full_text = "\n\n".join([el.text for el in elements])
                doc = {
                    "content": full_text,
                    "path_or_url": file_path,
                    "filename": os.path.basename(file_path),
                }
                # Try to get language from the first element's metadata
                if elements and hasattr(elements[0], 'metadata'):
                    languages = elements[0].metadata.to_dict().get("languages")
                    if languages:
                        doc["language"] = languages[0]
                return [doc]
            
            # Process elements
            result = []
            for element in elements:
                metadata = element.metadata.to_dict()
                doc = {
                    "content": element.text,
                    "path_or_url": file_path,
                    "filename": metadata.get("filename", os.path.basename(file_path)),
                }
                
                # Add language if available in metadata, as it's in the ES mapping
                languages = metadata.get("languages")
                if languages:
                    doc["language"] = languages[0]
                
                result.append(doc)
            
            processing_time = time.time() - start_time
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            size_mb = file_size / (1024 * 1024)
            
            logger.info(f"Completed processing file: {file_path} in {processing_time:.2f}s, " 
                       f"elements: {len(elements)}, size: {size_mb:.2f}MB, " 
                       f"speed: {size_mb/processing_time:.2f}MB/s",
                       extra={'task_id': task_id, 'stage': 'COMPLETED', 'source': 'local'})
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {str(e)}", 
                        extra={'task_id': task_id, 'stage': 'ERROR', 'source': 'local'})
            raise  # Re-raise the exception to be handled by the caller
