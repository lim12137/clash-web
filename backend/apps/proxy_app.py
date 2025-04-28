import base64
import io
import logging
from urllib.parse import unquote

import aiohttp
from fastapi import APIRouter

from nexent.core.utils.image_filter import load_image

# Create router
router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@router.get("/proxy/image")
async def proxy_image(url: str):
    """
    Image proxy service that fetches remote images and returns base64 encoded data
    
    Parameters:
        url: Remote image URL
    
    Returns:
        JSON object containing base64 encoded image
    """
    try:
        # URL decode
        decoded_url = unquote(url)

        # Create temporary session and use load_image method to load the image
        async with aiohttp.ClientSession() as session:
            # Set request headers to simulate browser request
            session.headers.update({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                "Accept-Encoding": "br, gzip, deflate",
                "Accept-Language": "en-US,en;q=0.9",
            })
            
            # Use load_image method to load the image
            image = await load_image(session, decoded_url)
            
            if image is None:
                logger.error(f"Failed to fetch image, URL: {decoded_url[:50]}...")
                return {"success": False, "error": "Failed to fetch image or image format not supported"}
            
            # Convert PIL image to base64
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format=image.format or 'JPEG')
            img_byte_arr.seek(0)
            
            # Convert to base64
            image_data = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
            
            # Determine correct content_type
            content_type = f"image/{image.format.lower() if image.format else 'jpeg'}"
            
            return {"success": True, "base64": image_data, "content_type": content_type}

    except Exception as e:
        logger.error(f"Error occurred while proxying image: {str(e)}, URL: {url[:50]}...")
        return {"success": False, "error": str(e)}
