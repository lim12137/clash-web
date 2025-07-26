import os
from dotenv import load_dotenv
load_dotenv()

# Test voice file path
TEST_VOICE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets', 'test.wav')

# ModelEngine Configuration
MODEL_ENGINE_HOST = os.getenv('MODEL_ENGINE_HOST')
MODEL_ENGINE_APIKEY = os.getenv('MODEL_ENGINE_APIKEY')

# Elasticsearch Configuration
ES_HOST = os.getenv("ELASTICSEARCH_HOST")
ES_API_KEY = os.getenv("ELASTICSEARCH_API_KEY")

# Data Processing Service Configuration
DATA_PROCESS_SERVICE = os.getenv("DATA_PROCESS_SERVICE")
CLIP_MODEL_PATH = os.getenv("CLIP_MODEL_PATH")

# Upload Configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_CONCURRENT_UPLOADS = 5
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')

# Image Filter Configuration
IMAGE_FILTER = os.getenv("IMAGE_FILTER", "false").lower() == "true"

DEFAULT_USER_ID = "user_id"
DEFAULT_TENANT_ID = "tenant_id"

DEFAULT_APP_DESCRIPTION_ZH = "Nexent 是一个开源智能体SDK和平台，能够将单一提示词转化为完整的多模态服务 —— 无需编排，无需复杂拖拉拽。基于 MCP 工具生态系统构建，Nexent 提供灵活的模型集成、可扩展的数据处理和强大的知识库管理。我们的目标很简单：将数据、模型和工具整合到一个智能中心中，让任何人都能轻松地将 Nexent 集成到项目中，使日常工作流程更智能、更互联。"
DEFAULT_APP_DESCRIPTION_EN = "Nexent is an open-source agent SDK and platform, which can convert a single prompt into a complete multi-modal service - without orchestration, without complex drag-and-drop. Built on the MCP tool ecosystem, Nexent provides flexible model integration, scalable data processing, and powerful knowledge base management. Our goal is simple: to integrate data, models, and tools into a central intelligence hub, allowing anyone to easily integrate Nexent into their projects, making daily workflows smarter and more interconnected."

DEFAULT_APP_NAME_ZH = "Nexent 智能体"
DEFAULT_APP_NAME_EN = "Nexent Agent"