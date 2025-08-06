from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Prepare mocks for external dependencies similar to test_openai_llm.py
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
        # Return the message as-is for testing
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
    from sdk.nexent.core.models.openai_deep_thinking_llm import OpenAIDeepThinkingModel


    # -----------------------------------------------------------------------
    # Fixtures
    # -----------------------------------------------------------------------

    @pytest.fixture()
    def deep_thinking_model_instance():
        """Return an OpenAIDeepThinkingModel instance with minimal viable attributes for tests."""

        observer = MagicMock()
        model = OpenAIDeepThinkingModel(observer=observer)

        # Inject dummy attributes required by the method under test
        model.model_id = "dummy-model"
        model.temperature = 0.7
        model.top_p = 1.0
        model.custom_role_conversions = {}

        # Create a proper mock for stop_event that returns False by default
        mock_stop_event = MagicMock()
        mock_stop_event.is_set.return_value = False
        model.stop_event = mock_stop_event

        # Client hierarchy: client.chat.completions.create
        mock_client = MagicMock()
        mock_chat = MagicMock()
        mock_completions = MagicMock()
        mock_completions.create = MagicMock()
        mock_chat.completions = mock_completions
        mock_client.chat = mock_chat
        model.client = mock_client

        return model


    # ---------------------------------------------------------------------------
    # Tests for process_token
    # ---------------------------------------------------------------------------

    def test_process_token_with_think_tags(deep_thinking_model_instance):
        """Test process_token handles think tags correctly."""
        # Test opening think tag
        result = deep_thinking_model_instance.process_token("Hello <think>thinking")
        assert result == "Hello thinking"
        assert deep_thinking_model_instance.observer.in_think_block is True

        # Test closing think tag
        result = deep_thinking_model_instance.process_token("done thinking</think> continue")
        assert result == "done thinking continue"
        assert deep_thinking_model_instance.observer.in_think_block is False

        # Test normal token without tags
        result = deep_thinking_model_instance.process_token("normal text")
        assert result == "normal text"


    @pytest.mark.asyncio
    async def test_call_with_token_limit_error(deep_thinking_model_instance):
        """Test __call__ method handles token limit errors correctly."""
        messages = [{"role": "user", "content": [{"text": "test message"}]}]

        # Mock an error response
        deep_thinking_model_instance.client.chat.completions.create.side_effect = Exception("context_length_exceeded")

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs"), pytest.raises(
                ValueError) as exc_info:
            deep_thinking_model_instance(messages)

        assert "Token limit exceeded" in str(exc_info.value)


    @pytest.mark.asyncio
    async def test_call_with_stop_event(deep_thinking_model_instance):
        """Test __call__ method handles stop event correctly."""
        messages = [{"role": "user", "content": [{"text": "test message"}]}]

        # Set up mock chunks that will be interrupted
        mock_chunks = [
            MagicMock(choices=[MagicMock(delta=MagicMock(content="Start ", role="assistant"))])
        ]
        deep_thinking_model_instance.client.chat.completions.create.return_value = mock_chunks

        # Configure the stop event to return True when is_set() is called
        deep_thinking_model_instance.stop_event.is_set.return_value = True

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs"), pytest.raises(
                RuntimeError) as exc_info:
            deep_thinking_model_instance(messages)

        assert "Model is interrupted by stop event" in str(exc_info.value)


    # ---------------------------------------------------------------------------
    # Tests for token processing and output generation
    # ---------------------------------------------------------------------------

    def test_call_normal_operation_with_usage_tracking(deep_thinking_model_instance):
        """Test __call__ method with normal operation and usage tracking."""
        messages = [{"role": "user", "content": [{"text": "Hello"}]}]

        # Mock the stream response with usage info
        mock_chunk1 = MagicMock()
        mock_chunk1.choices = [MagicMock()]
        mock_chunk1.choices[0].delta.content = "Hello"
        mock_chunk1.choices[0].delta.role = "assistant"

        mock_chunk2 = MagicMock()
        mock_chunk2.choices = [MagicMock()]
        mock_chunk2.choices[0].delta.content = " world"
        mock_chunk2.choices[0].delta.role = None
        mock_chunk2.usage = MagicMock()
        mock_chunk2.usage.prompt_tokens = 10
        mock_chunk2.usage.total_tokens = 15

        mock_stream = [mock_chunk1, mock_chunk2]

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs", return_value={}):
            deep_thinking_model_instance.client.chat.completions.create.return_value = mock_stream

            # Call the method
            result = deep_thinking_model_instance.__call__(messages)

            # Verify observer calls
            deep_thinking_model_instance.observer.add_model_new_token.assert_any_call("Hello")
            deep_thinking_model_instance.observer.add_model_new_token.assert_any_call(" world")
            deep_thinking_model_instance.observer.flush_remaining_tokens.assert_called_once()

            # Verify token counts were set
            assert deep_thinking_model_instance.last_input_token_count == 10
            assert deep_thinking_model_instance.last_output_token_count == 15

            # Verify result is a ChatMessage
            assert isinstance(result, MagicMock)  # Since we're mocking the parent class method


    def test_call_with_no_usage_info(deep_thinking_model_instance):
        """Test __call__ method handles case where usage info is None."""
        messages = [{"role": "user", "content": [{"text": "Hello"}]}]

        # Mock the stream response with no usage info
        mock_chunk = MagicMock()
        mock_chunk.choices = [MagicMock()]
        mock_chunk.choices[0].delta.content = "Response"
        mock_chunk.choices[0].delta.role = "assistant"
        mock_chunk.usage = None

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs", return_value={}):
            deep_thinking_model_instance.client.chat.completions.create.return_value = [mock_chunk]

            # Call the method
            deep_thinking_model_instance.__call__(messages)

            # Verify token counts are set to 0 when usage is None
            assert deep_thinking_model_instance.last_input_token_count == 0
            assert deep_thinking_model_instance.last_output_token_count == 0


    def test_call_with_deep_thinking_tokens(deep_thinking_model_instance):
        """Test __call__ method processes deep thinking tokens correctly."""
        messages = [{"role": "user", "content": [{"text": "Think about this"}]}]

        # Mock the stream response with think tags
        mock_chunk1 = MagicMock()
        mock_chunk1.choices = [MagicMock()]
        mock_chunk1.choices[0].delta.content = "<think>"
        mock_chunk1.choices[0].delta.role = "assistant"

        mock_chunk2 = MagicMock()
        mock_chunk2.choices = [MagicMock()]
        mock_chunk2.choices[0].delta.content = "deep thinking"
        mock_chunk2.choices[0].delta.role = None

        mock_chunk3 = MagicMock()
        mock_chunk3.choices = [MagicMock()]
        mock_chunk3.choices[0].delta.content = "</think>"
        mock_chunk3.choices[0].delta.role = None

        mock_chunk4 = MagicMock()
        mock_chunk4.choices = [MagicMock()]
        mock_chunk4.choices[0].delta.content = "final answer"
        mock_chunk4.choices[0].delta.role = None
        mock_chunk4.usage = MagicMock()
        mock_chunk4.usage.prompt_tokens = 5
        mock_chunk4.usage.total_tokens = 8

        mock_stream = [mock_chunk1, mock_chunk2, mock_chunk3, mock_chunk4]

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs", return_value={}):
            deep_thinking_model_instance.client.chat.completions.create.return_value = mock_stream

            # Call the method
            deep_thinking_model_instance.__call__(messages)

            # Verify that deep thinking tokens were processed correctly
            # The think tags should be removed and content should be added to message_query
            assert deep_thinking_model_instance.observer.in_think_block is False  # Should end as False
            deep_thinking_model_instance.observer.add_model_new_token.assert_any_call("final answer")


    def test_call_with_mixed_thinking_and_normal_tokens(deep_thinking_model_instance):
        """Test __call__ method handles mixed thinking and normal tokens."""
        messages = [{"role": "user", "content": [{"text": "Mixed content"}]}]

        # Mock the stream response with mixed content
        mock_chunk1 = MagicMock()
        mock_chunk1.choices = [MagicMock()]
        mock_chunk1.choices[0].delta.content = "Normal "
        mock_chunk1.choices[0].delta.role = "assistant"

        mock_chunk2 = MagicMock()
        mock_chunk2.choices = [MagicMock()]
        mock_chunk2.choices[0].delta.content = "<think>thinking"
        mock_chunk2.choices[0].delta.role = None

        mock_chunk3 = MagicMock()
        mock_chunk3.choices = [MagicMock()]
        mock_chunk3.choices[0].delta.content = "</think>"
        mock_chunk3.choices[0].delta.role = None

        mock_chunk4 = MagicMock()
        mock_chunk4.choices = [MagicMock()]
        mock_chunk4.choices[0].delta.content = " more normal"
        mock_chunk4.choices[0].delta.role = None
        mock_chunk4.usage = MagicMock()
        mock_chunk4.usage.prompt_tokens = 8
        mock_chunk4.usage.total_tokens = 12

        mock_stream = [mock_chunk1, mock_chunk2, mock_chunk3, mock_chunk4]

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs", return_value={}):
            deep_thinking_model_instance.client.chat.completions.create.return_value = mock_stream

            # Call the method
            deep_thinking_model_instance.__call__(messages)

            # Verify that normal tokens were added to observer
            deep_thinking_model_instance.observer.add_model_new_token.assert_any_call("Normal ")
            deep_thinking_model_instance.observer.add_model_new_token.assert_any_call(" more normal")

            # Verify token counts
            assert deep_thinking_model_instance.last_input_token_count == 8
            assert deep_thinking_model_instance.last_output_token_count == 12


    def test_call_with_null_tokens(deep_thinking_model_instance):
        """Test __call__ method handles null tokens in stream."""
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

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs", return_value={}):
            deep_thinking_model_instance.client.chat.completions.create.return_value = [mock_chunk1, mock_chunk2]

            # Call the method
            deep_thinking_model_instance.__call__(messages)

            # Verify that null tokens are handled correctly (not added to observer)
            deep_thinking_model_instance.observer.add_model_new_token.assert_called_once_with("Response")


    def test_call_with_general_exception(deep_thinking_model_instance):
        """Test __call__ method re-raises general exceptions."""
        messages = [{"role": "user", "content": [{"text": "Hello"}]}]

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs", return_value={}):
            # Mock the client to raise a general exception
            deep_thinking_model_instance.client.chat.completions.create.side_effect = Exception("General error")

            # Call the method and expect the same exception
            with pytest.raises(Exception, match="General error"):
                deep_thinking_model_instance.__call__(messages)


    def test_call_with_context_length_exceeded_error(deep_thinking_model_instance):
        """Test __call__ method handles context_length_exceeded error correctly."""
        messages = [{"role": "user", "content": [{"text": "Hello"}]}]

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs", return_value={}):
            # Mock the client to raise context length exceeded error
            deep_thinking_model_instance.client.chat.completions.create.side_effect = Exception(
                "context_length_exceeded: token limit exceeded")

            # Call the method and expect ValueError
            with pytest.raises(ValueError, match="Token limit exceeded"):
                deep_thinking_model_instance.__call__(messages)
