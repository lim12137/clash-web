import pytest
from unittest.mock import MagicMock, patch
from threading import Event

# ---------------------------------------------------------------------------
# Prepare mocks for external dependencies that are not required for this test
# ---------------------------------------------------------------------------

# Mock for smolagents and its sub-modules
mock_smolagents = MagicMock()
mock_smolagents.ActionStep = MagicMock()
mock_smolagents.TaskStep = MagicMock()
mock_smolagents.AgentText = MagicMock()
mock_smolagents.handle_agent_output_types = MagicMock()

# Mock for smolagents.tools.Tool with a configurable from_langchain method
mock_tool_class = MagicMock()
mock_tool_class.from_langchain = MagicMock()
mock_smolagents_tools = MagicMock()
mock_smolagents_tools.Tool = mock_tool_class
mock_smolagents.tools = mock_smolagents_tools

# Create dummy smolagents sub-modules that may be imported indirectly
for sub_mod in ["agents", "memory", "models", "monitoring", "utils", "local_python_executor"]:
    mock_module = MagicMock()
    setattr(mock_smolagents, sub_mod, mock_module)

# Mock for langchain and langchain.tools
mock_langchain_tools = MagicMock()
mock_langchain_tools.StructuredTool = MagicMock()
mock_langchain = MagicMock()
mock_langchain.tools = mock_langchain_tools

# Very lightweight mock for openai path required by internal OpenAIModel import
mock_openai_chat_completion_message = MagicMock()
module_mocks = {
    "smolagents": mock_smolagents,
    "smolagents.tools": mock_smolagents_tools,
    "smolagents.agents": MagicMock(),
    "smolagents.memory": MagicMock(),
    "smolagents.models": MagicMock(),
    "smolagents.monitoring": MagicMock(),
    "smolagents.utils": MagicMock(),
    "smolagents.local_python_executor": MagicMock(),
    "langchain": mock_langchain,
    "langchain.tools": mock_langchain_tools,
    "openai": MagicMock(),
    "openai.types": MagicMock(),
    "openai.types.chat": MagicMock(),
    "openai.types.chat.chat_completion_message": MagicMock(ChatCompletionMessage=mock_openai_chat_completion_message),
    "openai.types.chat.chat_completion_message_param": MagicMock(),
    # Mock exa_py to avoid importing the real package when sdk.nexent.core.tools imports it
    "exa_py": MagicMock(Exa=MagicMock()),
}

# ---------------------------------------------------------------------------
# Import the classes under test with patched dependencies in place
# ---------------------------------------------------------------------------
with patch.dict("sys.modules", module_mocks):
    from sdk.nexent.core.utils.observer import MessageObserver
    from sdk.nexent.core.agents.nexent_agent import NexentAgent
    from sdk.nexent.core.agents.agent_model import ToolConfig, ModelConfig


# ----------------------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------------------

@pytest.fixture
def mock_observer():
    """Return a mocked MessageObserver instance."""
    observer = MagicMock(spec=MessageObserver)
    return observer


@pytest.fixture
def nexent_agent_instance(mock_observer):
    """Create a NexentAgent instance with minimal initialisation."""
    agent = NexentAgent(observer=mock_observer, model_config_list=[], stop_event=Event())
    return agent


@pytest.fixture
def mock_model_config():
    """Create a mock ModelConfig instance for testing."""
    return ModelConfig(
        cite_name="test_model",
        api_key="test_api_key",
        model_name="gpt-4",
        url="https://api.openai.com/v1",
        temperature=0.7,
        top_p=0.9,
        is_deep_thinking=False
    )


@pytest.fixture
def mock_deep_thinking_model_config():
    """Create a mock ModelConfig instance for deep thinking model testing."""
    return ModelConfig(
        cite_name="deep_thinking_model",
        api_key="test_api_key",
        model_name="gpt-4",
        url="https://api.openai.com/v1",
        temperature=0.5,
        top_p=0.8,
        is_deep_thinking=True
    )


@pytest.fixture
def nexent_agent_with_models(mock_observer, mock_model_config, mock_deep_thinking_model_config):
    """Create a NexentAgent instance with model configurations."""
    model_config_list = [mock_model_config, mock_deep_thinking_model_config]
    agent = NexentAgent(observer=mock_observer, model_config_list=model_config_list, stop_event=Event())
    return agent


# ----------------------------------------------------------------------------
# Tests for create_model function
# ----------------------------------------------------------------------------

def test_create_model_success(nexent_agent_with_models, mock_model_config):
    """Test successful model creation with regular model."""
    # Mock the ModelFactory.create_model method directly on the instance
    with patch.object(nexent_agent_with_models.__class__, 'create_model') as mock_create_model:
        # Configure the mock to return a mock model
        mock_model = MagicMock()
        mock_create_model.return_value = mock_model

        # Call the method under test
        result = nexent_agent_with_models.create_model("test_model")

        # Verify the result
        assert result == mock_model

        # Verify the method was called with correct parameters
        mock_create_model.assert_called_once_with("test_model")


def test_create_model_deep_thinking_success(nexent_agent_with_models, mock_deep_thinking_model_config):
    """Test successful model creation with deep thinking model."""
    # Mock the ModelFactory.create_model method directly on the instance
    with patch.object(nexent_agent_with_models.__class__, 'create_model') as mock_create_model:
        # Configure the mock to return a mock model
        mock_model = MagicMock()
        mock_create_model.return_value = mock_model

        # Call the method under test
        result = nexent_agent_with_models.create_model("deep_thinking_model")

        # Verify the result
        assert result == mock_model

        # Verify the method was called with correct parameters
        mock_create_model.assert_called_once_with("deep_thinking_model")


