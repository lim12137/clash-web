"""
Celery worker script for data processing tasks

This script is used to start Celery workers for processing data
and forwarding to vector storage.

Enhanced with worker initialization signal design pattern.

Usage:
    # Start a worker that handles both queues
    python worker.py

    # Start a worker for processing only (high concurrency)
    QUEUES=process_q WORKER_CONCURRENCY=8 python worker.py

    # Start a worker for forwarding only (lower concurrency)
    QUEUES=forward_q WORKER_CONCURRENCY=2 python worker.py
"""

import os
import logging
import sys
import time
import traceback
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from celery.signals import (
    worker_init,
    worker_ready, 
    worker_process_init,
    worker_shutting_down,
    task_prerun,
    task_postrun,
    task_failure
)

# Import app and config
from .app import app
from .config import config

# Global worker state for monitoring and debugging
worker_state = {
    'initialized': False,
    'ready': False,
    'start_time': None,
    'process_id': None,
    'tasks_completed': 0,
    'tasks_failed': 0,
    'environment_validated': False,
    'services_validated': False
}

def setup_logging():
    """Setup comprehensive logging configuration"""
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, config.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),  # Console output
        ]
    )
    
    # Configure Celery loggers
    celery_logger = logging.getLogger('celery')
    celery_logger.setLevel(logging.INFO)
    
    # Configure worker logger
    worker_logger = logging.getLogger('celery.worker')
    worker_logger.setLevel(logging.INFO)
    
    # Configure task logger
    task_logger = logging.getLogger('celery.task')
    task_logger.setLevel(logging.INFO)
    
    return logging.getLogger(__name__)

# Initialize logger after config is available
logger = setup_logging()

# ============================================================================
# WORKER INITIALIZATION SIGNALS
# ============================================================================

@worker_init.connect
def setup_worker_environment(**kwargs):
    """
    Call when initializing worker environment
    This is the earliest initialization step - environment variables and basic configuration
    """
    start_time = time.time()
    worker_state['start_time'] = start_time
    worker_state['process_id'] = os.getpid()
    
    logger.info("="*60)
    logger.info("🚀 Celery Worker initialization started")
    logger.info(f"Process ID: {os.getpid()}")
    logger.info("="*60)
    
    try:
        # Check environment variables
        logger.info("🔐 Check sensitive variables")
        sensitive_vars = {
            'REDIS_URL': config.redis_url,
            'ELASTICSEARCH_SERVICE': config.elasticsearch_service,
            'ELASTICSEARCH_API_KEY': config.elasticsearch_api_key,
            'ELASTIC_PASSWORD': config.elastic_password
        }
        
        for var_name, var_value in sensitive_vars.items():
            if var_value:
                if 'PASSWORD' in var_name or 'KEY' in var_name:
                    masked_value = f"{var_value[:4]}...{var_value[-4:]}" if len(var_value) > 8 else "***"
                    logger.info(f"  ✅ {var_name}: {masked_value}")
                else:
                    logger.info(f"  ✅ {var_name}: {var_value}")
            else:
                logger.error(f"  ❌ {var_name}: NOT SET")
        
        worker_state['initialized'] = True
        elapsed = time.time() - start_time
        logger.debug(f"✅ Worker environment initialized (time: {elapsed:.2f} s)")
        
    except Exception as e:
        logger.error(f"❌ Worker environment initialization failed: {str(e)}")
        logger.error(f"Error details: {traceback.format_exc()}")
        # Do not exit here, let Celery handle the error
        raise

@worker_process_init.connect
def setup_worker_process_resources(**kwargs):
    """
    Call when initializing each worker process
    Suitable for initializing process-specific resources (e.g. database connection pool)
    """
    process_id = os.getpid()
    logger.info(f"🔧 Initialize worker process {process_id}")
    
    try:
        # Initialize process-specific resources
        # e.g. database connection pool, cache client, etc.
        
        # Validate critical service connections
        logger.debug("🔗 Validate service connections")
        validate_service_connections()
        worker_state['services_validated'] = True
        logger.debug("✅ Service connections validated")
        
        # Initialize heavy objects like DataProcessCore
        logger.debug("⚙️ Initialize data processing components")
        # Here we can pre-initialize global objects to avoid delays on the first task
        
        logger.debug(f"✅ Worker process {process_id} initialized")
        
    except Exception as e:
        logger.error(f"❌ Worker process {process_id} initialization failed: {str(e)}")
        raise

