import pytest
from unittest.mock import MagicMock, patch
from threading import Event


# ---------------------------------------------------------------------------
# Prepare mocks for external dependencies
# ---------------------------------------------------------------------------

# Define custom AgentError that stores .message so CoreAgent code can access it
class MockAgentError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(message)


# Mock for smolagents and its sub-modules
mock_smolagents = MagicMock()
mock_smolagents.ActionStep = MagicMock()
mock_smolagents.TaskStep = MagicMock()
mock_smolagents.SystemPromptStep = MagicMock()
mock_smolagents.AgentError = MockAgentError

mock_smolagents.handle_agent_output_types = MagicMock(return_value="handled_output")

# Create dummy smolagents sub-modules
for sub_mod in ["agents", "memory", "models", "monitoring", "utils", "local_python_executor"]:
    mock_module = MagicMock()
    setattr(mock_smolagents, sub_mod, mock_module)

mock_smolagents.agents.CodeAgent = MagicMock

# Mock for rich modules
mock_rich = MagicMock()
mock_rich_console = MagicMock()
mock_rich_text = MagicMock()

module_mocks = {
    "smolagents": mock_smolagents,
    "smolagents.agents": mock_smolagents.agents,
    "smolagents.memory": mock_smolagents.memory,
    "smolagents.models": mock_smolagents.models,
    "smolagents.monitoring": mock_smolagents.monitoring,
    "smolagents.utils": mock_smolagents.utils,
    "smolagents.local_python_executor": mock_smolagents.local_python_executor,
    "rich.console": mock_rich_console,
    "rich.text": mock_rich_text
}

# ---------------------------------------------------------------------------
# Import the classes under test with patched dependencies
# ---------------------------------------------------------------------------
with patch.dict("sys.modules", module_mocks):
    from sdk.nexent.core.utils.observer import MessageObserver, ProcessType
    from sdk.nexent.core.agents.core_agent import CoreAgent as ImportedCoreAgent
    import sys

    core_agent_module = sys.modules['sdk.nexent.core.agents.core_agent']
    # Override AgentError inside the imported module to ensure it has message attr
    core_agent_module.AgentError = MockAgentError
    CoreAgent = ImportedCoreAgent


# ----------------------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------------------

@pytest.fixture
def mock_observer():
    """Return a mocked MessageObserver instance."""
    observer = MagicMock(spec=MessageObserver)
    return observer


@pytest.fixture
def core_agent_instance(mock_observer):
    """Create a CoreAgent instance with minimal initialization."""
    prompt_templates = {
        "managed_agent": {
            "task": "Task template: {task}",
            "report": "Report template: {final_answer}"
        }
    }
    agent = CoreAgent(
        observer=mock_observer,
        prompt_templates=prompt_templates,
        name="test_agent"
    )
    agent.stop_event = Event()
    agent.memory = MagicMock()
    agent.memory.steps = []
    agent.python_executor = MagicMock()

    agent.step_number = 1
    agent._create_action_step = MagicMock()
    agent._execute_step = MagicMock()
    agent._finalize_step = MagicMock()
    agent._handle_max_steps_reached = MagicMock()

    return agent


# ----------------------------------------------------------------------------
# Tests for _run method
# ----------------------------------------------------------------------------

def test_run_normal_execution(core_agent_instance):
    """Test normal execution path of _run method."""
    # Setup
    task = "test task"
    max_steps = 3
    mock_step = MagicMock()
    mock_step.model_output = "test output"

    # Mock _create_action_step and _execute_step
    with patch.object(core_agent_instance, '_create_action_step', return_value=mock_step) as mock_create_step, \
            patch.object(core_agent_instance, '_execute_step', return_value="final_answer") as mock_execute_step, \
            patch.object(core_agent_instance, '_finalize_step') as mock_finalize_step:
        core_agent_instance.step_number = 1

        # Execute
        result = list(core_agent_instance._run_stream(task, max_steps))

        # Assertions
        assert len(result) == 2  # Should yield action step and final answer
        assert result[0] == mock_step  # First yield should be the action step


