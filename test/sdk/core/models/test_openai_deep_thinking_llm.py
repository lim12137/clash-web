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
        messages = [{"role": "user", "content": "test message"}]

        # Mock an error response
        deep_thinking_model_instance.client.chat.completions.create.side_effect = Exception("context_length_exceeded")

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs"), pytest.raises(
                ValueError) as exc_info:
            deep_thinking_model_instance(messages)

        assert "Token limit exceeded" in str(exc_info.value)


    @pytest.mark.asyncio
    async def test_call_with_stop_event(deep_thinking_model_instance):
        """Test __call__ method handles stop event correctly."""
        messages = [{"role": "user", "content": "test message"}]

        # Set up mock chunks that will be interrupted
        mock_chunks = [
            MagicMock(choices=[MagicMock(delta=MagicMock(content="Start ", role="assistant"))])
        ]
        deep_thinking_model_instance.client.chat.completions.create.return_value = mock_chunks

        # Set the stop event
        deep_thinking_model_instance.stop_event.set()

        with patch.object(deep_thinking_model_instance, "_prepare_completion_kwargs"), pytest.raises(
                RuntimeError) as exc_info:
            deep_thinking_model_instance(messages)

        assert "Model is interrupted by stop event" in str(exc_info.value)
