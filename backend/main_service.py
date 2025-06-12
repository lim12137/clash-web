import uvicorn
from dotenv import load_dotenv
import logging

# Load environment variables
import os
dotenv_paths = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),  # /opt/.env
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "docker", ".env"),  # /opt/docker/.env
    "../docker/.env"  # Relative fallback
]

# Try to load from the first existing file
for dotenv_path in dotenv_paths:
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path=dotenv_path)
        break
else:
    # Fallback to docker/.env
    load_dotenv(dotenv_path="../docker/.env")

from apps.base_app import app
from utils.logging_utils import configure_elasticsearch_logging

# Configure logging
configure_elasticsearch_logging()

logger = logging.getLogger("main service")


if __name__ == "__main__":
    # scan tools and update to database
    uvicorn.run(app, host="0.0.0.0", port=5010, access_log=False)
