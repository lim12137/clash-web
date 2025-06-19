import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional, List, Dict, Any

# Configure logging
logger = logging.getLogger("data_process.config")

class Config:
    """统一的配置管理类，支持环境变量验证和加载"""
    
    def __init__(self):
        self._load_env()
        self._validate_required_vars()
        logger.info("配置系统初始化完成")
    
    def _load_env(self) -> None:
        """加载环境变量文件"""
        current_file_dir = Path(__file__).parent
        env_paths = [
            current_file_dir / "../../.env"
        ]
        
        env_loaded = False
        for env_path in env_paths:
            abs_path = env_path.resolve()
            print("abs_path", abs_path)
            if abs_path.exists():
                load_dotenv(abs_path)
                logger.info(f"已加载环境文件: {abs_path}")
                env_loaded = True
                break
        
        if not env_loaded:
            logger.warning("⚠️ 未找到环境文件，将使用系统环境变量")
    
    def _validate_required_vars(self) -> None:
        """验证基础必需的环境变量"""
        required = [
            'REDIS_URL',
            'ELASTICSEARCH_SERVICE'
        ]
        
        missing = [var for var in required if not os.getenv(var)]
        
        if missing:
            raise ValueError(f"缺少基础必需的环境变量: {missing}")
        
        logger.info("✅ 基础环境变量验证通过")
    
    def validate_task_environment(self) -> Dict[str, Any]:
        """验证Celery任务执行所需的环境变量"""
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
                error_msg.append(f"缺少环境变量: {missing}")
            if invalid:
                error_msg.append(f"无效环境变量: {invalid}")
            raise ValueError("; ".join(error_msg))
        
        return validation_result
    
    def _validate_redis_url(self, redis_url: str) -> bool:
        """验证Redis URL格式"""
        return redis_url.startswith(('redis://', 'rediss://'))
    
    def _validate_es_service(self, es_service: str) -> bool:
        """验证Elasticsearch服务URL格式"""
        return es_service.startswith(('http://', 'https://'))
    
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
        """Celery worker预取倍数配置"""
        return int(os.getenv('CELERY_WORKER_PREFETCH_MULTIPLIER', '1'))
    
    @property
    def celery_task_time_limit(self) -> int:
        """Celery任务时间限制（秒）"""
        return int(os.getenv('CELERY_TASK_TIME_LIMIT', '3600'))
    
    @property
    def elasticsearch_request_timeout(self) -> int:
        """Elasticsearch请求超时时间（秒）"""
        return int(os.getenv('ELASTICSEARCH_REQUEST_TIMEOUT', '30'))
    
    @property
    def log_level(self) -> str:
        """日志级别"""
        return os.getenv('LOG_LEVEL', 'INFO').upper()
    
    # Ray 配置相关属性
    @property
    def ray_plasma_directory(self) -> str:
        """Ray plasma 对象存储目录配置"""
        return os.getenv('RAY_PLASMA_DIRECTORY', '/tmp')
    
    @property
    def ray_object_store_memory_gb(self) -> float:
        """Ray 对象存储内存限制（GB）"""
        return float(os.getenv('RAY_OBJECT_STORE_MEMORY_GB', '2.0'))
    
    @property
    def ray_temp_dir(self) -> str:
        """Ray 临时目录"""
        return os.getenv('RAY_TEMP_DIR', '/tmp/ray')

# 创建全局配置实例
config = Config()