import logging
import time
import io
import base64
import aiohttp
import os
import warnings
import tempfile
from typing import Optional, List, Dict, Any

from nexent.data_process.core import DataProcessCore
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel

from consts.const import CLIP_MODEL_PATH, IMAGE_FILTER

# Configure logging
logger = logging.getLogger("data_process.service")


class DataProcessService:
    def __init__(self, num_workers: int = 3):
        """Initialize the DataProcessService

        Args:
            num_workers: Number of worker processes for data processing
        """
        # Initialize core
        self.core = DataProcessCore(num_workers=num_workers)

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
        """Start the data processing core"""
        await self.core.start()

    async def stop(self):
        """Stop the data processing core"""
        await self.core.stop()

    async def create_task(self, source: str, source_type: str, chunking_strategy: str,
                          index_name: str, **params) -> str:
        """Create a new data processing task

        Args:
            source: Source data to process
            source_type: Type of the source data
            chunking_strategy: Strategy for chunking the data
            index_name: Name of the index to store results
            **params: Additional parameters for the task

        Returns:
            str: Task ID
        """
        start_time = time.time()
        task_id = await self.core.create_task(
            source=source,
            source_type=source_type,
            chunking_strategy=chunking_strategy,
            index_name=index_name,
            **params
        )
        logger.info(f"Task creation took {(time.time() - start_time) * 1000:.2f}ms",
                    extra={'task_id': task_id, 'stage': 'API-CREATE', 'source': 'service'})

        return task_id

    async def create_batch_tasks(self, sources: List[Dict[str, Any]]) -> List[str]:
        """Create multiple data processing tasks in batch

        Args:
            sources: List of task source configurations

        Returns:
            List[str]: List of task IDs
        """
        start_time = time.time()
        batch_id = f"batch-{int(time.time())}"

        logger.info(f"Processing batch request with {len(sources)} sources",
                    extra={'task_id': batch_id, 'stage': 'API-BATCH', 'source': 'service'})

        task_ids = await self.core.create_batch_tasks(sources)

        elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"Batch task creation took {elapsed_ms:.2f}ms for {len(task_ids)} tasks",
                    extra={'task_id': batch_id, 'stage': 'API-BATCH', 'source': 'service'})

        return task_ids

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task by ID

        Args:
            task_id: ID of the task to retrieve

        Returns:
            Optional[Dict[str, Any]]: Task data if found, None otherwise
        """
        return self.core.get_task(task_id)

    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """Get all tasks

        Returns:
            List[Dict[str, Any]]: List of all tasks
        """
        return self.core.get_all_tasks()

    def get_index_tasks(self, index_name: str) -> Dict[str, Any]:
        """Get all active tasks for a specific index

        Args:
            index_name: Name of the index to filter tasks for

        Returns:
            Dict[str, Any]: Tasks for the specified index
        """
        return self.core.get_index_tasks(index_name)

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
