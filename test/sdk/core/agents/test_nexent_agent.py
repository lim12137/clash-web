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
    from sdk.nexent.core.agents.agent_model import ToolConfig

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

# ----------------------------------------------------------------------------
# Tests
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