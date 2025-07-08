import logging
import os
from typing import Dict, List, Optional, Union
from .generic_file_process import GenericFileProcess
from .excel_file_process import ExcelFileProcess

logger = logging.getLogger("data_process.core")
logger.setLevel(logging.DEBUG)


class DataProcessCore:
    """
    Core data processing functionality class with distributed processing capabilities
    
    Supported file types:
    - Excel files: .xlsx, .xls
    - Generic files: .txt, .pdf, .docx, .doc, .html, .htm, .md, .rtf, .odt, .pptx, .ppt
    
    Supported input methods:
    - Local file path
    - Remote URL (requires database dependencies)
    - In-memory byte data
    """

    # Supported Excel file extensions
    EXCEL_EXTENSIONS = {".xlsx", ".xls"}
    
    # Supported chunking strategies
    CHUNKING_STRATEGIES = {"basic", "by_title", "none"}
    
    # Supported destination types
    DESTINATIONS = {"local", "minio", "url"}

    def __init__(self):
        """
        Initialize the core data processing component
        """
        self._generic = GenericFileProcess()
        self._excel = ExcelFileProcess()
        logger.debug("DataProcessCore initialization completed")

    def file_process(self, 
                    file_path_or_url: Optional[str] = None, 
                    file_data: Optional[bytes] = None, 
                    chunking_strategy: str = "basic", 
                    destination: str = "local", 
                    filename: Optional[str] = None, 
                    **params) -> List[Dict]:
        """
        Facade pattern that automatically detects file type and processes files
        
        Args:
            file_path_or_url: Local file path or file URL in MinIO
            file_data: File content byte data (for in-memory processing)
            chunking_strategy: Chunking strategy, options: "basic", "by_title", "none"
            destination: Destination type, options: "local", "minio", "url"
            filename: Optional filename, required when providing file_data
            **params: Additional processing parameters
            
        Returns:
            List of processed chunks, each dictionary contains the following fields:
            - content: Text content
            - path_or_url: File path or URL
            - filename: Filename
            - metadata: Metadata (optional, includes chunk_index, source_type, etc.)
            - language: Language identifier (optional)
            
        Raises:
            ValueError: Invalid parameters
            FileNotFoundError: File not found
            ImportError: Missing required dependencies
        """
        # Parameter validation
        self._validate_parameters(file_path_or_url, file_data, chunking_strategy, destination, filename)
        
        # Determine filename and extension
        resolved_filename, file_extension = self._resolve_filename_and_extension(
            file_path_or_url, filename
        )
        
        # Select appropriate processor
        processor = self._select_processor(file_extension)
        
        # Route to correct processing method
        return self._route_processing(
            processor, file_path_or_url, file_data, destination, 
            chunking_strategy, resolved_filename, **params
        )
    
    def _validate_parameters(self, 
                           file_path_or_url: Optional[str], 
                           file_data: Optional[bytes], 
                           chunking_strategy: str, 
                           destination: str, 
                           filename: Optional[str]) -> None:
        """Validate input parameters"""
        # Check input source
        if not file_path_or_url and not file_data:
            raise ValueError("Must provide either 'file_path_or_url' or 'file_data'")
        
        if file_path_or_url and file_data:
            raise ValueError("'file_path_or_url' and 'file_data' cannot be provided simultaneously")
        
        # Check chunking strategy
        if chunking_strategy not in self.CHUNKING_STRATEGIES:
            raise ValueError(f"Unsupported chunking strategy: {chunking_strategy}. "
                           f"Supported strategies: {', '.join(self.CHUNKING_STRATEGIES)}")
        
        # Check destination type
        if destination not in self.DESTINATIONS:
            raise ValueError(f"Unsupported destination type: {destination}. "
                           f"Supported types: {', '.join(self.DESTINATIONS)}")
        
        # Check filename (when using file_data)
        if file_data and not filename:
            raise ValueError("filename must be provided when using file_data")
        
        logger.debug(f"Parameter validation passed: chunking_strategy={chunking_strategy}, destination={destination}")
    
    def _resolve_filename_and_extension(self, 
                                      file_path_or_url: Optional[str], 
                                      filename: Optional[str]) -> tuple[str, str]:
        """Resolve filename and extension"""
        resolved_filename = None
        file_extension = ""
        
        if file_path_or_url:
            _, file_extension = os.path.splitext(file_path_or_url)
            if not resolved_filename:
                resolved_filename = os.path.basename(file_path_or_url)
        
        if filename:
            _, ext_from_filename = os.path.splitext(filename)
            if ext_from_filename:  # If filename contains extension, use it with priority
                file_extension = ext_from_filename
            resolved_filename = filename
        
        file_extension = file_extension.lower()
        
        logger.debug(f"Resolution result: filename={resolved_filename}, extension={file_extension}")
        return resolved_filename, file_extension
    
    def _select_processor(self, file_extension: str) -> Union[ExcelFileProcess, GenericFileProcess]:
        """Select processor based on file extension"""
        is_excel = file_extension in self.EXCEL_EXTENSIONS
        processor = self._excel if is_excel else self._generic
        
        return processor
    
    def _route_processing(self, 
                         processor: Union[ExcelFileProcess, GenericFileProcess],
                         file_path_or_url: Optional[str],
                         file_data: Optional[bytes],
                         destination: str,
                         chunking_strategy: str,
                         filename: str,
                         **params) -> List[Dict]:
        """Route to correct processing method based on input type"""
        try:
            if destination == 'local' and file_path_or_url:
                # Process local file
                logger.info(f"Processing local file: {file_path_or_url}")
                return processor.process_local_file(file_path_or_url, chunking_strategy, **params)
            
            elif destination == 'minio' and file_data:
                # Process file in memory
                logger.info(f"Processing in-memory file: {filename}")
                return processor.process_minio_file(
                    file_data, chunking_strategy, 
                    filename=filename, path_or_url=file_path_or_url, **params
                )
            
            elif destination != 'local' and file_path_or_url:
                # Fetch file from URL and process
                logger.info(f"Fetching and processing file from URL: {file_path_or_url}")
                file_bytes = self._fetch_file_from_url(file_path_or_url)
                return processor.process_minio_file(
                    file_bytes, chunking_strategy, 
                    filename=filename, path_or_url=file_path_or_url, **params
                )
            
            else:
                raise ValueError(f"Invalid parameter combination: destination={destination}, file_path_or_url={file_path_or_url}, file_data given? {file_data is not None}")
                
        except Exception as e:
            logger.error(f"File processing failed: {str(e)}")
            raise
    
    def _fetch_file_from_url(self, url: str) -> bytes:
        """Fetch file content from URL"""
        try:
            from database.attachment_db import get_file_stream
        except ImportError:
            raise ImportError(
                "Processing files from URL requires database dependencies. "
                "Please install related dependencies or use local file/in-memory data processing."
            )

        file_stream = get_file_stream(url)
        if file_stream is None:
            raise FileNotFoundError(f"Unable to fetch file from URL: {url}")
        
        return file_stream.read()
    
    def get_supported_file_types(self) -> Dict[str, List[str]]:
        """
        Get supported file types
        
        Returns:
            Dictionary containing supported file types:
            - excel: List of Excel file extensions
            - generic: List of generic file extensions
        """
        return {
            "excel": list(self.EXCEL_EXTENSIONS),
            "generic": self._generic.get_supported_formats() if hasattr(self._generic, 'get_supported_formats') else [
                '.txt', '.pdf', '.docx', '.doc', '.html', '.htm', 
                '.md', '.rtf', '.odt', '.pptx', '.ppt'
            ]
        }
    
    def get_supported_strategies(self) -> List[str]:
        """
        Get supported chunking strategies
        
        Returns:
            List of supported chunking strategies
        """
        return list(self.CHUNKING_STRATEGIES)
    
    def get_supported_destinations(self) -> List[str]:
        """
        Get supported destination types
        
        Returns:
            List of supported destination types
        """
        return list(self.DESTINATIONS)
    
    def validate_file_type(self, filename: str) -> bool:
        """
        Validate if file type is supported
        
        Args:
            filename: Filename
            
        Returns:
            Whether the file type is supported
        """
        if not filename:
            return False
        
        _, ext = os.path.splitext(filename.lower())
        supported_types = self.get_supported_file_types()
        
        return (ext in supported_types["excel"] or 
                ext in supported_types["generic"])
    
    def get_processor_info(self, filename: str) -> Dict[str, str]:
        """
        Get processor information for the file
        
        Args:
            filename: Filename
            
        Returns:
            Processor information dictionary containing:
            - processor_type: Processor type ("excel" or "generic")
            - file_extension: File extension
            - is_supported: Whether it's supported
        """
        _, ext = os.path.splitext(filename.lower()) if filename else ("", "")
        
        processor_type = "excel" if ext in self.EXCEL_EXTENSIONS else "generic"
        is_supported = self.validate_file_type(filename)
        
        return {
            "processor_type": processor_type,
            "file_extension": ext,
            "is_supported": is_supported
        }