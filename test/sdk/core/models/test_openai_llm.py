import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Prepare mocks for external dependencies similar to test_core_agent.py
# ---------------------------------------------------------------------------

# Mock smolagents and submodules
mock_smolagents = MagicMock()
mock_smolagents.Tool = MagicMock()

# Create dummy sub-modules and attributes
mock_models_module = MagicMock()

# Provide a minimal OpenAIServerModel base with the method needed by OpenAIModel
class DummyOpenAIServerModel:
    def __init__(self, *args, **kwargs):
        pass

    def _prepare_completion_kwargs(self, *args, **kwargs):
        # In tests we will patch this method on the instance directly, so default impl is fine
        return {}

    def postprocess_message(self, message, tools_to_call_from=None):
        # Default implementation for testing
        return message

mock_models_module.OpenAIServerModel = DummyOpenAIServerModel
mock_models_module.ChatMessage = MagicMock()
mock_smolagents.models = mock_models_module

# Assemble smolagents.* paths
module_mocks = {
    "smolagents": mock_smolagents,
    "smolagents.models": mock_models_module,
    "openai.types": MagicMock(),
    "openai.types.chat": MagicMock(),
    "openai.types.chat.chat_completion_message": MagicMock(),
}


with patch.dict("sys.modules", module_mocks):

    # Import after patching so dependencies are satisfied
    from sdk.nexent.core.models.openai_llm import OpenAIModel as ImportedOpenAIModel


    # -----------------------------------------------------------------------
    # Fixtures
    # -----------------------------------------------------------------------

    @pytest.fixture()
    def openai_model_instance():
        """Return an OpenAIModel instance with minimal viable attributes for tests."""

        observer = MagicMock()
        model = ImportedOpenAIModel(observer=observer)

        # Inject dummy attributes required by the method under test
        model.model_id = "dummy-model"
        model.custom_role_conversions = {}  # Add missing attribute

        # Client hierarchy: client.chat.completions.create
        mock_client = MagicMock()
        mock_chat = MagicMock()
        mock_completions = MagicMock()
        mock_completions.create = MagicMock()
        mock_chat.completions = mock_completions
        mock_client.chat = mock_chat
        model.client = mock_client

        return model

    @pytest.fixture()
    def mock_chat_message():
        """Create a mock ChatMessage for testing"""
        mock_message = MagicMock()
        mock_message.raw = MagicMock()
        return mock_message


# ---------------------------------------------------------------------------
# Tests for check_connectivity
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_connectivity_success(openai_model_instance):
    """check_connectivity should return True when no exception is raised."""

    with patch.object(
        openai_model_instance,
        "_prepare_completion_kwargs",
        return_value={},
    ) as mock_prepare_kwargs, patch(
        "sdk.nexent.core.models.openai_llm.asyncio.to_thread",
        new_callable=AsyncMock,
        return_value=None,
    ) as mock_to_thread:
        result = await openai_model_instance.check_connectivity()

        assert result is True
        mock_prepare_kwargs.assert_called_once()
        mock_to_thread.assert_awaited_once()


@pytest.mark.asyncio
async def test_check_connectivity_failure(openai_model_instance):
    """check_connectivity should return False when an exception is raised inside to_thread."""

    with patch.object(
        openai_model_instance,
        "_prepare_completion_kwargs",
        return_value={},
    ), patch(
        "sdk.nexent.core.models.openai_llm.asyncio.to_thread",
        new_callable=AsyncMock,
        side_effect=Exception("connection error"),
    ):
        result = await openai_model_instance.check_connectivity()
        assert result is False


# ---------------------------------------------------------------------------
# Tests for __call__ method
# ---------------------------------------------------------------------------

