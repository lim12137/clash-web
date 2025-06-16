"""
Celery tasks for data processing and vector storage
"""
import logging
import os
import json
import time
import traceback
import aiohttp
import asyncio
import ray
from typing import Dict, List, Any, Optional
from celery import chain, Task, states

from .ray_actors import DataProcessorRayActor
from .app import app
from utils.file_management_utils import get_file_size

# Configure logging
logger = logging.getLogger("data_process.tasks")


def run_async(coro):
    """
    Safely run async coroutine in Celery task context
    Handles existing event loops and avoids conflicts
    """
    try:
        # Check if we're already in an async context
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No running loop, safe to use asyncio.run
            return asyncio.run(coro)
        
        # We're in an existing event loop context
        if loop.is_running():
            # Try to use nest_asyncio for compatibility
            try:
                import nest_asyncio
                nest_asyncio.apply()
                return loop.run_until_complete(coro)
            except ImportError:
                logger.warning("nest_asyncio not available, creating new thread for async operation")
                # Fallback: run in a new thread
                import concurrent.futures
                import threading
                
                def run_in_thread():
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        return new_loop.run_until_complete(coro)
                    finally:
                        new_loop.close()
                        asyncio.set_event_loop(None)
                
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(run_in_thread)
                    return future.result()
        else:
            # Loop exists but not running, safe to use run_until_complete
            return loop.run_until_complete(coro)
            
    except Exception as e:
        logger.error(f"Error running async coroutine: {str(e)}")
        raise


# Initialize the data processing core LAZILY
# This will be initialized on first task run by a worker process
def get_ray_actor() -> DataProcessorRayActor:
    """
    Creates or gets a handle to the named DataProcessorRayActor.
    This is an idempotent operation, safe from race conditions.
    """
    # Use get_if_exists=True to make this operation idempotent.
    # This will create the actor if it doesn't exist, or get a handle to it if it does.
    # This is safe to be called from multiple workers concurrently.
    actor = DataProcessorRayActor.options(
        name="data_processor_actor",
        lifetime="detached",
        get_if_exists=True
    ).remote()
    
    logger.debug("Successfully obtained handle for DataProcessorRayActor.")
    return actor

class LoggingTask(Task):
    """Base task class with enhanced logging"""
    
    def on_success(self, retval, task_id, args, kwargs):
        """Log successful task completion"""
        logger.debug(f"Task {self.name}[{task_id}] completed successfully")
        return super().on_success(retval, task_id, args, kwargs)
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Log task failure with enhanced error handling"""
        logger.error(f"Task {self.name}[{task_id}] failed: {exc}")
        # Log exception details for debugging
        if hasattr(exc, '__class__'):
            exc_type = exc.__class__.__name__
            exc_msg = str(exc)
            logger.error(f"Exception type: {exc_type}, message: {exc_msg}")
        # Let Celery handle the exception serialization automatically
        return super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Log task retry"""
        logger.warning(f"Task {self.name}[{task_id}] retrying: {exc}")
        return super().on_retry(exc, task_id, args, kwargs, einfo)

