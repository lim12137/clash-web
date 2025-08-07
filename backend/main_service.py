import uvicorn
import logging
import warnings
warnings.filterwarnings("ignore", category=UserWarning)

from dotenv import load_dotenv
load_dotenv()

from apps.base_app import app
from utils.logging_utils import configure_logging, configure_elasticsearch_logging


configure_logging(logging.INFO)
configure_elasticsearch_logging()
logger = logging.getLogger("main_service")

if __name__ == "__main__":
    # Scan agents and update to database
    uvicorn.run(app, host="0.0.0.0", port=5010, log_level="info")
