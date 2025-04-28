import asyncio
import base64
import io
import os
import tempfile
import warnings
from dataclasses import dataclass
from typing import List, Tuple, Optional

import aiohttp
import torch
from PIL import Image

# Suppress PIL warning about palette images
warnings.filterwarnings('ignore', category=UserWarning, module='PIL.Image')

from transformers import CLIPProcessor, CLIPModel

def check_image_size(width: int, height: int, min_width: int = 200, min_height: int = 200) -> bool:
    """检查图片尺寸是否满足最小要求

    Args:
        width: 图片宽度
        height: 图片高度
        min_width: 最小宽度要求
        min_height: 最小高度要求

    Returns:
        bool: 如果图片尺寸满足要求返回True，否则返回False
    """
    if width < min_width or height < min_height:
        print(f"Image is smaller than threshold, skipping...")
        return False
    return True


async def load_image(session: aiohttp.ClientSession, path: str) -> Optional[Image.Image]:
    """Asynchronously load an image from URL, local file path, or base64 string."""
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

            # Check size constraints
            if not check_image_size(image.size[0], image.size[1]):
                return None

            return image

        # Check if the path is a local file
        if os.path.isfile(path):
            try:
                image = Image.open(path)

                # Convert RGBA to RGB if necessary
                if image.mode == 'RGBA':
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[3])
                    image = background
                elif image.mode != 'RGB':
                    image = image.convert('RGB')

                # Check size constraints
                if not check_image_size(image.size[0], image.size[1]):
                    return None

                return image
            except Exception as e:
                print(f"Failed to load local image: {str(e)}")
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
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    background.paste(image, mask=image.split()[3])
                    image = background
                elif image.mode != 'RGB':
                    image = image.convert('RGB')

                # Check size constraints
                if not check_image_size(image.size[0], image.size[1]):
                    return None

                return image
            except Exception as e:
                # If direct loading fails, try downloading to a temporary file first
                with tempfile.NamedTemporaryFile(suffix=os.path.splitext(path)[1], delete=False) as temp_file:
                    temp_file.write(image_data)
                    temp_file.flush()
                    try:
                        image = Image.open(temp_file.name)

                        # Check size constraints
                        if not check_image_size(image.size[0], image.size[1]):
                            return None

                        if image.mode == 'RGBA':
                            background = Image.new('RGB', image.size, (255, 255, 255))
                            background.paste(image, mask=image.split()[3])
                            image = background
                        elif image.mode != 'RGB':
                            image = image.convert('RGB')
                        return image
                    finally:
                        os.unlink(temp_file.name)

    except Exception as e:
        print(f"Error loading {path}: {str(e)}")
        return None


@dataclass
class ProcessedImage:
    url: str
    image: Image.Image
    is_important: bool
    confidence: float


@dataclass
class LabelSet:
    """A pair of labels for classification."""
    negative: str
    positive: str


class AsyncImageProcessor:
    def __init__(self, model_path: str, batch_size: int = 32, label_sets: List[LabelSet] = None,
                 threshold: float = 0.5):
        try:
            # Global model and processor
            self.model = CLIPModel.from_pretrained(model_path)
            self.processor = CLIPProcessor.from_pretrained(model_path)

        except Exception as e:
            print(f"Error loading CLIP model: {str(e)}, model_path: {model_path}")
            raise e

        self.batch_size = batch_size
        self.label_sets = label_sets or []
        self.threshold = threshold
        self.image_queue = asyncio.Queue()
        self.result_queue = asyncio.Queue()
        self.important_images: List[ProcessedImage] = []

    async def download_batch(self, urls: List[str]) -> List[Tuple[str, Optional[Image.Image]]]:
        """Download a batch of images concurrently."""
        # Create ClientSession with SSL context and connection timeout
        connector = aiohttp.TCPConnector()
        timeout = aiohttp.ClientTimeout(total=5)  # 设置5秒超时
        async with aiohttp.ClientSession(connector=connector, trust_env=True, timeout=timeout) as session:
            tasks = []
            for url in urls:
                try:
                    task = load_image(session, url)
                    tasks.append(task)
                except asyncio.TimeoutError:
                    print(f"请求超时: {url}")
                    tasks.append(None)
            
            images = await asyncio.gather(*tasks, return_exceptions=True)
            # 处理结果，将异常替换为None
            processed_results = []
            for i, result in enumerate(images):
                if isinstance(result, Exception):
                    print(f"下载失败: {urls[i]}, 错误: {str(result)}")
                    processed_results.append((urls[i], None))
                else:
                    processed_results.append((urls[i], result))
                    
            return processed_results

    def process_batch(self, image_batch: List[Tuple[str, Image.Image]]) -> List[ProcessedImage]:
        """Process a batch of images with CLIP model."""
        if not image_batch:
            return []

        urls, images = zip(*[(url, img) for url, img in image_batch if img is not None])
        if not images:
            return []

        results = []
        for i, (url, image) in enumerate(zip(urls, images)):
            all_probs = []  # Store all probabilities for this image
            max_confidence = 0.0

            # Process each label set
            for label_set in self.label_sets:
                inputs = self.processor(images=image, text=[label_set.negative, label_set.positive],
                    return_tensors="pt", padding=True)

                with torch.no_grad():
                    outputs = self.model(**inputs)
                    probs = outputs.logits_per_image.softmax(dim=1)
                    confidence = probs[0][1].item()  # Get positive class probability
                    all_probs.append(confidence)
                    max_confidence = max(max_confidence, confidence)

            # Image is important only if ALL conditions are met
            is_important = all(prob > self.threshold for prob in all_probs)

            if is_important:
                results.append(ProcessedImage(url, image, True, max_confidence))

        return results

    async def process_images(self, urls: List[str]):
        """Main processing function."""
        # Deduplicate URLs while preserving order
        seen = set()
        unique_urls = [url for url in urls if not (url in seen or seen.add(url))]
        print(f"Removed {len(urls) - len(unique_urls)} duplicate URLs")

        # Download all images
        all_images = await self.download_batch(unique_urls)
        # 过滤为None的图片
        all_images = [(url, img) for url, img in all_images if img is not None]
        print(f"Loading {len(all_images)} Images")

        # batch filter images
        for i in range(0, len(all_images), self.batch_size):
            batch_images = all_images[i:i + self.batch_size]
            print(
                f"\nProcessing batch {i // self.batch_size + 1}/{(len(all_images) + self.batch_size - 1) // self.batch_size}")

            # Process valid images
            valid_batch = [(url, img) for url, img in batch_images if img is not None]
            if valid_batch:
                results = self.process_batch(valid_batch)
                self.important_images.extend(results)

                # Print results for this batch
                for result in results:
                    print(f"Found important image: {result.url} (confidence: {result.confidence:.2f})")

    def display_important_images(self):
        """Display all important images."""
        if not self.important_images:
            print("No important images found.")
            return

        print(f"\nDisplaying {len(self.important_images)} important images. Close all windows to exit.")
        for processed_img in self.important_images:
            print(f"Showing important image from: {processed_img.url} (confidence: {processed_img.confidence:.2f})")
            processed_img.image.show()
