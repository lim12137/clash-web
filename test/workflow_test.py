import unittest
import os
import sys
import logging
from datetime import datetime

# Get the directory where the script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Create test-results directory in the same directory as the script
TEST_RESULTS_DIR = os.path.join(SCRIPT_DIR, 'test-results')
# Ensure test-results directory exists
os.makedirs(TEST_RESULTS_DIR, exist_ok=True)
# Set up log file path
LOG_FILE = os.path.join(TEST_RESULTS_DIR, 'test.log')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, mode='w', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


class TestEnvironment(unittest.TestCase):
    def test_python_version(self):
        """Test Python version is 3.10"""
        logger.info(f"Python version: {sys.version}")
        self.assertTrue(sys.version.startswith('3.10'))

    def test_working_directory(self):
        """Test working directory exists and is accessible"""
        current_dir = os.getcwd()
        logger.info(f"Current working directory: {current_dir}")
        self.assertTrue(os.path.exists(current_dir))


def main():
    # Log test start
    logger.info("Starting automated tests...")
    logger.info(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Log file location: {LOG_FILE}")

    # Run tests
    unittest.main(verbosity=2)

    # Log test completion
    logger.info("Tests completed")
    logger.info(f"Test finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == '__main__':
    main()