@worker_ready.connect
def worker_ready_handler(**kwargs):
    """
    Call when worker is fully ready
    Suitable for registering services, starting monitoring, etc.
    """
    process_id = os.getpid()
    start_time = worker_state.get('start_time')
    total_startup_time = time.time() - start_time if start_time else 0
    
    worker_state['ready'] = True
    
    logger.debug("🎉 " + "="*50)
    logger.debug("🎉 Celery Worker is fully ready!")
    logger.debug(f"🎉 Process ID: {process_id}")
    logger.debug(f"🎉 Total startup time: {total_startup_time:.2f} s")
    logger.debug("🎉 " + "="*50)
    
    # Display worker status summary
    logger.debug("📊 Worker status summary:")
    for key, value in worker_state.items():
        logger.debug(f"  {key}: {value}")
    
    # Register health check endpoints, start monitoring, etc.
    logger.debug("🔍 Worker is ready to receive tasks")

@worker_shutting_down.connect
def worker_shutdown_handler(**kwargs):
    """Worker关闭时的清理操作"""
    process_id = worker_state.get('process_id', os.getpid())
    uptime = time.time() - worker_state.get('start_time', time.time())
    
    logger.debug("🛑 " + "="*50)
    logger.info("🛑 Celery Worker is shutting down...")
    logger.debug(f"🛑 Process ID: {process_id}")
    logger.debug(f"🛑 Uptime: {uptime:.2f} s")
    logger.info(f"🛑 Completed tasks: {worker_state.get('tasks_completed', 0)}")
    logger.info(f"🛑 Failed tasks: {worker_state.get('tasks_failed', 0)}")
    logger.debug("🛑 " + "="*50)

@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """任务执行前的处理"""
    logger.debug(f"📋 任务开始: {task.name}[{task_id}]")

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, retval=None, state=None, **kwds):
    """任务执行后的处理"""
    if state == 'SUCCESS':
        worker_state['tasks_completed'] += 1
        logger.debug(f"✅ 任务完成: {task.name}[{task_id}]")
    else:
        logger.debug(f"⚠️ 任务结束: {task.name}[{task_id}] - 状态: {state}")

@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, einfo=None, **kwds):
    """任务失败时的处理"""
    worker_state['tasks_failed'] += 1
    logger.error(f"❌ 任务失败: {sender.name}[{task_id}] - 异常: {str(exception)}")

# ============================================================================
# Service validation functions
# ============================================================================

def validate_service_connections() -> bool:
    """Validate critical service connections"""
    try:
        # Validate Redis connection
        logger.debug("🔗 Validate Redis connection")
        validate_redis_connection()
        logger.debug("✅ Redis connection is valid")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Service connection validation failed: {str(e)}")
        # 根据业务需求决定是否抛出异常
        # 这里选择记录错误但不阻止worker启动
        return False

def validate_redis_connection() -> bool:
    """Validate Redis connection"""
    try:
        import redis
        redis_url = config.redis_url
        
        # Parse Redis URL and create connection
        redis_client = redis.from_url(redis_url, socket_timeout=5)
        
        # Test connection
        redis_client.ping()
        return True
        
    except ImportError:
        logger.warning("⚠️ Redis client not installed, skipping Redis connection validation")
        return False
    except Exception as e:
        logger.error(f"Redis connection failed: {str(e)}")
        raise

# ============================================================================
# Worker startup function
# ============================================================================

def start_worker():
    """Start Celery worker with appropriate settings"""
    
    # Get configuration parameters
    queues = os.environ.get('QUEUES', 'process_q,forward_q')
    worker_name = os.environ.get('WORKER_NAME', f'worker-{os.getpid()}')
    concurrency = int(os.environ.get('WORKER_CONCURRENCY', '4'))
    
    logger.info(f"Start Celery worker '{worker_name}' with queues: {queues}")
    logger.info(f"Worker concurrency: {concurrency}")
    
    # Display Celery configuration information
    logger.info("📋 Celery configuration information:")
    logger.info(f"  Broker URL: {app.conf.broker_url}")
    logger.info(f"  Backend URL: {app.conf.result_backend}")
    logger.info(f"  Task routes: {app.conf.task_routes}")
    logger.info(f"  Task time limit: {config.celery_task_time_limit} s")
    logger.info(f"  Worker prefetch multiplier: {config.celery_worker_prefetch_multiplier}")
    
    # Worker startup parameters
    worker_args = [
        'worker',
        '--loglevel=info',
        f'--queues={queues}',
        f'--hostname={worker_name}@%h',
        f'--concurrency={concurrency}',
        '--pool=threads',
        '--task-events',     # Enable task events (for Flower monitoring)
    ]
    
    try:
        logger.info(f"🚀 Start worker '{worker_name}'...")
        
        # Flush stdout to ensure immediate output
        sys.stdout.flush()
        
        # Start worker - signal handlers will be executed at appropriate times
        app.worker_main(worker_args)
        
    except KeyboardInterrupt:
        logger.info(f"🛑 Worker '{worker_name}' was interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Error starting worker '{worker_name}': {str(e)}")
        logger.error(f"Error details: {traceback.format_exc()}")
        sys.exit(1)

if __name__ == '__main__':
    start_worker()
else:
    # Support importing this module and calling start_worker()
    logger.info("Worker module imported, will not start worker automatically")