@app.task(bind=True, base=LoggingTask, name='data_process.tasks.process', queue='process_q')
def process(self, source: str, source_type: str = "file", 
            chunking_strategy: str = "basic", index_name: str = None, **params) -> Dict:
    """
    Process a file and extract text/chunks
    
    Args:
        source: Source file path, URL, or text content
        source_type: Type of source ("file", "url", or "text")
        chunking_strategy: Strategy for chunking the document
        index_name: Name of the index (for metadata)
        **params: Additional parameters
    """
    start_time = time.time()
    task_id = self.request.id
    
    self.update_state(
        state=states.PENDING,
        meta={
            'source': source,
            'source_type': source_type,
            'index_name': index_name,
            'task_name': 'process',
            'start_time': start_time
        }
    )
    
    self.update_state(
        state=states.STARTED,
        meta={
            'source': source,
            'source_type': source_type,
            'index_name': index_name,
            'task_name': 'process',
            'start_time': start_time,
            'stage': 'extracting_text'
        }
    )
    # Get the data processor instance
    actor = get_ray_actor()
    
    try:
        # Process the file based on the source type
        if source_type == "file":
            # Check file existence and size for optimization
            if not os.path.exists(source):
                raise FileNotFoundError(f"File does not exist: {source}")
            
            file_size = os.path.getsize(source)
            file_size_mb = file_size / (1024 * 1024)
            
            logger.info(f"[{self.request.id}] PROCESS TASK: File size: {file_size_mb:.2f}MB")
            
            # Get file extension
            _, file_ext = os.path.splitext(source)
            file_ext = file_ext.lower()
            
            if file_ext in ['.xlsx', '.xls']:
                # For Excel files, use specialized processor
                chunks_ref = actor.process_excel_file.remote(source, chunking_strategy, **params)
            else:                
                chunks_ref = actor.process_file.remote(source, chunking_strategy, 
                                                    source_type=source_type, task_id=task_id, 
                                                    **params)

            chunks = ray.get(chunks_ref)
                
            end_time = time.time()
            elapsed_time = end_time - start_time
            processing_speed = file_size_mb / elapsed_time if file_size_mb > 0 else 0
            logger.info(f"[{self.request.id}] PROCESS TASK: File processing completed. Processing speed {processing_speed:.2f} MB/s")
                
        else:
            # For other source types, implement accordingly
            raise NotImplementedError(f"Source type '{source_type}' not yet supported")

        # Update task state to SUCCESS with metadata
        self.update_state(
            state=states.SUCCESS,
            meta={
                'chunks_count': len(chunks),
                'processing_time': elapsed_time,
                'source': source,
                'index_name': index_name,
                'task_name': 'process',
                'stage': 'text_extracted',
                'file_size_mb': file_size_mb,
                'processing_speed_mb_s': file_size_mb / elapsed_time if elapsed_time > 0 else 0
            }
        )
            
        logger.info(f"[{self.request.id}] PROCESS TASK: Successfully processed {len(chunks)} chunks in {elapsed_time:.2f}s")
        
        # Prepare data for the next task in the chain
        returned_data = {
            'chunks': chunks,
            'source': source,
            'index_name': index_name,
            'task_id': task_id 
        }

        return returned_data
        
    except Exception as e:
        logger.error(f"Error processing file {source}: {str(e)}")
        
        # Update task state with custom metadata, but don't put exception info in meta
        # Let Celery handle the exception serialization automatically
        self.update_state(
            state=states.FAILURE,
            meta={
                'source': source,
                'index_name': index_name,
                'task_name': 'process',
                'custom_error': str(e),  # Use custom_error to avoid Celery confusion
                'stage': 'processing_failed'
            }
        )
        
        # Re-raise the exception to let Celery handle exception serialization
        raise

