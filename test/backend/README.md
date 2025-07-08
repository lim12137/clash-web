# Backend Test Suite

## Running Tests

The `run_all_test.py` script allows you to run all backend tests with coverage reporting. 

### How to Run

```bash
python test/backend/run_all_test.py
```

Or from the test/backend directory:

```bash
python run_all_test.py
```

### What's Included

The test suite automatically:

1. Discovers and runs all test files that follow the pattern `test_*.py` in:
   - `test/backend/app/` directory
   - `test/backend/services/` directory

2. Generates code coverage reports for the backend code:
   - Console output with line-by-line coverage details
   - HTML coverage report in `test/backend/coverage_html/`
   - XML coverage report at `test/backend/coverage.xml`

3. Provides a summary of test results:
   - Total tests run
   - Tests passed/failed
   - Overall pass rate
   - Code coverage percentage

### Dependencies

The script will automatically install required packages if they're not already available:
- `pytest-cov`
- `coverage`

## Testing Framework and Approach

### Testing Framework

The backend tests primarily use:
- **unittest**: Python's standard unit testing framework for test organization and assertions
- **unittest.mock**: For mocking dependencies and isolating components
- **TestClient** from FastAPI: For testing API endpoints without running an actual server

### Testing Strategy

The test files follow these key principles:

1. **Dependency Isolation**: 
   - External modules are mocked before imports to avoid real connections
   - Database connections, ElasticSearch, and other external services are mocked
   - No actual database operations are performed during tests

2. **Mock-based Testing**:
   - HTTP requests are simulated using FastAPI's TestClient
   - External service calls are intercepted with mock objects
   - No actual network connections or port bindings occur

3. **Test Organization**:
   - Tests are organized as classes inheriting from `unittest.TestCase`
   - Each API endpoint or function has multiple test cases (success, failure, exception scenarios)
   - Comprehensive patches are applied to isolate the code under test

4. **API Testing**:
   - API endpoints are tested for correct response codes, payload structure, and error handling
   - Both synchronous and asynchronous endpoints are covered
   - Streaming responses are tested through specialized test cases

This approach ensures that tests can run in any environment without impacting real infrastructure, databases, or services.

## Module Patching Example

A critical technique used in the test suite is patching modules before they're imported. This prevents any real connections to external services. Here's an example from `test_file_management_app.py`:

```python
# Dynamically determine the backend path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../../backend"))
sys.path.append(backend_dir)

# Setup patches for dependencies before importing modules
patches = [
    patch('botocore.client.BaseClient._make_api_call', return_value={}),
    patch('backend.database.client.MinioClient', MagicMock()),
    patch('backend.database.client.db_client', MagicMock()),
    patch('backend.utils.auth_utils.get_current_user_id', MagicMock(return_value=('test_user', 'test_tenant'))),
    patch('backend.utils.attachment_utils.convert_image_to_text', 
          MagicMock(side_effect=lambda query, image_input, tenant_id, language='zh': 'mocked image text')),
    patch('backend.utils.attachment_utils.convert_long_text_to_text', 
          MagicMock(side_effect=lambda query, file_context, tenant_id, language='zh': 'mocked text content')),
    patch('httpx.AsyncClient', MagicMock())
]

# Start all patches
for p in patches:
    p.start()

# Now import the modules after applying all patches
from fastapi.testclient import TestClient
from fastapi import UploadFile, HTTPException
from fastapi import FastAPI
from backend.apps.file_management_app import router

# Create a FastAPI app and include the router for testing
app = FastAPI()
app.include_router(router)
client = TestClient(app)
```

### Code Explanation

1. **Path Configuration**:
   - The code dynamically determines the path to the backend directory
   - Adds it to Python's module search path using `sys.path.append()`
   - This allows tests to import backend modules using relative paths

2. **Patches Creation**:
   - Creates a list of patches that target specific modules and functions
   - `patch('botocore.client.BaseClient._make_api_call', return_value={})` prevents any AWS API calls
   - `patch('backend.database.client.MinioClient', MagicMock())` replaces the file storage client
   - `patch('backend.database.client.db_client', MagicMock())` mocks the database client
   - Authentication functions are mocked to return predictable test values
   - Utility functions for file processing are mocked with simple return values
   - HTTP clients are mocked to prevent network calls