def test_call_normal_operation(openai_model_instance, mock_chat_message):
    """Test __call__ method with normal operation flow"""
    
    # Setup test messages with correct format
    messages = [
        {"role": "user", "content": [{"text": "Hello"}]},
        {"role": "assistant", "content": [{"text": "Hi there"}]}
    ]
    
    # Mock the stream response
    mock_chunk1 = MagicMock()
    mock_chunk1.choices = [MagicMock()]
    mock_chunk1.choices[0].delta.content = "Hello"
    mock_chunk1.choices[0].delta.role = "assistant"
    
    mock_chunk2 = MagicMock()
    mock_chunk2.choices = [MagicMock()]
    mock_chunk2.choices[0].delta.content = " world"
    mock_chunk2.choices[0].delta.role = None
    
    mock_chunk3 = MagicMock()
    mock_chunk3.choices = [MagicMock()]
    mock_chunk3.choices[0].delta.content = None
    mock_chunk3.choices[0].delta.role = None
    mock_chunk3.usage = MagicMock()
    mock_chunk3.usage.prompt_tokens = 10
    mock_chunk3.usage.total_tokens = 15
    
    mock_stream = [mock_chunk1, mock_chunk2, mock_chunk3]
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}) as mock_prepare, \
         patch.object(openai_model_instance, "postprocess_message", return_value=mock_chat_message) as mock_postprocess:
        
        # Mock the client response
        openai_model_instance.client.chat.completions.create.return_value = mock_stream
        
        # Call the method
        result = openai_model_instance.__call__(messages)
        
        # Verify the result
        assert result == mock_chat_message
        mock_prepare.assert_called_once()
        mock_postprocess.assert_called_once()
        
        # Verify observer calls
        openai_model_instance.observer.add_model_new_token.assert_any_call("Hello")
        openai_model_instance.observer.add_model_new_token.assert_any_call(" world")
        openai_model_instance.observer.flush_remaining_tokens.assert_called_once()
        
        # Verify token counts were set
        assert openai_model_instance.last_input_token_count == 10
        assert openai_model_instance.last_output_token_count == 15


def test_call_with_no_think_token_addition(openai_model_instance, mock_chat_message):
    """Test __call__ method adds /no_think token to user messages"""
    
    # Setup test messages with user as last message
    messages = [
        {"role": "assistant", "content": [{"text": "Hi there"}]},
        {"role": "user", "content": [{"text": "Hello"}]}
    ]
    
    # Mock the stream response
    mock_chunk = MagicMock()
    mock_chunk.choices = [MagicMock()]
    mock_chunk.choices[0].delta.content = "Response"
    mock_chunk.choices[0].delta.role = "assistant"
    mock_chunk.usage = MagicMock()
    mock_chunk.usage.prompt_tokens = 5
    mock_chunk.usage.total_tokens = 8
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}), \
         patch.object(openai_model_instance, "postprocess_message", return_value=mock_chat_message):
        
        openai_model_instance.client.chat.completions.create.return_value = [mock_chunk]
        
        # Call the method
        openai_model_instance.__call__(messages)
        
        # Verify that /no_think was added to the last user message
        assert messages[-1]["content"][-1]["text"] == "Hello /no_think"


def test_call_without_no_think_token(openai_model_instance, mock_chat_message):
    """Test __call__ method doesn't add /no_think when last message is not user"""
    
    # Setup test messages with assistant as last message
    messages = [
        {"role": "user", "content": [{"text": "Hello"}]},
        {"role": "assistant", "content": [{"text": "Hi there"}]}
    ]
    
    # Mock the stream response
    mock_chunk = MagicMock()
    mock_chunk.choices = [MagicMock()]
    mock_chunk.choices[0].delta.content = "Response"
    mock_chunk.choices[0].delta.role = "assistant"
    mock_chunk.usage = MagicMock()
    mock_chunk.usage.prompt_tokens = 5
    mock_chunk.usage.total_tokens = 8
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}), \
         patch.object(openai_model_instance, "postprocess_message", return_value=mock_chat_message):
        
        openai_model_instance.client.chat.completions.create.return_value = [mock_chunk]
        
        # Call the method
        openai_model_instance.__call__(messages)
        
        # Verify that /no_think was NOT added
        assert messages[-1]["content"][-1]["text"] == "Hi there"


def test_call_removes_think_tags(openai_model_instance, mock_chat_message):
    """Test __call__ method removes <think> and </think> tags from tokens"""
    
    messages = [{"role": "user", "content": [{"text": "Hello"}]}]
    
    # Mock the stream response with think tags
    mock_chunk1 = MagicMock()
    mock_chunk1.choices = [MagicMock()]
    mock_chunk1.choices[0].delta.content = "<think>"
    mock_chunk1.choices[0].delta.role = "assistant"
    
    mock_chunk2 = MagicMock()
    mock_chunk2.choices = [MagicMock()]
    mock_chunk2.choices[0].delta.content = "thinking"
    mock_chunk2.choices[0].delta.role = None
    
    mock_chunk3 = MagicMock()
    mock_chunk3.choices = [MagicMock()]
    mock_chunk3.choices[0].delta.content = "</think>"
    mock_chunk3.choices[0].delta.role = None
    mock_chunk3.usage = MagicMock()
    mock_chunk3.usage.prompt_tokens = 5
    mock_chunk3.usage.total_tokens = 8
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}), \
         patch.object(openai_model_instance, "postprocess_message", return_value=mock_chat_message):
        
        openai_model_instance.client.chat.completions.create.return_value = [mock_chunk1, mock_chunk2, mock_chunk3]
        
        # Call the method
        openai_model_instance.__call__(messages)
        
        # Verify that think tags were removed from observer calls
        openai_model_instance.observer.add_model_new_token.assert_any_call("")
        openai_model_instance.observer.add_model_new_token.assert_any_call("thinking")
        openai_model_instance.observer.add_model_new_token.assert_any_call("")


