import logging
import time
import io
import base64
import aiohttp
import os
import redis
import warnings
import tempfile
from typing import Optional, List, Dict, Any

from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel

from consts.const import CLIP_MODEL_PATH, IMAGE_FILTER

# Configure logging
logger = logging.getLogger("data_process.service")


class DataProcessService:
    def __init__(self):
        """Initialize the DataProcessService

        Args:
            num_workers: Number of worker processes for data processing
        """
        # Initialize CLIP model and processor with fallback
        self.model = None
        self.processor = None
        self.clip_available = False

        try:
            self.model = CLIPModel.from_pretrained(CLIP_MODEL_PATH)
            self.processor = CLIPProcessor.from_pretrained(CLIP_MODEL_PATH)
            self.clip_available = True
            logger.info("CLIP model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load CLIP model, degrading to size-only filtering: {str(e)}")
            self.clip_available = False

        # Suppress PIL warning about palette images
        warnings.filterwarnings('ignore', category=UserWarning, module='PIL.Image')

    async def start(self):
        """Start the data processing service"""
        logger.info("Data processing service started")

    async def stop(self):
        """Stop the data processing service"""
        logger.info("Data processing service stopped")

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task by ID

        Args:
            task_id: ID of the task to retrieve

        Returns:
            Optional[Dict[str, Any]]: Task data if found, None otherwise
        """
        # Import here to avoid circular import
        from data_process.utils import get_task_info
        return get_task_info(task_id)

    def get_all_tasks(self, filter: bool=True) -> List[Dict[str, Any]]:
        """Get all tasks

        Args:
            filter: Whether to filter out useless task (i.e. process_and_forward) with no index_name and tast_name

        Returns:
            List[Dict[str, Any]]: List of all tasks
        """
        # Import here to avoid circular import
        from celery import current_app
        from data_process.utils import get_task_info, get_all_task_ids_from_redis
        
        all_tasks = []
        
        try:
            logger.info("Getting inspector to check for active tasks")
            # Get inspector to check for active tasks
            inspector = current_app.control.inspect()
            
            # Collect task IDs from different sources
            task_ids = set()
            
            # Get active tasks
            active_tasks_dict = inspector.active()
            if active_tasks_dict:
                for worker, tasks in active_tasks_dict.items():
                    for task in tasks:
                        task_id = task.get('id')
                        if task_id:
                            task_ids.add(task_id)
            
            logger.info("Getting inspector to check for reserved tasks")
            # Get reserved (waiting) tasks  
            reserved_tasks_dict = inspector.reserved()
            if reserved_tasks_dict:
                for worker, tasks in reserved_tasks_dict.items():
                    for task in tasks:
                        task_id = task.get('id')
                        if task_id:
                            task_ids.add(task_id)
            
            logger.info("Getting inspector to check for scheduled tasks")
            # Get scheduled tasks
            scheduled_tasks_dict = inspector.scheduled()
            if scheduled_tasks_dict:
                for worker, tasks in scheduled_tasks_dict.items():
                    for task in tasks:
                        task_id = task.get('id')
                        if task_id:
                            task_ids.add(task_id)
            
            logger.info("Getting task IDs from Redis backend")
            redis_url = os.environ.get('REDIS_BACKEND_URL')
            logger.info(f"Connecting to Redis at: {redis_url}")
            if redis_url:
                redis_client = redis.from_url(redis_url)
                logger.info("Redis client created, testing connection...")
                redis_client.ping()
                logger.info("Redis ping success")

            # Also get task IDs from Redis backend (covers completed/failed tasks within expiry)
            try:
                redis_task_ids = get_all_task_ids_from_redis()
                for task_id in redis_task_ids:
                    task_ids.add(task_id) # Add to the set, duplicates will be handled
                
            except Exception as redis_error:
                logger.warning(f"Failed to query Redis for stored task IDs: {str(redis_error)}")
            
            logger.info(f"Total unique task IDs collected (inspector + Redis): {len(task_ids)}")
            
            # Get task details for each found task ID
            for task_id in task_ids:
                try:
                    task_info = get_task_info(task_id)
                    if task_info:
                        if filter and not (task_info.get('index_name') and task_info.get('task_name')):
                                continue
                        all_tasks.append(task_info)
                except Exception as e:
                    logger.warning(f"Failed to get status for task {task_id}: {str(e)}")
                    continue # Skip this task if status retrieval fails
            
            logger.info(f"Successfully retrieved details for {len(all_tasks)} tasks.")
            
        except Exception as e:
            logger.error(f"Error retrieving all tasks: {str(e)}")
            # Fall back to empty list to avoid breaking the API
            all_tasks = []
        
        return all_tasks

    def get_index_tasks(self, index_name: str, filter: bool=True) -> List[Dict[str, Any]]:
        """Get all active tasks for a specific index

        Args:
            index_name: Name of the index to filter tasks for

        Returns:
            List[Dict[str, Any]]: Tasks for the specified index
        """
        task_list = self.get_all_tasks(filter)
        # May got multiple tasks for the same index
        return [task for task in task_list if task.get('index_name') == index_name]

    def check_image_size(self, width: int, height: int, min_width: int = 200, min_height: int = 200) -> bool:
        """Check if the image dimensions meet the minimum requirements

        Args:
            width: Image width
            height: Image height
            min_width: Minimum width requirement
            min_height: Minimum height requirement

        Returns:
            bool: Returns True if image dimensions meet requirements, False otherwise
        """
        if width < min_width or height < min_height:
            return False
        return True

    async def load_image(self, image_url: str) -> Optional[Image.Image]:
        """Asynchronously load an image from URL, local file path, or base64 string

        Args:
            image_url: URL, file path, or base64 encoded image

        Returns:
            Optional[Image.Image]: PIL Image object if successful, None otherwise
        """
        connector = aiohttp.TCPConnector()
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(connector=connector, trust_env=True, timeout=timeout) as session:
            return await self._load_image(session, image_url)

    async def _load_image(self, session: aiohttp.ClientSession, path: str) -> Optional[Image.Image]:
        """Internal method to load an image from various sources"""
        try:
            # Check if input is base64 encoded
            if path.startswith('data:image'):
                # Extract the base64 data after the comma
                base64_data = path.split(',')[1]
                image_data = base64.b64decode(base64_data)
                image = Image.open(io.BytesIO(image_data))

                # Convert RGBA to RGB if necessary
                if image.mode == 'RGBA':
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[3])
                    image = background
                elif image.mode != 'RGB':
                    image = image.convert('RGB')

                return image

            # Check if the path is a local file
            if os.path.isfile(path):
                try:
                    image = Image.open(path)

                    # Convert RGBA to RGB if necessary
                    if image.mode == 'RGBA':
                        background = Image.new(
                            'RGB', image.size, (255, 255, 255))
                        background.paste(image, mask=image.split()[3])
                        image = background
                    elif image.mode != 'RGB':
                        image = image.convert('RGB')

                    return image
                except Exception as e:
                    logger.info(f"Failed to load local image: {str(e)}")
                    return None

            # If not a local file or base64, treat as URL
            # If the file ends in SVG, filter it.
            if path.lower().endswith('.svg'):
                return None

            async with session.get(path) as response:
                if response.status != 200:
                    return None

                image_data = await response.read()

                try:
                    # For other formats, try direct loading
                    image = Image.open(io.BytesIO(image_data))

                    # Convert RGBA to RGB if necessary
                    if image.mode == 'RGBA':
                        background = Image.new(
                            'RGB', image.size, (255, 255, 255))
                        background.paste(image, mask=image.split()[3])
                        image = background
                    elif image.mode != 'RGB':
                        image = image.convert('RGB')

                    return image
                except Exception:
                    # If direct loading fails, try downloading to a temporary file first
                    with tempfile.NamedTemporaryFile(suffix=os.path.splitext(path)[1], delete=False) as temp_file:
                        temp_file.write(image_data)
                        temp_file.flush()
                        try:
                            image = Image.open(temp_file.name)

                            if image.mode == 'RGBA':
                                background = Image.new(
                                    'RGB', image.size, (255, 255, 255))
                                background.paste(image, mask=image.split()[3])
                                image = background
                            elif image.mode != 'RGB':
                                image = image.convert('RGB')
                            return image
                        finally:
                            os.unlink(temp_file.name)

        except Exception as e:
            logger.info(f"Error loading {path}: {str(e)}")
            return None

    async def filter_important_image(self, image_url: str, positive_prompt: str = "an important image",
                                     negative_prompt: str = "an unimportant image") -> Dict[str, Any]:
        """Filter whether an image is important using CLIP model

        Args:
            image_url: URL to the image
            positive_prompt: Text describing an important image
            negative_prompt: Text describing an unimportant image

        Returns:
            Dict[str, Any]: JSON object with is_important boolean and confidence score
        """
        try:
            # Process image from URL
            img = await self.load_image(image_url)

            if img is None or not self.check_image_size(img.width, img.height):
                logger.info(
                    f"Image not loaded or does not meet minimum size requirements (200x200 pixels): {image_url}")
                return {
                    "is_important": False,
                    "confidence": 0.0,
                    "probabilities": {
                        "positive": 0.0,
                        "negative": 0.0
                    }
                }

            # If IMAGE_FILTER is False, or CLIP model is not available, skip CLIP calculation and return as important
            if not IMAGE_FILTER or not self.clip_available:
                logger.info(
                    f"IMAGE_FILTER is disabled, returning image as important: {image_url}")
                return {
                    "is_important": True,
                    "confidence": 1.0,
                    "probabilities": {
                        "positive": 1.0,
                        "negative": 0.0
                    }
                }

            # Convert RGBA to RGB if necessary
            if img.mode == 'RGBA':
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Try to use CLIP model with fallback to size-only filter
            try:
                # Prepare inputs for CLIP
                inputs = self.processor(
                    text=[negative_prompt, positive_prompt],
                    images=img,
                    return_tensors="pt",
                    padding=True
                )

                # Get model outputs
                with torch.no_grad():
                    outputs = self.model(**inputs)

                # Get image-text similarity scores
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=1)

                # Extract probabilities
                neg_prob, pos_prob = probs[0].tolist()

                # Determine if image is important based on probability
                is_important = pos_prob > 0.6 and neg_prob < 0.5

                return {
                    "is_important": bool(is_important),
                    "confidence": float(pos_prob),
                    "probabilities": {
                        "positive": float(pos_prob),
                        "negative": float(neg_prob)
                    }
                }
            except Exception as e:
                # CLIP model processing failed, fall back to size-only filtering
                logger.warning(f"CLIP processing failed, using size-only filter: {str(e)}")
                return {
                    "is_important": True,
                    "confidence": 0.8,  # Arbitrary high confidence value
                    "probabilities": {
                        "positive": 0.8,
                        "negative": 0.2
                    }
                }

        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            raise Exception(f"Error processing image: {str(e)}")


# Global instance to be shared across modules
# This avoids creating multiple instances and loading CLIP model multiple times
_data_process_service = None

def get_data_process_service():
    """Get or create the global DataProcessService instance (lazy initialization)"""
    global _data_process_service
    if _data_process_service is None:
        _data_process_service = DataProcessService()
    return _data_process_service