3. **Applying Patches**:
   - All patches are activated with `p.start()` before any imports happen
   - This is crucial: modules are patched BEFORE they are imported
   - When a module is imported, it will use the mocked dependencies instead of real ones

4. **Module Imports**:
   - Only after all patches are active, the code imports the necessary modules
   - These imported modules will use mocked dependencies instead of real ones
   - The router being tested is imported from the backend apps

5. **Test Client Setup**:
   - Creates a FastAPI test application and includes the router
   - Sets up a TestClient to simulate HTTP requests without starting a real server
   - The client will use all the mocked dependencies for testing

### Benefits of This Approach

This "patch-before-import" strategy ensures:

1. **Complete Isolation**: No real external services are ever contacted
2. **No Side Effects**: Tests can't modify production databases or services
3. **Faster Tests**: No network delays or external service processing time
4. **Predictable Results**: Tests use controlled mock data for consistent results
5. **No Port Binding**: The FastAPI application never binds to a real network port

This technique is used throughout the test suite to ensure that tests can be run safely in any environment without affecting real infrastructure.

## Detailed Test Example

Below is a detailed walkthrough of a sample test function (`test_list_tools_api_success`) to demonstrate the testing approach:

```python
@patch("utils.auth_utils.get_current_user_id")
@patch("database.agent_db.query_all_tools")
async def test_list_tools_api_success(self, mock_query_all_tools, mock_get_current_user_id):
    # Setup
    mock_get_current_user_id.return_value = ("user123", "tenant456")
    expected_tools = [{"id": 1, "name": "Tool1"}, {"id": 2, "name": "Tool2"}]
    mock_query_all_tools.return_value = expected_tools
    
    # Execute
    result = await list_tools_api(authorization="Bearer fake_token")
    
    # Assert
    mock_get_current_user_id.assert_called_once_with("Bearer fake_token")
    mock_query_all_tools.assert_called_once_with(tenant_id="tenant456")
    self.assertEqual(result, expected_tools)
```

### Line-by-Line Explanation

1. **Decorators**:
   ```python
   @patch("utils.auth_utils.get_current_user_id")
   @patch("database.agent_db.query_all_tools")
   ```
   - These `@patch` decorators temporarily replace the real functions with mock objects
   - The patched functions are replaced in reverse order (bottom to top)
   - This prevents the code from accessing real external services like authentication and databases

2. **Function Declaration**:
   ```python
   async def test_list_tools_api_success(self, mock_query_all_tools, mock_get_current_user_id):
   ```
   - This is an asynchronous test method using Python's `async/await` syntax
   - The mock objects are automatically passed as parameters in the reverse order of the decorators
   - `self` refers to the test class instance (TestCase)

3. **Test Setup**:
   ```python
   mock_get_current_user_id.return_value = ("user123", "tenant456")
   expected_tools = [{"id": 1, "name": "Tool1"}, {"id": 2, "name": "Tool2"}]
   mock_query_all_tools.return_value = expected_tools
   ```
   - Sets up the behavior of mock objects
   - Defines what these mocked functions should return when called
   - Creates test data that simulates the expected result from the database

4. **Test Execution**:
   ```python
   result = await list_tools_api(authorization="Bearer fake_token")
   ```
   - Calls the actual function being tested (`list_tools_api`)
   - Passes a fake authorization token
   - Uses `await` because `list_tools_api` is an asynchronous function

5. **Test Assertions**:
   ```python
   mock_get_current_user_id.assert_called_once_with("Bearer fake_token")
   ```
   - Verifies that the authentication function was called exactly once
   - Ensures it was called with the expected parameter (the token)

   ```python
   mock_query_all_tools.assert_called_once_with(tenant_id="tenant456")
   ```
   - Verifies the database query function was called once
   - Confirms it was called with the correct tenant ID (extracted from authentication)

   ```python
   self.assertEqual(result, expected_tools)
   ```
   - Verifies the function's return value matches the expected result
   - Ensures the API correctly returns the tools from the database

### Testing Philosophy

This example demonstrates the core testing philosophy:

1. **Isolate the unit**: Mock all external dependencies
2. **Control the environment**: Set up precise test conditions
3. **Test the interface**: Focus on inputs and outputs
4. **Verify behavior**: Check both results and interactions

By following this pattern, tests are reliable, fast, and don't affect real systems or data.
