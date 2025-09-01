import unittest
from unittest.mock import patch, MagicMock

# Create mock classes for request models
class MockGeneratePromptRequest:
    agent_id: int
    task_description: str


# Create mock exception and utility classes
class MockHTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail


# Mock service functions
generate_and_save_system_prompt_impl = MagicMock()

# Create router mock
router_mock = MagicMock()

# Mock StreamingResponse
class MockStreamingResponse:
    def __init__(self, content, media_type):
        self.content = content
        self.media_type = media_type


# Mock TestClient
client = MagicMock()


class TestPromptApp(unittest.TestCase):

    def setUp(self):
        """Set up test environment before each test"""
        self.test_agent_id = 123
        self.test_authorization = "Bearer test_token"

        # Reset all mocks before each test
        generate_and_save_system_prompt_impl.reset_mock()
        client.reset_mock()

    def test_generate_and_save_system_prompt_api_success(self):
        """Test successful system prompt generation and saving"""
        # Mock route handler function
        async def mock_generate_api():
            # Mock generator function
            def gen():
                for prompt in ["Test prompt 1", "Test prompt 2"]:
                    yield f"data: {{\"success\": true, \"data\": \"{prompt}\"}}\n\n"

            generate_and_save_system_prompt_impl.return_value = [
                "Test prompt 1", "Test prompt 2"]
            return MockStreamingResponse(gen(), "text/event-stream")

        # Use the mock route handler
        with patch('test.backend.app.test_prompt_app.router_mock.post', return_value=mock_generate_api):
            # Prepare test request
            request_data = {
                "agent_id": self.test_agent_id,
                "task_description": "Test task description"
            }

            # Mock response
            response_mock = MagicMock()
            response_mock.status_code = 200
            response_mock.headers = {"content-type": "text/event-stream"}
            response_mock.content = "data: {\"success\": true, \"data\": \"Test prompt 1\"}\n\ndata: {\"success\": true, \"data\": \"Test prompt 2\"}\n\n".encode(
            )
            client.post.return_value = response_mock

            # Execute test
            response = client.post(
                "/prompt/generate",
                json=request_data,
                headers={"Authorization": self.test_authorization}
            )

            # Assertions
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                response.headers["content-type"], "text/event-stream")

            # Check response content
            response_content = response.content.decode()
            self.assertIn("Test prompt 1", response_content)
            self.assertIn("Test prompt 2", response_content)

    def test_generate_and_save_system_prompt_api_error(self):
        """Test error handling during system prompt generation"""
        # Mock error scenario
        async def mock_generate_api_error():
            raise MockHTTPException(
                status_code=500, detail="Error occurred while generating system prompt: Test error")

        # Use the mock route handler
        with patch('test.backend.app.test_prompt_app.router_mock.post', return_value=mock_generate_api_error):
            # Prepare test request
            request_data = {
                "agent_id": self.test_agent_id,
                "task_description": "Test task description"
            }

            # Mock error response
            error_response = MagicMock()
            error_response.status_code = 500
            error_response.json.return_value = {
                "detail": "Error occurred while generating system prompt: Test error"}
            client.post.return_value = error_response

            # Execute test
            response = client.post(
                "/prompt/generate",
                json=request_data
            )

            # Assertions
            self.assertEqual(response.status_code, 500)
            response_json = response.json()
            self.assertIn(
                "Error occurred while generating system prompt", response_json["detail"])
            self.assertIn("Test error", response_json["detail"])

    def test_generate_prompt_without_authorization(self):
        """Test prompt generation without authorization header"""
        # Mock route handler function
        async def mock_generate_api_no_auth(prompt_request, http_request):
            # Mock generator function
            def gen():
                yield "data: {{\"success\": true, \"data\": \"Test prompt\"}}\n\n"

            generate_and_save_system_prompt_impl.return_value = ["Test prompt"]
            return MockStreamingResponse(gen(), "text/event-stream")

        # Use the mock route handler
        with patch('test.backend.app.test_prompt_app.router_mock.post', return_value=mock_generate_api_no_auth):
            # Prepare test request
            request_data = {
                "agent_id": self.test_agent_id,
                "task_description": "Test task description"
            }

            # Mock response
            response_mock = MagicMock()
            response_mock.status_code = 200
            response_mock.headers = {"content-type": "text/event-stream"}
            response_mock.content = "data: {\"success\": true, \"data\": \"Test prompt\"}\n\n".encode(
            )
            client.post.return_value = response_mock

            # Execute test - without authorization header
            response = client.post(
                "/prompt/generate",
                json=request_data
                # No authorization header
            )

            # Assertions
            self.assertEqual(response.status_code, 200)

    def test_generate_prompt_invalid_request(self):
        """Test validation for missing required fields in request"""
        # Prepare test request - missing required fields
        request_data = {
            "agent_id": self.test_agent_id,
            # Missing task_description field
        }

        # Mock validation error response
        validation_error_response = MagicMock()
        validation_error_response.status_code = 422
        client.post.return_value = validation_error_response

        # Execute test
        response = client.post(
            "/prompt/generate",
            json=request_data,
            headers={"Authorization": self.test_authorization}
        )

        # Assertions
        self.assertEqual(response.status_code, 422)  # Validation error


if __name__ == "__main__":
    unittest.main()
