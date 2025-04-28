import os

# ModelEngine Configuration
MODEL_ENGINE_HOST = os.getenv('MODEL_ENGINE_HOST')
MODEL_ENGINE_APIKEY = os.getenv('MODEL_ENGINE_APIKEY')

# Elasticsearch Configuration
ES_HOST = os.getenv("ELASTICSEARCH_HOST")
ES_API_KEY = os.getenv("ELASTICSEARCH_API_KEY")
CREATE_TEST_KB = os.getenv("CREATE_TEST_KB", "False").lower() == "true"

# Data Processing Service Configuration
DATA_PROCESS_SERVICE = os.getenv("DATA_PROCESS_SERVICE")

# Upload Configuration
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_CONCURRENT_UPLOADS = 5
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')

# ===== To be migrated to frontend configuration =====
# Email Configuration
IMAP_SERVER = os.getenv('IMAP_SERVER')
IMAP_PORT = os.getenv('IMAP_PORT')
SMTP_SERVER = os.getenv('SMTP_SERVER')
SMTP_PORT = os.getenv('SMTP_PORT')
MAIL_USERNAME = os.getenv('MAIL_USERNAME')
MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')

# Model Configuration
EMBEDDING_MODEL_URL = os.getenv('EMBEDDING_MODEL_URL')
EMBEDDING_MODEL_NAME = os.getenv('EMBEDDING_MODEL_NAME')
EMBEDDING_API_KEY = os.getenv('EMBEDDING_API_KEY')
EMBEDDING_MODEL_DIM = int(os.getenv('EMBEDDING_MODEL_DIM'))

# EXASearch Configuration
EXA_SEARCH_API_KEY = os.getenv('EXA_SEARCH_API_KEY')