def test_run_with_max_steps_reached(core_agent_instance):
    """Test _run method when max steps are reached without final answer."""
    # Setup
    task = "test task"
    max_steps = 2
    mock_step = MagicMock()

    # Mock methods to simulate reaching max steps without finding answer
    with patch.object(core_agent_instance, '_create_action_step', return_value=mock_step) as mock_create_step, \
            patch.object(core_agent_instance, '_execute_step', return_value=None) as mock_execute_step, \
            patch.object(core_agent_instance, '_finalize_step') as mock_finalize_step, \
            patch.object(core_agent_instance, '_handle_max_steps_reached',
                         return_value="max_steps_reached") as mock_handle_max:
        core_agent_instance.step_number = 1

        # Execute
        result = list(core_agent_instance._run_stream(task, max_steps))

        # Debug information
        print(f"\nResult length: {len(result)}")
        print(f"Result contents: {result}")

        # Assertions
        # assert len(result) == 3, f"Expected 3 results but got {len(result)}: {result}"
        assert result[0] == mock_step, "First result should be the first action step"
        assert result[1] == mock_step, "Second result should be the second action step"

        # Verify method calls
        assert mock_create_step.call_count == 2
        assert mock_execute_step.call_count == 2
        mock_handle_max.assert_called_once()
        assert mock_finalize_step.call_count == 2


def test_run_with_stop_event(core_agent_instance):
    """Test _run method when stop event is set."""
    # Setup
    task = "test task"
    max_steps = 3
    mock_step = MagicMock()

    def set_stop_event(*args):
        core_agent_instance.stop_event.set()
        return None

    # Mock _execute_step to set stop event
    with patch.object(core_agent_instance, '_create_action_step', return_value=mock_step):
        with patch.object(core_agent_instance, '_execute_step', side_effect=set_stop_event):
            with patch.object(core_agent_instance, '_finalize_step'):
                # Execute
                result = list(core_agent_instance._run_stream(task, max_steps))

    # Assertions
    assert len(result) == 2  # Should yield action step and "<user_break>"


def test_run_with_agent_error(core_agent_instance):
    """Test _run method when AgentError occurs."""
    # Setup
    task = "test task"
    max_steps = 3
    mock_step = MagicMock()
    mock_step.model_output = "test model output"

    # Mock _execute_step to raise AgentError
    with patch.object(core_agent_instance, '_create_action_step', return_value=mock_step):
        with patch.object(core_agent_instance, '_execute_step',
                          side_effect=MockAgentError("test error")) as mock_execute_step, \
                patch.object(core_agent_instance, '_finalize_step'):
            # Execute
            result = list(core_agent_instance._run_stream(task, max_steps))

    # Assertions
    assert result[0] == mock_step
    assert hasattr(mock_step, 'error')  # Error should be set on the step


def test_run_with_agent_parse_error_branch(core_agent_instance):
    """Ensure branch that converts model_output via convert_code_format is covered."""

    task = "parse task"
    max_steps = 1
    mock_step = MagicMock()
    mock_step.model_output = "unformatted answer"

    parse_hint = "Make sure to include code with the correct pattern, for instance"

    # 监听 convert_code_format 调用
    with patch.object(core_agent_instance, '_create_action_step', return_value=mock_step), \
            patch.object(core_agent_instance, '_execute_step', side_effect=MockAgentError(f"{parse_hint} - error")), \
            patch.object(core_agent_module, 'convert_code_format', return_value="formatted answer") as mock_convert, \
            patch.object(core_agent_instance, '_finalize_step'):
        results = list(core_agent_instance._run_stream(task, max_steps))

    # _run 应该产出 action step + 处理后的结果
    assert results[0] == mock_step
    # assert results[1] == "handled_output"

    # 确认 convert_code_format 被调用一次
    mock_convert.assert_called_once_with("unformatted answer")
    # handle_agent_output_types 处理了转换后的结果
    # mock_smolagents.handle_agent_output_types.assert_any_call("formatted answer")

# ------------------------------------------------------------
# 新增：直接测试 convert_code_format 函数
# ------------------------------------------------------------


def test_convert_code_format_replacements():
    """Validate convert_code_format correctly transforms code fences."""

    original_text = """Here is code:\n```code:python\nprint('hello')\n```\nAnd mixed fence ```< should be fixed."""

    expected_text = """Here is code:\n```python\nprint('hello')\n```\nAnd mixed fence ``` should be fixed."""

    transformed = core_agent_module.convert_code_format(original_text)

    assert transformed == expected_text, "convert_code_format did not perform expected replacements"
