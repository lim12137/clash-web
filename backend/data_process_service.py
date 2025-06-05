import uvicorn
import os
import sys
import subprocess
import signal
import logging
import argparse
import time
import threading
from contextlib import asynccontextmanager
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI


# Load environment variables
load_dotenv()

# Configure logging with simplified format
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s %(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Global variables to track processes
service_processes = {
    'redis': None,
    'workers': [],
    'flower': None,
}

class ServiceManager:
    """Manage all data processing related services"""
    
    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.redis_port = config.get('redis_port', 6379)
        self.flower_port = config.get('flower_port', 5555)
        self._shutdown_called = False  # Flag to prevent multiple shutdowns
        
    def start_redis(self):
        """Start Redis server if not already running"""
        # Local Redis is not supported yet
        redis_url = os.environ.get('REDIS_URL', f'redis://localhost:{self.redis_port}/0')
        return self._check_redis_connection(redis_url)
    
    def _check_redis_connection(self, redis_url: str) -> bool:
        """Check Redis connection using Python redis client"""
        redis_url = os.environ.get('REDIS_URL')
        try:
            import redis
            redis_client = redis.from_url(redis_url, socket_timeout=5, socket_connect_timeout=5)
            redis_client.ping()
            logger.info(f"✅ Redis connection successful: {redis_url}")
            return True
        except ImportError:
            logger.error("❌ Redis Python client not available. Please install: pip install redis")
            return False
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {str(e)}")
            return False
    
    def start_workers(self):
        """Start Celery workers for process and forward queues"""
        if not self.config.get('start_workers', True):
            logger.info("Workers startup disabled by configuration")
            return True
            
        try:
            # Check if we're in Docker environment
            docker_env = os.environ.get('DOCKER_ENVIRONMENT', 'false').lower() == 'true'
            logger.info(f"Starting workers in {'Docker' if docker_env else 'development'} environment")
            
            # Define worker configurations based on new architecture
            workers_config = [
                {
                    'name': 'process-worker',
                    'queue': 'process_q',
                    'concurrency': 8  # High concurrency for file processing
                },
                {
                    'name': 'forward-worker', 
                    'queue': 'forward_q',
                    'concurrency': 2  # Lower concurrency for vectorization/storage
                }
            ]
            
            # Start each worker in a separate process
            for config in workers_config:
                # Use full Python path and correct module path
                worker_cmd = [
                    sys.executable, '-c',
                    f'''
import sys, os, logging

# The CWD for subprocess.Popen is already set to the 'backend' directory.
# PYTHONPATH is also set to the 'backend' directory by the parent process.
# So, modules within 'data_process' should be directly importable.

# Ensure the current working directory (backend) is in path for relative imports if any.
# Also ensure the parent of CWD (project root) is in path for nexent.* imports
project_root = os.path.dirname(os.getcwd())
if os.getcwd() not in sys.path:
    sys.path.insert(0, os.getcwd())
if project_root not in sys.path:
    sys.path.insert(0, project_root)

logging.basicConfig(level=logging.INFO, format='[%(asctime)s: %(levelname)s/%(name)s] %(message)s')
os.environ["QUEUES"] = "{config['queue']}"
os.environ["WORKER_NAME"] = "{config['name']}"
os.environ["WORKER_CONCURRENCY"] = "{config['concurrency']}"

try:
    # Ensure the Celery app is discovered correctly
    from data_process.app import app as celery_app
    logger = logging.getLogger("data_process.worker_launcher")
    logger.info(f"Celery app instance: {{celery_app}}")
    logger.info(f"Attempting to start worker for queue: {config['queue']}")

    from data_process.worker import start_worker
    start_worker()
except ImportError as e:
    print(f"Import error: {{e}}")
    print(f"Python path: {{sys.path}}")
    print(f"Current directory: {{os.getcwd()}}")
    sys.exit(1)
except Exception as e_exec:
    print(f"Error executing worker: {{e_exec}}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)
                    '''
                ]

                logger.info(f"Starting {config['name']} worker for queue: {config['queue']} with concurrency: {config['concurrency']}")

                # Get the backend directory path to ensure correct module import
                # This should resolve to the 'backend' directory where this service script is located.
                backend_dir = os.path.dirname(os.path.abspath(__file__))
                if not os.path.isdir(os.path.join(backend_dir, "data_process")) :
                     # if this service script itself is not in backend, but one level up
                     possible_backend_dir = os.path.join(backend_dir, "backend")
                     if os.path.isdir(os.path.join(possible_backend_dir, "data_process")):
                         backend_dir = possible_backend_dir


                # Set environment variables for the worker process
                worker_env = os.environ.copy()
                # Ensure REDIS_URL is correctly passed from the parent environment
                if 'REDIS_URL' in os.environ: # Make sure it is set
                    worker_env['REDIS_URL'] = os.environ['REDIS_URL']
                else: # Default if not set. This should match your Celery app config.
                     worker_env['REDIS_URL'] = f'redis://localhost:{self.redis_port}/0'

                # PYTHONPATH should point to the project root to allow nexent.data_process
                # and also backend to allow data_process.*
                project_root_dir = os.path.dirname(backend_dir)
                python_path_entries = [project_root_dir, backend_dir]
                existing_python_path = worker_env.get('PYTHONPATH')
                if existing_python_path:
                    python_path_entries.extend(existing_python_path.split(os.pathsep))
                worker_env['PYTHONPATH'] = os.pathsep.join(list(dict.fromkeys(python_path_entries))) # Unique entries

                logger.info(f"Worker CWD: {backend_dir}")
                logger.info(f"Worker PYTHONPATH: {worker_env['PYTHONPATH']}")

                # Start the worker process with real-time output
                process = subprocess.Popen(
                    worker_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    cwd=backend_dir,  # Run from backend directory for module import
                    env=worker_env  # Pass environment variables
                )
                
                service_processes['workers'].append({
                    'process': process,
                    'name': config['name'],
                    'queue': config['queue']
                })
                
                logger.info(f"Started {config['name']} worker with PID: {process.pid}")
                
                # Start a thread to capture and log worker output
                def log_worker_output(process, worker_name):
                    try:
                        for line in iter(process.stdout.readline, ''):
                            if line.strip():
                                # Clean up redundant timestamps and worker info from output
                                clean_line = line.strip()
                                
                                # Remove timestamp prefix if present (e.g., "[2025-05-24 07:35:02,461: INFO/...")
                                if clean_line.startswith('[') and ': ' in clean_line:
                                    # Find the first ']' and extract the message part
                                    bracket_end = clean_line.find(']', 1)
                                    if bracket_end != -1 and bracket_end < len(clean_line) - 1:
                                        clean_line = clean_line[bracket_end + 1:].strip()
                                        
                                # Remove additional worker prefixes like "[process-worker]"
                                while clean_line.startswith('[') and ']' in clean_line:
                                    bracket_end = clean_line.find(']')
                                    if bracket_end != -1:
                                        clean_line = clean_line[bracket_end + 1:].strip()
                                    else:
                                        break
                                
                                # Only log meaningful messages
                                if clean_line and not clean_line.startswith('Worker module imported'):
                                    logger.info(f"[{worker_name}] {clean_line}")
                    except Exception as e:
                        logger.warning(f"Error in log thread for worker {worker_name}: {str(e)}")
                        # Thread will exit gracefully, worker process continues
                    finally:
                        logger.debug(f"Log thread for worker {worker_name} has terminated")
                
                output_thread = threading.Thread(
                    target=log_worker_output, 
                    args=(process, config['name']),
                    daemon=True
                )
                output_thread.start()
            
            logger.info("✅ All Celery workers started successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error starting workers: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def start_flower(self):
        """Start Flower monitoring for Celery"""
        if not self.config.get('start_flower', True):
            logger.info("Flower monitoring startup disabled by configuration")
            return True
            
        try:
            logger.info(f"Starting Flower monitoring on port {self.flower_port}...")
            
            # Get Redis URL from environment to ensure consistency
            redis_url = os.environ.get('REDIS_URL')
            
            # Flower 2.0+ uses environment variables for configuration
            flower_cmd = [
                'python', '-m', 'flower',
                '-A', 'data_process.app',
                'flower'  # Use the flower subcommand
            ]
            
            # Set up environment variables for Flower configuration
            flower_env = os.environ.copy()
            flower_env.update({
                'FLOWER_PORT': str(self.flower_port),
                'FLOWER_BROKER_API': redis_url,
                'FLOWER_BASIC_AUTH': 'admin:admin',
                'FLOWER_PERSISTENT': 'True',
                'FLOWER_DB': 'flower_db.sqlite',
                'FLOWER_AUTO_REFRESH': 'True',
                'FLOWER_MAX_WORKERS': '5000',
                'FLOWER_MAX_TASKS': '10000'
            })
            
            # Get the backend directory path to ensure correct module import
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            
            process = subprocess.Popen(
                flower_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=backend_dir,  # Run from backend directory for module import
                env=flower_env  # Pass environment variables for configuration
            )
            
            service_processes['flower'] = process
            logger.info(f"Flower monitoring started with PID: {process.pid}")
            logger.info(f"🌸 Flower web interface: http://localhost:{self.flower_port}")
            
            # Start thread to log Flower output
            def log_flower_output():
                try:
                    for line in iter(process.stdout.readline, ''):
                        if line.strip():
                            # Clean up redundant timestamps and logging info from Flower output
                            clean_line = line.strip()
                            if ' - ' in clean_line:
                                # Remove timestamp and level if present in Flower log line
                                parts = clean_line.split(' - ')
                                if len(parts) > 1:
                                    clean_line = ' - '.join(parts[1:])
                            logger.info(f"[Flower] {clean_line}")
                except Exception as e:
                    logger.warning(f"Error in Flower log thread: {str(e)}")
                    # Thread will exit gracefully, Flower process continues
                finally:
                    logger.debug("Flower log thread has terminated")
            
            output_thread = threading.Thread(target=log_flower_output, daemon=True)
            output_thread.start()
            
            # Wait a moment to check if Flower actually started
            time.sleep(2)
            
            # Check if process is still running
            if process.poll() is not None:
                logger.error(f"❌ Flower process exited with return code {process.returncode}")
                return False
            
            return True
            
        except FileNotFoundError:
            logger.error("❌ Flower not found. Please install: pip install flower")
            logger.error("   Note: Use 'python -m flower' instead of 'flower' command")
            return False
        except Exception as e:
            logger.error(f"❌ Error starting Flower: {str(e)}")
            return False
    
    def start_all_services(self):
        """Start all configured services"""
        logger.info("🚀 Starting Data Processing Services")
        logger.info("=" * 50)
        
        # Start services in specific order for proper dependencies
        services = [
            ("Redis", self.start_redis, 'start_redis'),
            ("Celery Workers", self.start_workers, 'start_workers'),
            ("Flower Monitoring", self.start_flower, 'start_flower')
        ]
        
        success_count = 0
        enabled_count = 0
        
        for service_name, start_func, config_key in services:
            if self.config.get(config_key, True):
                enabled_count += 1
                logger.info(f"Starting {service_name}...")
                if start_func():
                    success_count += 1
                    
                    # Add delay after starting workers to allow registration
                    if service_name == "Celery Workers":
                        logger.info("Waiting for workers to register...")
                        time.sleep(5)  # Give workers time to connect and register
                    
                else:
                    logger.warning(f"Failed to start {service_name}")
            else:
                logger.info(f"Skipping {service_name} (disabled by configuration)")
        
        logger.info("=" * 50)
        logger.info(f"✅ Started {success_count}/{enabled_count} services successfully")
        
        if success_count > 0:
            self.print_service_info()
        
        return success_count == enabled_count
    
    def print_service_info(self):
        """Print information about running services"""
        logger.info("\n📋 Service Information:")
        logger.info("-" * 30)
        
        logger.info(f"🔴 Redis: {os.environ.get('REDIS_URL')}")
        
        if self.config.get('start_workers', True):
            logger.info(f"👷 Workers: {len(service_processes['workers'])} processes")
            for worker in service_processes['workers']:
                logger.info(f"   - {worker['name']}: queue={worker['queue']}")
        
        if self.config.get('start_flower', True):
            logger.info(f"🌸 Flower: http://localhost:{self.flower_port}")
        
        logger.info("-" * 30)
    
    def stop_all_services(self):
        """Stop all running services"""
        if self._shutdown_called:
            return
        
        self._shutdown_called = True
        
        logger.info("🛑 Stopping all services...")
        
        # Stop Flower
        if service_processes['flower']:
            try:
                logger.info("Stopping Flower monitoring...")
                service_processes['flower'].terminate()
                service_processes['flower'].wait(timeout=5)
                logger.info("Flower stopped")
            except:
                service_processes['flower'].kill()
                logger.info("Flower force killed")
            service_processes['flower'] = None
        
        # Stop workers
        if service_processes['workers']:
            logger.info("Stopping Celery workers...")
            for worker_info in service_processes['workers']:
                process = worker_info['process']
                name = worker_info['name']
                
                try:
                    if process.poll() is None:
                        logger.info(f"Terminating {name} worker (PID: {process.pid})")
                        process.terminate()
                        
                        try:
                            process.wait(timeout=10)
                            logger.info(f"{name} worker terminated gracefully")
                        except subprocess.TimeoutExpired:
                            logger.warning(f"{name} worker didn't terminate gracefully, killing it")
                            process.kill()
                            process.wait()
                    else:
                        logger.info(f"{name} worker already terminated")
                        
                except Exception as e:
                    logger.error(f"Error stopping {name} worker: {str(e)}")
            
            service_processes['workers'].clear()
            logger.info("All workers stopped")
        
        # Stop Redis
        if service_processes['redis']:
            try:
                logger.info("Stopping Redis server...")
                service_processes['redis'].terminate()
                service_processes['redis'].wait(timeout=5)
                logger.info("Redis stopped")
            except:
                service_processes['redis'].kill()
                logger.info("Redis force killed")
            service_processes['redis'] = None
        
        logger.info("✅ All services stopped")

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Data Processing Service with integrated Redis, Workers, and Monitoring",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python data_process_service.py                    # Start all services
  python data_process_service.py --no-flower        # Skip Flower monitoring
  python data_process_service.py --redis-port 6380  # Use custom Redis port
        """
    )
    
    # Service control arguments
    parser.add_argument('--no-local-redis', action='store_true',
                       help='Do not start Redis server')
    parser.add_argument('--no-workers', action='store_true',
                       help='Do not start Celery workers')
    parser.add_argument('--no-flower', action='store_true',
                       help='Do not start Flower monitoring')
    
    # Port configuration
    parser.add_argument('--redis-port', type=int, default=6379,
                       help='Redis server port (default: 6379)')
    parser.add_argument('--flower-port', type=int, default=5555,
                       help='Flower monitoring port (default: 5555)')
    
    # API server configuration
    parser.add_argument('--api-host', default='0.0.0.0',
                       help='API server host (default: 0.0.0.0)')
    parser.add_argument('--api-port', type=int, default=5012,
                       help='API server port (default: 5012)')
    
    return parser.parse_args()

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, shutting down...")
    if 'service_manager' in globals() and service_manager:
        service_manager.stop_all_services()
    sys.exit(0)

# Register signal handlers for graceful shutdown
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Global service manager for cleanup
service_manager = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan event handler for startup and shutdown"""
    global service_manager
    
    # Startup
    logger.info("Starting data processing service...")
    
    # Services should already be started by main()
    logger.info("Data processing service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down data processing service...")
    if service_manager and not service_manager._shutdown_called:
        service_manager.stop_all_services()
    logger.info("Data processing service shutdown complete")

def create_app():
    """Create FastAPI application"""
    # Lazy import router to avoid overhead during module initialization
    from apps.data_process_app import router as data_process_router
    
    app = FastAPI(root_path="/api", lifespan=lifespan)
    app.include_router(data_process_router)
    return app

def main():
    """Main entry point"""
    global service_manager
    
    # Parse command line arguments
    args = parse_arguments()
    
    # Create service configuration
    config = {
        'start_workers': not args.no_workers,
        'start_flower': not args.no_flower,
        'redis_port': args.redis_port,
        'flower_port': args.flower_port,
    }
    
    # Create service manager
    service_manager = ServiceManager(config)
    
    # Note: Using lifespan and signal handlers for cleanup instead of atexit
    # to avoid multiple cleanup calls
    
    try:
        # Start all configured services
        service_manager.start_all_services()
        
        # Create and start FastAPI app
        app = create_app()
        
        logger.info(f"🌐 Starting API server on {args.api_host}:{args.api_port}")
        uvicorn.run(
            app, 
            host=args.api_host,
            port=args.api_port,
            log_level="info"
        )
        
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Error starting service: {str(e)}")
        sys.exit(1)
    finally:
        if service_manager and not service_manager._shutdown_called:
            service_manager.stop_all_services()

if __name__ == "__main__":
    main()
