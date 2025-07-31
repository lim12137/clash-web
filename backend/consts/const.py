import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Test voice file path
TEST_VOICE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'test.wav')

# ModelEngine Configuration
MODEL_ENGINE_HOST = os.getenv('MODEL_ENGINE_HOST')
MODEL_ENGINE_APIKEY = os.getenv('MODEL_ENGINE_APIKEY')

# Elasticsearch Configuration
ES_HOST = os.getenv("ELASTICSEARCH_HOST")
ES_API_KEY = os.getenv("ELASTICSEARCH_API_KEY")
ELASTICSEARCH_SERVICE = os.getenv("ELASTICSEARCH_SERVICE")

# Data Processing Service Configuration
DATA_PROCESS_SERVICE = os.getenv("DATA_PROCESS_SERVICE")
CLIP_MODEL_PATH = os.getenv("CLIP_MODEL_PATH")

# Upload Configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_CONCURRENT_UPLOADS = 5
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')

# Image Filter Configuration
IMAGE_FILTER = os.getenv("IMAGE_FILTER", "false").lower() == "true"

# Default User and Tenant IDs
DEFAULT_USER_ID = "user_id"
DEFAULT_TENANT_ID = "tenant_id"

DEFAULT_APP_DESCRIPTION_ZH = "Nexent 是一个开源智能体SDK和平台，能够将单一提示词转化为完整的多模态服务 —— 无需编排，无需复杂拖拉拽。基于 MCP 工具生态系统构建，Nexent 提供灵活的模型集成、可扩展的数据处理和强大的知识库管理。我们的目标很简单：将数据、模型和工具整合到一个智能中心中，让任何人都能轻松地将 Nexent 集成到项目中，使日常工作流程更智能、更互联。"
DEFAULT_APP_DESCRIPTION_EN = "Nexent is an open-source agent SDK and platform, which can convert a single prompt into a complete multi-modal service - without orchestration, without complex drag-and-drop. Built on the MCP tool ecosystem, Nexent provides flexible model integration, scalable data processing, and powerful knowledge base management. Our goal is simple: to integrate data, models, and tools into a central intelligence hub, allowing anyone to easily integrate Nexent into their projects, making daily workflows smarter and more interconnected."

DEFAULT_APP_NAME_ZH = "Nexent 智能体"
DEFAULT_APP_NAME_EN = "Nexent Agent"

# Minio Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_REGION = os.getenv("MINIO_REGION")
MINIO_DEFAULT_BUCKET = os.getenv("MINIO_DEFAULT_BUCKET")

# Postgres Configuration
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_USER = os.getenv("POSTGRES_USER")
NEXENT_POSTGRES_PASSWORD = os.getenv("NEXENT_POSTGRES_PASSWORD")
POSTGRES_DB = os.getenv("POSTGRES_DB")
POSTGRES_PORT = os.getenv("POSTGRES_PORT")

# Data Processing Service Configuration
REDIS_URL = os.getenv("REDIS_URL")
REDIS_BACKEND_URL = os.getenv("REDIS_BACKEND_URL")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
FLOWER_PORT = int(os.getenv("FLOWER_PORT", "5555"))

# Ray Configuration
RAY_ACTOR_NUM_CPUS = int(os.getenv("RAY_ACTOR_NUM_CPUS", "2"))
RAY_DASHBOARD_PORT = int(os.getenv("RAY_DASHBOARD_PORT", "8265"))
RAY_DASHBOARD_HOST = os.getenv("RAY_DASHBOARD_HOST", "0.0.0.0")
RAY_NUM_CPUS = os.getenv("RAY_NUM_CPUS")
RAY_PLASMA_DIRECTORY = os.getenv("RAY_PLASMA_DIRECTORY", "/tmp")
RAY_OBJECT_STORE_MEMORY_GB = float(os.getenv("RAY_OBJECT_STORE_MEMORY_GB", "2.0"))
RAY_TEMP_DIR = os.getenv("RAY_TEMP_DIR", "/tmp/ray")
RAY_LOG_LEVEL = os.getenv("RAY_LOG_LEVEL", "INFO").upper()

# Service Control Flags
DISABLE_RAY_DASHBOARD = os.getenv("DISABLE_RAY_DASHBOARD", "false").lower() == "true"
DISABLE_CELERY_FLOWER = os.getenv("DISABLE_CELERY_FLOWER", "false").lower() == "true"
DOCKER_ENVIRONMENT = os.getenv("DOCKER_ENVIRONMENT", "false").lower() == "true"

# Celery Configuration
CELERY_WORKER_PREFETCH_MULTIPLIER = int(os.getenv("CELERY_WORKER_PREFETCH_MULTIPLIER", "1"))
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "3600"))
ELASTICSEARCH_REQUEST_TIMEOUT = int(os.getenv("ELASTICSEARCH_REQUEST_TIMEOUT", "30"))

# Worker Configuration
RAY_ADDRESS = os.getenv("RAY_ADDRESS", "auto")
QUEUES = os.getenv("QUEUES", "process_q,forward_q")
WORKER_NAME = os.getenv("WORKER_NAME")  # Will be dynamically set based on PID if not provided
WORKER_CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "4"))
