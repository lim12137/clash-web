import os
import sys
from unittest.mock import MagicMock

# Dynamically determine the backend path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)

# Mock external dependencies before importing the modules that use them
sys.modules['database.client'] = MagicMock()
sys.modules['database.agent_db'] = MagicMock()
sys.modules['agents.create_agent_info'] = MagicMock()
sys.modules['nexent.core.agents.run_agent'] = MagicMock()
sys.modules['supabase'] = MagicMock()
sys.modules['utils.auth_utils'] = MagicMock()
sys.modules['utils.config_utils'] = MagicMock()
sys.modules['utils.thread_utils'] = MagicMock()
sys.modules['agents.agent_run_manager'] = MagicMock()
sys.modules['services.agent_service'] = MagicMock()
sys.modules['services.conversation_management_service'] = MagicMock()
sys.modules['services.memory_config_service'] = MagicMock()

# Create a mock for services module to ensure agent_service is accessible
mock_services = MagicMock()
mock_agent_service = MagicMock()
mock_services.agent_service = mock_agent_service
sys.modules['services'] = mock_services

# Test if we can access services.agent_service
try:
    import services
    print("services module imported successfully")
    print(f"services.agent_service: {services.agent_service}")
    print(f"type: {type(services.agent_service)}")
    print("Mock setup successful!")
except Exception as e:
    print(f"Error: {e}")
