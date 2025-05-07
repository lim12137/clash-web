import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from apps.base_app import app
from utils.logging_utils import configure_elasticsearch_logging

# Configure logging
configure_elasticsearch_logging()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5010, access_log=False)