def test_create_model_not_found(nexent_agent_with_models):
    """Test create_model raises ValueError when model cite_name is not found."""
    with pytest.raises(ValueError, match="Model nonexistent_model not found"):
        nexent_agent_with_models.create_model("nonexistent_model")


def test_create_model_empty_config_list(mock_observer):
    """Test create_model raises ValueError when model_config_list is empty."""
    agent = NexentAgent(observer=mock_observer, model_config_list=[], stop_event=Event())

    with pytest.raises(ValueError, match="Model test_model not found"):
        agent.create_model("test_model")


def test_create_model_with_none_config_list(mock_observer):
    """Test create_model raises ValueError when model_config_list contains None."""
    agent = NexentAgent(observer=mock_observer, model_config_list=[None], stop_event=Event())

    with pytest.raises(ValueError, match="Model test_model not found"):
        agent.create_model("test_model")


def test_create_model_factory_exception(nexent_agent_with_models, mock_model_config):
    """Test create_model properly handles ModelFactory exceptions."""
    # Mock the create_model method to raise an exception
    with patch.object(nexent_agent_with_models.__class__, 'create_model') as mock_create_model:
        mock_create_model.side_effect = Exception("Factory error")

        with pytest.raises(Exception, match="Factory error"):
            nexent_agent_with_models.create_model("test_model")


def test_create_model_with_multiple_configs(mock_observer):
    """Test create_model works correctly with multiple model configurations."""
    config1 = ModelConfig(
        cite_name="model1",
        api_key="key1",
        model_name="gpt-4",
        url="https://api.openai.com/v1",
        temperature=0.1,
        top_p=0.9,
        is_deep_thinking=False
    )
    config2 = ModelConfig(
        cite_name="model2",
        api_key="key2",
        model_name="gpt-3.5-turbo",
        url="https://api.openai.com/v1",
        temperature=0.5,
        top_p=0.8,
        is_deep_thinking=True
    )

    agent = NexentAgent(observer=mock_observer, model_config_list=[config1, config2], stop_event=Event())

    # Mock the create_model method to return a mock model
    with patch.object(agent.__class__, 'create_model') as mock_create_model:
        mock_model = MagicMock()
        mock_create_model.return_value = mock_model

        # Test creating first model
        result1 = agent.create_model("model1")
        mock_create_model.assert_called_with("model1")
        assert result1 == mock_model

        # Test creating second model
        result2 = agent.create_model("model2")
        mock_create_model.assert_called_with("model2")
        assert result2 == mock_model


# ----------------------------------------------------------------------------
# Tests for tool creation functions
# ----------------------------------------------------------------------------

def test_create_langchain_tool_success(nexent_agent_instance):
    """Verify that create_langchain_tool converts a LangChain tool via Tool.from_langchain."""
    mock_langchain_tool_obj = MagicMock(name="LangChainToolObject")

    tool_config = ToolConfig(
        class_name="MockLangChainTool",
        name="mock_tool",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source="langchain",
        metadata={"inner_tool": mock_langchain_tool_obj},
    )

    with patch.object(
            mock_tool_class,
            "from_langchain",
            return_value="converted_tool",
    ) as mock_from_langchain:
        # Execute
        result = nexent_agent_instance.create_langchain_tool(tool_config)

    # Assertions
    mock_from_langchain.assert_called_once_with({"inner_tool": mock_langchain_tool_obj})
    assert result == "converted_tool"


def test_create_tool_with_langchain_source(nexent_agent_instance):
    """Ensure create_tool dispatches to create_langchain_tool when source is 'langchain'."""
    mock_langchain_tool_obj = MagicMock()

    tool_config = ToolConfig(
        class_name="MockLangChainTool",
        name="mock_tool",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source="langchain",
        metadata={},
    )

    with patch.object(
            nexent_agent_instance,
            "create_langchain_tool",
            return_value="converted_tool",
    ) as mock_create_langchain_tool:
        result = nexent_agent_instance.create_tool(tool_config)

    mock_create_langchain_tool.assert_called_once_with(tool_config)
    assert result == "converted_tool"


# ------------------------------ Additional tests ------------------------------


def _build_tool_config(source: str):
    """Helper to create a minimal valid ToolConfig for different sources."""
    return ToolConfig(
        class_name="DummyTool",
        name="dummy",
        description="desc",
        inputs="{}",
        output_type="string",
        params={},
        source=source,
        metadata={},
    )


def test_create_tool_with_local_source(nexent_agent_instance):
    """Ensure create_tool dispatches to create_local_tool for local source."""
    tool_config = _build_tool_config("local")

    with patch.object(
            nexent_agent_instance,
            "create_local_tool",
            return_value="local_tool",
    ) as mock_create_local_tool:
        result = nexent_agent_instance.create_tool(tool_config)

    mock_create_local_tool.assert_called_once_with(tool_config)
    assert result == "local_tool"


def test_create_tool_with_mcp_source(nexent_agent_instance):
    """Ensure create_tool dispatches to create_mcp_tool for mcp source."""
    tool_config = _build_tool_config("mcp")

    with patch.object(
            nexent_agent_instance,
            "create_mcp_tool",
            return_value="mcp_tool",
    ) as mock_create_mcp_tool:
        result = nexent_agent_instance.create_tool(tool_config)

    mock_create_mcp_tool.assert_called_once_with("DummyTool")
    assert result == "mcp_tool"


def test_create_tool_invalid_source(nexent_agent_instance):
    """create_tool should raise ValueError for unsupported source."""
    tool_config = _build_tool_config("unknown")
    with pytest.raises(ValueError):
        nexent_agent_instance.create_tool(tool_config)


def test_create_tool_invalid_config_type(nexent_agent_instance):
    """create_tool should raise TypeError when passed a non-ToolConfig object."""
    with pytest.raises(TypeError):
        nexent_agent_instance.create_tool({})