def test_call_stop_event_interruption(openai_model_instance):
    """Test __call__ method raises RuntimeError when stop_event is set"""
    
    messages = [{"role": "user", "content": [{"text": "Hello"}]}]
    
    # Mock the stream response
    mock_chunk = MagicMock()
    mock_chunk.choices = [MagicMock()]
    mock_chunk.choices[0].delta.content = "Response"
    mock_chunk.choices[0].delta.role = "assistant"
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}):
        
        openai_model_instance.client.chat.completions.create.return_value = [mock_chunk]
        
        # Set the stop event before calling
        openai_model_instance.stop_event.set()
        
        # Call the method and expect RuntimeError
        with pytest.raises(RuntimeError, match="Model is interrupted by stop event"):
            openai_model_instance.__call__(messages)


def test_call_context_length_exceeded_error(openai_model_instance):
    """Test __call__ method handles context_length_exceeded error correctly"""
    
    messages = [{"role": "user", "content": [{"text": "Hello"}]}]
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}):
        
        # Mock the client to raise context length exceeded error
        openai_model_instance.client.chat.completions.create.side_effect = Exception("context_length_exceeded: token limit exceeded")
        
        # Call the method and expect ValueError
        with pytest.raises(ValueError, match="Token limit exceeded"):
            openai_model_instance.__call__(messages)


def test_call_general_exception(openai_model_instance):
    """Test __call__ method re-raises general exceptions"""
    
    messages = [{"role": "user", "content": [{"text": "Hello"}]}]
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}):
        
        # Mock the client to raise a general exception
        openai_model_instance.client.chat.completions.create.side_effect = Exception("General error")
        
        # Call the method and expect the same exception
        with pytest.raises(Exception, match="General error"):
            openai_model_instance.__call__(messages)


def test_call_with_no_usage_info(openai_model_instance, mock_chat_message):
    """Test __call__ method handles case where usage info is None"""
    
    messages = [{"role": "user", "content": [{"text": "Hello"}]}]
    
    # Mock the stream response with no usage info
    mock_chunk = MagicMock()
    mock_chunk.choices = [MagicMock()]
    mock_chunk.choices[0].delta.content = "Response"
    mock_chunk.choices[0].delta.role = "assistant"
    mock_chunk.usage = None
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}), \
         patch.object(openai_model_instance, "postprocess_message", return_value=mock_chat_message):
        
        openai_model_instance.client.chat.completions.create.return_value = [mock_chunk]
        
        # Call the method
        openai_model_instance.__call__(messages)
        
        # Verify token counts are set to 0 when usage is None
        assert openai_model_instance.last_input_token_count == 0
        assert openai_model_instance.last_output_token_count == 0


def test_call_with_null_tokens(openai_model_instance, mock_chat_message):
    """Test __call__ method handles null tokens in stream"""
    
    messages = [{"role": "user", "content": [{"text": "Hello"}]}]
    
    # Mock the stream response with null tokens
    mock_chunk1 = MagicMock()
    mock_chunk1.choices = [MagicMock()]
    mock_chunk1.choices[0].delta.content = None
    mock_chunk1.choices[0].delta.role = "assistant"
    
    mock_chunk2 = MagicMock()
    mock_chunk2.choices = [MagicMock()]
    mock_chunk2.choices[0].delta.content = "Response"
    mock_chunk2.choices[0].delta.role = None
    mock_chunk2.usage = MagicMock()
    mock_chunk2.usage.prompt_tokens = 5
    mock_chunk2.usage.total_tokens = 8
    
    with patch.object(openai_model_instance, "_prepare_completion_kwargs", return_value={}), \
         patch.object(openai_model_instance, "postprocess_message", return_value=mock_chat_message):
        
        openai_model_instance.client.chat.completions.create.return_value = [mock_chunk1, mock_chunk2]
        
        # Call the method
        openai_model_instance.__call__(messages)
        
        # Verify that null tokens are handled correctly (not added to observer)
        openai_model_instance.observer.add_model_new_token.assert_called_once_with("Response")
