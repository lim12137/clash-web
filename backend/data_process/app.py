"""
Celery application configuration for data processing tasks
"""
import os
import logging
from celery import Celery

# Configure logging
logger = logging.getLogger("data_process.app")

# Determine package path dynamically
import_path = 'data_process.tasks'
logger.info(f"Using import path: {import_path}")

# Define Redis broker URL with fallback
REDIS_URL = os.environ.get('REDIS_URL')
REDIS_BACKEND_URL = os.environ.get('REDIS_BACKEND_URL')
if not REDIS_URL or not REDIS_BACKEND_URL:
    raise ValueError("REDIS_URL or REDIS_BACKEND_URL environment variable is not set")

# Create Celery app instance
app = Celery(
    'nexent',
    broker=REDIS_URL,
    backend=REDIS_BACKEND_URL,
    elasticsearch_service=os.environ.get('ELASTICSEARCH_SERVICE'),
    elasticsearch_api_key=os.environ.get('ELASTICSEARCH_API_KEY'),
    elastic_password=os.environ.get('ELASTIC_PASSWORD'),
    include=[import_path]
)

# Configure Celery settings
app.conf.update(
    # Two task queues for processing and forward steps
    task_routes={
        f'{import_path}.process': {'queue': 'process_q'},
        f'{import_path}.forward': {'queue': 'forward_q'},
        f'{import_path}.process_and_forward': {'queue': 'process_q'}
    },
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    enable_utc=True,
    # Result backend settings
    task_ignore_result=False,  # Task results must be stored for chains to work
    task_track_started=True,   # Track when tasks start
    task_time_limit=3600,      # 1 hour time limit per task
    worker_prefetch_multiplier=1,  # Don't prefetch tasks, process one at a time
    worker_max_tasks_per_child=100,  # Restart worker after 100 tasks
    # Important for task chains
    task_acks_late=True,       # Tasks are acknowledged after completion
    task_reject_on_worker_lost=True,  # Tasks are rejected if worker is lost
    # Result won't expire for tasks
    result_expires=None,
    result_persistent=True,
    # Monitoring and task events for Flower
    task_send_sent_event=True,  # Send task-sent events
    worker_send_task_events=True,  # Enable task events from workers
    worker_hijack_root_logger=False,  # Don't hijack logging
)

# Set simplified logging format to avoid timestamp duplication
# app.conf.worker_log_format = '[%(task_name)s(%(task_id)s)] %(message)s' 