@app.task(bind=True, base=LoggingTask, name='data_process.tasks.forward', queue='forward_q')
def forward(self, processed_data: Dict, index_name: str = None, source: str = None) -> Dict: # Parameter changed from obj_ref_hex to processed_data
    """
    Vectorize and store processed chunks in Elasticsearch
    
    Args:
        processed_data: Dict containing chunks and metadata
        index_name: Name of the index to store documents
        source: Original source path (for metadata)
        
    Returns:
        Dict containing storage results and metadata
    """
    start_time = time.time()
    task_id = self.request.id
    source_type = 'file'  # Default to file type
    
    # Extract data from processed_data
    chunks = processed_data.get('chunks')
    original_source = processed_data.get('source', source)
    original_index_name = processed_data.get('index_name', index_name)
        
    logger.info(f"[{self.request.id}] FORWARD TASK: Received data for source '{original_source}' with {len(chunks) if chunks else 'None'} chunks")
    
    # Update task state to FORWARDING
    self.update_state(
        state=states.STARTED,
        meta={
            'source': original_source,
            'index_name': original_index_name,
            'task_name': 'forward',
            'start_time': start_time,
            'stage': 'vectorizing_and_storing'
        }
    )
    
    try:
        
        if chunks is None:
            logger.error(f"[{self.request.id}] FORWARD TASK: No chunks received in forward task for source {original_source}")
            raise Exception("No chunks received for forwarding")
        
        if len(chunks) == 0:
            logger.warning(f"[{self.request.id}] FORWARD TASK: Empty chunks list received for source {original_source}")
            # Still proceed but log the warning
        
        # Format the chunks for Elasticsearch
        formatted_chunks = []
        for i, chunk in enumerate(chunks):
            # Extract text and metadata
            text = chunk.get("text", "")
            metadata = chunk.get("metadata", {})
            
            # Validate chunk content
            if not text or len(text.strip()) == 0:
                logger.warning(f"[{self.request.id}] FORWARD TASK: Chunk {i+1} has empty text content, skipping")
                continue
            
            # Format as expected by the Elasticsearch API
            formatted_chunk = {
                "metadata": metadata,
                "filename": os.path.basename(original_source) if original_source else "",
                "path_or_url": original_source,
                "content": text,
                "process_source": "Unstructured",  # permanently use default source
                "source_type": source_type,
                "file_size": get_file_size(source_type, original_source),
                "create_time": metadata.get("creation_date"),
                "date": metadata.get("date"),
            }
            formatted_chunks.append(formatted_chunk)
        
        if len(formatted_chunks) == 0:
            logger.error(f"[{self.request.id}] FORWARD TASK: No valid chunks to forward after formatting for source {original_source}")
            raise Exception("No valid chunks to forward after formatting")
        
        # Call the Elasticsearch API to index the documents
        async def index_documents():
            elasticsearch_url = os.environ.get("ELASTICSEARCH_SERVICE") 
            route_url = f"/indices/{original_index_name}/documents"
            full_url = elasticsearch_url + route_url
            headers = {"Content-Type": "application/json"}
            
            logger.info(f"[{self.request.id}] FORWARD TASK: About to send request to {full_url}")
            logger.debug(f"[{self.request.id}] FORWARD TASK: First chunk: {formatted_chunks[0] if formatted_chunks else 'No chunks'}")
            
            # Add retry logic for network errors and ES service issues
            max_retries = 5  # Increased retries for ES service issues
            retry_delay = 5  # Increased delay for ES service recovery
            
            for retry in range(max_retries):
                try:
                    connector = aiohttp.TCPConnector(verify_ssl=False)
                    timeout = aiohttp.ClientTimeout(total=120)  # Increased timeout for large documents
                    
                    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
                        async with session.post(
                            full_url, 
                            headers=headers,
                            json=formatted_chunks,
                            raise_for_status=True
                        ) as response:
                            result = await response.json()

                            return result
                            
                except aiohttp.ClientResponseError as e:
                    if e.status == 503:
                        logger.warning(f"[{self.request.id}] FORWARD TASK: ElasticSearch service unavailable (503) for {full_url}. Retry {retry + 1}/{max_retries}")
                        if retry < max_retries - 1:
                            wait_time = retry_delay * (retry + 1)
                            logger.warning(f"[{self.request.id}] FORWARD TASK: Waiting {wait_time}s before retry due to ES service unavailable...")
                            await asyncio.sleep(wait_time)
                        else:
                            logger.error(f"[{self.request.id}] FORWARD TASK: ElasticSearch service remained unavailable after {max_retries} attempts")
                            raise Exception(f"ElasticSearch service unavailable after {max_retries} attempts: {str(e)}")
                    else:
                        logger.error(f"[{self.request.id}] FORWARD TASK: HTTP error {e.status} to {full_url}: {str(e)}")
                        raise Exception(f"HTTP error {e.status}: {str(e)}")
                        
                except aiohttp.ClientConnectorError as e:
                    logger.error(f"[{self.request.id}] FORWARD TASK: Connection error to {full_url}: {str(e)}")
                    if retry < max_retries - 1:
                        wait_time = retry_delay * (retry + 1)
                        logger.warning(f"[{self.request.id}] FORWARD TASK: Connection error when indexing documents: {str(e)}. Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"[{self.request.id}] FORWARD TASK: Failed to connect to API after {max_retries} attempts: {str(e)}")
                        raise Exception(f"Failed to connect to API after {max_retries} attempts: {str(e)}")
                        
                except asyncio.TimeoutError as e:
                    logger.error(f"[{self.request.id}] FORWARD TASK: Timeout error to {full_url}: {str(e)}")
                    if retry < max_retries - 1:
                        wait_time = retry_delay * (retry + 1)
                        logger.warning(f"[{self.request.id}] FORWARD TASK: Timeout when indexing documents: {str(e)}. Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"[{self.request.id}] FORWARD TASK: Timeout after {max_retries} attempts: {str(e)}")
                        raise Exception(f"Timeout after {max_retries} attempts: {str(e)}")
                        
                except Exception as e:
                    logger.error(f"[{self.request.id}] FORWARD TASK: Unexpected error when indexing documents: {str(e)}")
                    if retry < max_retries - 1:
                        wait_time = retry_delay * (retry + 1)
                        logger.warning(f"[{self.request.id}] FORWARD TASK: Unexpected error when indexing documents: {str(e)}. Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        raise
        
        # Run the async function
        try:
            es_result = run_async(index_documents())
            logger.debug(f"[{self.request.id}] FORWARD TASK: API response from main_server for source '{original_source}': {es_result}")

            # Check the custom response from main_server
            if isinstance(es_result, dict) and es_result.get("success") == True:
                total_indexed = es_result.get("total_indexed", 0)
                total_submitted = es_result.get("total_submitted", len(formatted_chunks)) # Fallback to submitted count
                logger.debug(f"[{self.request.id}] FORWARD TASK: main_server reported {total_indexed}/{total_submitted} documents indexed successfully for '{original_source}'. Message: {es_result.get('message')}")
                
                if total_indexed < total_submitted:
                    error_message = f"Failure reported by main_server. Expected {total_submitted} chunks, indexed {total_indexed} chunks."
                    logger.warning(f"[{self.request.id}] FORWARD TASK: {error_message} for '{original_source}'.")
                    # Update task state for partial success to FAILURE
                    self.update_state(
                        state=states.FAILURE,
                        meta={
                            'chunks_stored': total_indexed,
                            'chunks_failed': total_submitted - total_indexed,
                            'storage_time': time.time() - start_time,
                            'source': original_source,
                            'index_name': original_index_name,
                            'task_name': 'forward',
                            'es_result': es_result,
                            'custom_error': error_message,
                            'stage': 'completed_with_partial_failure'
                        }
                    )
                    raise Exception(error_message)

            elif isinstance(es_result, dict) and es_result.get("success") == False:
                error_message = es_result.get("message", "Unknown error from main_server")
                logger.error(f"[{self.request.id}] FORWARD TASK: main_server reported failure for source '{original_source}': {error_message}")
                self.update_state(
                    state=states.FAILURE,
                    meta={
                        'source': original_source,
                        'index_name': original_index_name,
                        'task_name': 'forward',
                        'custom_error': f"main_server API error: {error_message}",
                        'es_result': es_result,
                        'stage': 'main_server_api_failed'
                    }
                )
                raise Exception(f"main_server API error: {error_message}")
            else:
                 logger.error(f"[{self.request.id}] FORWARD TASK: Unexpected API response format from main_server for source '{original_source}': {es_result}")
                 self.update_state(
                    state=states.FAILURE,
                    meta={
                        'source': original_source,
                        'index_name': original_index_name,
                        'task_name': 'forward',
                        'custom_error': "Unexpected API response format from main_server",
                        'es_result': es_result,
                        'stage': 'api_response_format_error'
                    }
                )
                 raise Exception("Unexpected API response format from main_server")

        except Exception as e:
            # This will catch errors from run_async(index_documents()) call itself (e.g. network issues to main_server)
            # or errors raised by the logic above (e.g. if main_server reports success:false)
            logger.error(f"Error during indexing call to main_server or processing its response: {str(e)}")
            # Ensure state is updated; if it was already updated by the logic above, this might overwrite it,
            # but it is important to capture this level of error too.
            current_meta = self.AsyncResult(self.request.id).info or {}
            current_meta.update({
                'source': original_source,
                'index_name': original_index_name,
                'task_name': 'forward',
                'custom_error': f"Forwarding to main_server failed: {str(e)}",
                'stage': 'forwarding_failed'
            })
            self.update_state(state=states.FAILURE, meta=current_meta)
            raise # Re-raise the exception to mark Celery task as FAILED
        
        end_time = time.time()
        # Default success state update, will be overridden if specific error/partial success states were set above
        # Only update to fully COMPLETED if no errors were caught and handled above that set a different state.
        current_task_state_result = self.AsyncResult(self.request.id)
        if current_task_state_result.state == states.STARTED:
            self.update_state(
                state=states.SUCCESS,
                meta={
                    'chunks_stored': len(chunks), # This assumes all chunks sent to main_server were stored if success=true
                    'storage_time': end_time - start_time,
                    'source': original_source,
                    'index_name': original_index_name,
                    'task_name': 'forward',
                    'es_result': es_result,
                    'stage': 'completed'
                }
            )
        
        logger.info(f"Stored {len(chunks)} chunks to index {original_index_name} in {end_time - start_time:.2f}s")
        
        return {
            'task_id': task_id,
            'source': original_source,
            'index_name': original_index_name,
            'chunks_stored': len(chunks),
            'storage_time': end_time - start_time,
            'es_result': es_result
        }
        
    except Exception as e:
        logger.error(f"Error forwarding chunks to index {original_index_name}: {str(e)}")
        
        # Update task state to FAILURE with custom metadata
        self.update_state(
            state=states.FAILURE,
            meta={
                'source': original_source,
                'index_name': original_index_name,
                'task_name': 'forward',
                'custom_error': str(e),
                'stage': 'forward_task_failed'
            }
        )
        
        # Retry logic as per requirements document
        if self.request.retries < 3:
            logger.warning(f"Retrying forward task {self.request.id} (attempt {self.request.retries + 1}/3)")
            raise self.retry(countdown=60, max_retries=3)
        else:
            logger.error(f"Max retries exceeded for forward task {self.request.id}")
            # Re-raise the original exception after max retries, let Celery handle serialization
            raise
    finally:
        if chunks is not None:
            del chunks  # Delete local reference
            logger.info(f"Cleaned up local references for task {task_id}")

@app.task(bind=True, base=LoggingTask, name='data_process.tasks.process_and_forward')
def process_and_forward(self, source: str, source_type: str = "file", 
                        chunking_strategy: str = "basic", index_name: str = None, **params) -> str:
    """
    Combined task that chains processing and forwarding
    
    This task delegates to a chain of process -> forward
    
    Args:
        source: Source file path, URL, or text content
        source_type: Type of source ("file", "url", or "text")
        chunking_strategy: Strategy for chunking the document
        index_name: Name of the index to store documents
        **params: Additional parameters
        
    Returns:
        Task ID of the chain
    """
    logger.info(f"Starting processing chain for {source}, strategy={chunking_strategy}, index={index_name}")
    
    # Create a task chain
    task_chain = chain(
        process.s(
            source=source,
            source_type=source_type,
            chunking_strategy=chunking_strategy,
            index_name=index_name,
            **params
        ).set(queue='process_q'),
        forward.s(
            index_name=index_name,
            source=source
        ).set(queue='forward_q')
    )
    
    # Execute the chain
    result = task_chain.apply_async()
    logger.info(f"Created task chain ID: {result.id}")
    
    return result.id


@app.task(bind=True, base=LoggingTask, name='data_process.tasks.process_sync')
def process_sync(self, source: str, source_type: str = "file", 
                 chunking_strategy: str = "basic", timeout: int = 30, **params) -> Dict:
    """
    Synchronous process task that returns text directly (for real-time API)
    
    Args:
        source: Source file path, URL, or text content
        source_type: Type of source ("file", "url", or "text")
        chunking_strategy: Strategy for chunking the document
        timeout: Timeout for the operation
        **params: Additional parameters
        
    Returns:
        Dict containing the extracted text and metadata
    """
    start_time = time.time()
    task_id = self.request.id
    
    # Update task state to PROCESSING
    self.update_state(
        state=states.STARTED,
        meta={
            'source': source,
            'source_type': source_type,
            'task_name': '',
            'start_time': start_time,
            'sync_mode': True
        }
    )
    
    logger.info(f"Synchronous processing file: {source} with strategy: {chunking_strategy}")
    
    # Get the data processor instance
    actor = get_ray_actor()

    try:
        # Process the file based on the source type
        if source_type == "file":
            _, file_ext = os.path.splitext(source)
            file_ext = file_ext.lower()
            
            if file_ext in ['.xlsx', '.xls']:
                chunks_ref = actor.process_excel_file.remote(source, chunking_strategy, **params)
            else:
                chunks_ref = actor.process_file.remote(source, chunking_strategy, source_type=source_type, task_id=task_id, **params)
            
            chunks = ray.get(chunks_ref)
        else:
            raise NotImplementedError(f"Source type '{source_type}' not yet implemented")
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        # Extract text from chunks
        text_content = "\n\n".join([chunk.get("text", "") for chunk in chunks])
        
        # Update task state to COMPLETE
        self.update_state(
            state=states.SUCCESS,
            meta={
                'chunks_count': len(chunks),
                'processing_time': elapsed_time,
                'source': source,
                'task_name': '',
                'text_length': len(text_content),
                'sync_mode': True
            }
        )
        
        logger.info(f"Synchronously processed {len(chunks)} chunks from {source} in {elapsed_time:.2f}s")
        
        return {
            'task_id': task_id,
            'source': source,
            'text': text_content,
            'chunks': chunks,
            'chunks_count': len(chunks),
            'processing_time': elapsed_time,
            'text_length': len(text_content)
        }
        
    except Exception as e:
        logger.error(f"Error synchronously processing file {source}: {str(e)}")
        
        # Update task state to FAILURE with custom metadata
        self.update_state(
            state=states.FAILURE,
            meta={
                'source': source,
                'task_name': 'process_sync',
                'custom_error': str(e),
                'sync_mode': True,
                'stage': 'sync_processing_failed'
            }
        )
        
        # Re-raise to let Celery handle exception serialization
        raise