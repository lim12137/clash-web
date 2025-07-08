import os
import logging
from dotenv import load_dotenv
from typing import Optional, Dict, Any

# Configure logging
logger = logging.getLogger("data_process.config")

class Config:
    """Unified configuration management class, supports environment variable validation and loading"""
    
    def __init__(self):
        load_dotenv()
        self._validate_required_vars()
        logger.info("Configuration system initialized")

    
    def _validate_required_vars(self) -> None:
        """Validate basic required environment variables"""
        required = [
            'REDIS_URL',
            'REDIS_BACKEND_URL',
            'ELASTICSEARCH_SERVICE'
        ]
        
        missing = [var for var in required if not os.getenv(var)]
        
        if missing:
            raise ValueError(f"Missing basic required environment variables: {missing}")
        
        logger.info("✅ Basic environment variable validation passed")
    
    def validate_task_environment(self) -> Dict[str, Any]:
        """Validate environment variables required for Celery task execution"""
        task_vars = {
            'REDIS_URL': self.redis_url,
            'REDIS_BACKEND_URL': self.redis_backend_url,
            'ELASTICSEARCH_SERVICE': self.elasticsearch_service
        }
        
        missing = []
        invalid = []
        
        for var_name, var_value in task_vars.items():
            if not var_value:
                missing.append(var_name)
            elif var_name == 'REDIS_URL' and not self._validate_redis_url(var_value):
                invalid.append(f"{var_name}: {var_value}")
            elif var_name == 'REDIS_BACKEND_URL' and not self._validate_redis_url(var_value):
                invalid.append(f"{var_name}: {var_value}")
            elif var_name == 'ELASTICSEARCH_SERVICE' and not self._validate_es_service(var_value):
                invalid.append(f"{var_name}: {var_value}")
        
        validation_result = {
            'valid': len(missing) == 0 and len(invalid) == 0,
            'missing': missing,
            'invalid': invalid,
            'variables': task_vars
        }
        
        if not validation_result['valid']:
            error_msg = []
            if missing:
                error_msg.append(f"Missing environment variables: {missing}")
            if invalid:
                error_msg.append(f"Invalid environment variables: {invalid}")
            raise ValueError("; ".join(error_msg))
        
        return validation_result
    
    def _validate_redis_url(self, redis_url: str) -> bool:
        """Validate Redis URL format"""
        return redis_url.startswith(('redis://', 'rediss://'))
    
    def _validate_es_service(self, es_service: str) -> bool:
        """Validate Elasticsearch service URL format"""
        return es_service.startswith(('http://', 'https://')) and es_service.endswith('/api')
    
    @property
    def redis_url(self) -> Optional[str]:
        return os.getenv('REDIS_URL')
    
    @property
    def redis_backend_url(self) -> Optional[str]:
        return os.getenv('REDIS_BACKEND_URL')
    
    @property
    def elasticsearch_service(self) -> Optional[str]:
        return os.getenv('ELASTICSEARCH_SERVICE')
    
    @property
    def celery_worker_prefetch_multiplier(self) -> int:
        """Celery worker prefetch multiplier configuration"""
        return int(os.getenv('CELERY_WORKER_PREFETCH_MULTIPLIER', '1'))
    
    @property
    def celery_task_time_limit(self) -> int:
        """Celery task time limit (seconds)"""
        return int(os.getenv('CELERY_TASK_TIME_LIMIT', '3600'))
    
    @property
    def elasticsearch_request_timeout(self) -> int:
        """Elasticsearch request timeout (seconds)"""
        return int(os.getenv('ELASTICSEARCH_REQUEST_TIMEOUT', '30'))
    
    @property
    def log_level(self) -> str:
        """Log level"""
        return os.getenv('LOG_LEVEL', 'INFO').upper()
    
    # Ray related configuration properties
    @property
    def ray_plasma_directory(self) -> str:
        """Ray plasma object store directory configuration"""
        return os.getenv('RAY_PLASMA_DIRECTORY', '/tmp')
    
    @property
    def ray_object_store_memory_gb(self) -> float:
        """Ray object store memory limit (GB)"""
        return float(os.getenv('RAY_OBJECT_STORE_MEMORY_GB', '2.0'))
    
    @property
    def ray_temp_dir(self) -> str:
        """Ray temporary directory"""
        return os.getenv('RAY_TEMP_DIR', '/tmp/ray')

# Create global config instance
config = Config()