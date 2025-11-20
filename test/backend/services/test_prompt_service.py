import json
import unittest
from unittest.mock import patch, MagicMock

# Mock boto3 and minio client before importing the module under test
import sys
boto3_mock = MagicMock()
sys.modules['boto3'] = boto3_mock

# Mock ElasticSearch before importing other modules
elasticsearch_mock = MagicMock()
sys.modules['elasticsearch'] = elasticsearch_mock

# Apply critical patches before importing any modules
# This prevents real AWS/MinIO/Elasticsearch calls during import
patch('botocore.client.BaseClient._make_api_call', return_value={}).start()

# Patch storage factory and MinIO config validation to avoid errors during initialization
# These patches must be started before any imports that use MinioClient
storage_client_mock = MagicMock()
minio_client_mock = MagicMock()
minio_client_mock._ensure_bucket_exists = MagicMock()
minio_client_mock.client = MagicMock()
patch('nexent.storage.storage_client_factory.create_storage_client_from_config', return_value=storage_client_mock).start()
patch('nexent.storage.minio_config.MinIOStorageConfig.validate', lambda self: None).start()
patch('backend.database.client.MinioClient', return_value=minio_client_mock).start()
patch('database.client.MinioClient', return_value=minio_client_mock).start()
patch('backend.database.client.minio_client', minio_client_mock).start()
patch('nexent.vector_database.elasticsearch_core.ElasticSearchCore', return_value=MagicMock()).start()
patch('nexent.vector_database.elasticsearch_core.Elasticsearch', return_value=MagicMock()).start()
patch('elasticsearch.Elasticsearch', return_value=MagicMock()).start()

from jinja2 import StrictUndefined

from backend.services.prompt_service import (
    call_llm_for_system_prompt,
    generate_and_save_system_prompt_impl,
    gen_system_prompt_streamable,
    generate_system_prompt,
    join_info_for_generate_system_prompt,
    _process_thinking_tokens
)


class TestPromptService(unittest.TestCase):

    def setUp(self):
        # Reset all mocks before each test
        minio_client_mock.reset_mock()
        self.test_model_id = 1

    @patch('backend.services.prompt_service.get_model_by_model_id')
    @patch('backend.services.prompt_service.OpenAIServerModel')
    @patch('backend.services.prompt_service.get_model_name_from_config')
    def test_call_llm_for_system_prompt(self, mock_get_model_name, mock_openai, mock_get_model_by_id):
        # Setup
        mock_model_config = {
            "base_url": "http://example.com",
            "api_key": "fake-key"
        }
        mock_get_model_by_id.return_value = mock_model_config
        mock_get_model_name.return_value = "gpt-4"

        mock_llm_instance = mock_openai.return_value

        # Mock the streaming response
        mock_chunk = MagicMock()
        mock_chunk.choices = [MagicMock()]
        mock_chunk.choices[0].delta.content = "Generated prompt"

        # Set up the client.chat.completions.create mock
        mock_llm_instance.client = MagicMock()
        mock_llm_instance.client.chat.completions.create.return_value = [
            mock_chunk]
        mock_llm_instance._prepare_completion_kwargs.return_value = {}

        # Execute
        result = call_llm_for_system_prompt(self.test_model_id, "user prompt", "system prompt")

        # Assert
        self.assertEqual(result, "Generated prompt")
        mock_get_model_by_id.assert_called_once_with(model_id=self.test_model_id, tenant_id=None)
        mock_openai.assert_called_once_with(
            model_id="gpt-4",
            api_base="http://example.com",
            api_key="fake-key",
            temperature=0.3,
            top_p=0.95
        )

    @patch('backend.services.prompt_service.generate_system_prompt')
    @patch('backend.services.prompt_service.query_tools_by_ids')
    @patch('backend.services.prompt_service.search_agent_info_by_agent_id')
    @patch('backend.services.prompt_service.update_agent')
    def test_generate_and_save_system_prompt_impl(self, mock_update_agent, mock_search_agent_info,
                                                  mock_query_tools, mock_generate_system_prompt):
        # Setup
        mock_tool1 = {"name": "tool1", "description": "Tool 1 desc",
                      "inputs": "input1", "output_type": "output1"}
        mock_tool2 = {"name": "tool2", "description": "Tool 2 desc",
                      "inputs": "input2", "output_type": "output2"}
        mock_query_tools.return_value = [mock_tool1, mock_tool2]

        mock_agent1 = {"name": "agent1", "description": "Agent 1 desc"}
        mock_agent2 = {"name": "agent2", "description": "Agent 2 desc"}
        mock_search_agent_info.side_effect = [mock_agent1, mock_agent2]

        # Mock the generator to return the expected data structure
        def mock_generator(*args, **kwargs):
            yield {"type": "duty", "content": "Generated duty prompt", "is_complete": False}
            yield {"type": "constraint", "content": "Generated constraint prompt", "is_complete": False}
            yield {"type": "few_shots", "content": "Generated few shots prompt", "is_complete": False}
            yield {"type": "agent_var_name", "content": "test_agent", "is_complete": True}
            yield {"type": "agent_display_name", "content": "Test Agent", "is_complete": True}
            yield {"type": "agent_description", "content": "Test agent description", "is_complete": True}
            yield {"type": "duty", "content": "Final duty prompt", "is_complete": True}
            yield {"type": "constraint", "content": "Final constraint prompt", "is_complete": True}
            yield {"type": "few_shots", "content": "Final few shots prompt", "is_complete": True}

        mock_generate_system_prompt.side_effect = mock_generator

        # Execute - test as a generator with frontend-provided IDs
        result_gen = generate_and_save_system_prompt_impl(
            agent_id=123,
            model_id=self.test_model_id,
            task_description="Test task",
            user_id="user123",
            tenant_id="tenant456",
            language="zh",
            tool_ids=[1, 2],
            sub_agent_ids=[10, 20]
        )
        result = list(result_gen)  # Convert generator to list for assertion

        # Assert
        self.assertGreater(len(result), 0)

        # Verify tools and agents were queried using frontend-provided IDs
        mock_query_tools.assert_called_once_with([1, 2])
        self.assertEqual(mock_search_agent_info.call_count, 2)
        mock_search_agent_info.assert_any_call(agent_id=10, tenant_id="tenant456")
        mock_search_agent_info.assert_any_call(agent_id=20, tenant_id="tenant456")

        # Verify generate_system_prompt was called with correct parameters
        mock_generate_system_prompt.assert_called_once()
        call_args = mock_generate_system_prompt.call_args
        self.assertEqual(call_args[0][0], [mock_agent1, mock_agent2])  # sub_agent_info_list
        self.assertEqual(call_args[0][1], "Test task")  # task_description
        self.assertEqual(call_args[0][2], [mock_tool1, mock_tool2])  # tool_info_list

        # Verify update_agent was called with the correct parameters
        mock_update_agent.assert_called_once()
        call_args = mock_update_agent.call_args
        self.assertEqual(call_args[1]['agent_id'], 123)
        self.assertEqual(call_args[1]['tenant_id'], "tenant456")
        self.assertEqual(call_args[1]['user_id'], "user123")

        # Verify the agent_info object has the correct structure
        agent_info = call_args[1]['agent_info']
        self.assertEqual(agent_info.agent_id, 123)
        self.assertEqual(agent_info.business_description, "Test task")

    @patch('backend.services.prompt_service.generate_system_prompt')
    @patch('backend.services.prompt_service.update_agent')
    def test_generate_and_save_system_prompt_impl_create_mode(self, mock_update_agent, mock_generate_system_prompt):
        """Test generate_and_save_system_prompt_impl in create mode (agent_id=0)"""
        # Setup - Mock the generator to return the expected data structure
        def mock_generator(*args, **kwargs):
            yield {"type": "duty", "content": "Generated duty prompt", "is_complete": False}
            yield {"type": "constraint", "content": "Generated constraint prompt", "is_complete": False}
            yield {"type": "few_shots", "content": "Generated few shots prompt", "is_complete": False}
            yield {"type": "agent_var_name", "content": "test_agent", "is_complete": True}
            yield {"type": "agent_display_name", "content": "Test Agent", "is_complete": True}
            yield {"type": "agent_description", "content": "Test agent description", "is_complete": True}
            yield {"type": "duty", "content": "Final duty prompt", "is_complete": True}
            yield {"type": "constraint", "content": "Final constraint prompt", "is_complete": True}
            yield {"type": "few_shots", "content": "Final few shots prompt", "is_complete": True}

        mock_generate_system_prompt.side_effect = mock_generator

        # Execute - test as a generator with agent_id=0 (create mode) and empty tool/sub-agent IDs
        result_gen = generate_and_save_system_prompt_impl(
            agent_id=0,
            model_id=self.test_model_id,
            task_description="Test task",
            user_id="user123",
            tenant_id="tenant456",
            language="zh",
            tool_ids=[],
            sub_agent_ids=[]
        )
        result = list(result_gen)  # Convert generator to list for assertion

        # Assert
        self.assertGreater(len(result), 0)

        # Should call generate_system_prompt with empty lists for tools and sub-agents
        mock_generate_system_prompt.assert_called_once_with(
            [],  # Empty sub_agent_info_list
            "Test task",
            [],  # Empty tool_info_list
            "tenant456",
            self.test_model_id,
            "zh"
        )

        # In create mode, should NOT call update_agent
        mock_update_agent.assert_not_called()

    @patch('backend.services.prompt_service.generate_and_save_system_prompt_impl')
    def test_gen_system_prompt_streamable(self, mock_generate_impl):
        """Test gen_system_prompt_streamable function"""
        # Setup mock data
        test_data = [
            {"type": "duty", "content": "Test duty prompt", "is_complete": False},
            {"type": "constraint", "content": "Test constraint prompt",
                "is_complete": False},
            {"type": "few_shots", "content": "Test few shots prompt", "is_complete": True},
        ]
        mock_generate_impl.return_value = iter(test_data)

        # Execute - collect results from the generator
        result_list = []
        for result in gen_system_prompt_streamable(
            agent_id=123,
            model_id=self.test_model_id,
            task_description="Test task",
            user_id="user123",
            tenant_id="tenant456",
            language="zh"
        ):
            result_list.append(result)

        # Assert
        # Verify generate_and_save_system_prompt_impl was called with correct parameters
        mock_generate_impl.assert_called_once_with(
            agent_id=123,
            model_id=self.test_model_id,
            task_description="Test task",
            user_id="user123",
            tenant_id="tenant456",
            language="zh",
            tool_ids=None,
            sub_agent_ids=None,
        )

        # Verify output format - should be SSE format
        self.assertEqual(len(result_list), 3)
        for i, result in enumerate(result_list):
            expected_data = f"data: {json.dumps({'success': True, 'data': test_data[i]}, ensure_ascii=False)}\n\n"
            self.assertEqual(result, expected_data)

    @patch('backend.services.prompt_service.call_llm_for_system_prompt')
    @patch('backend.services.prompt_service.join_info_for_generate_system_prompt')
    @patch('backend.services.prompt_service.get_prompt_generate_prompt_template')
    def test_generate_system_prompt(self, mock_get_prompt_template, mock_join_info, mock_call_llm):
        # Setup
        mock_prompt_config = {
            "USER_PROMPT": "Test user prompt template",
            "DUTY_SYSTEM_PROMPT": "Generate duty prompt",
            "CONSTRAINT_SYSTEM_PROMPT": "Generate constraint prompt",
            "FEW_SHOTS_SYSTEM_PROMPT": "Generate few shots prompt",
            "AGENT_VARIABLE_NAME_SYSTEM_PROMPT": "Generate agent var name",
            "AGENT_DISPLAY_NAME_SYSTEM_PROMPT": "Generate agent display name",
            "AGENT_DESCRIPTION_SYSTEM_PROMPT": "Generate agent description"
        }
        mock_get_prompt_template.return_value = mock_prompt_config

        mock_join_info.return_value = "Joined template content"

        # Mock call_llm_for_system_prompt to simulate streaming responses
        def mock_llm_call(model_id, content, sys_prompt, callback, tenant_id):
            # Simulate different responses based on system prompt
            if "duty" in sys_prompt.lower():
                if callback:
                    callback("Duty prompt part 1")
                    callback("Duty prompt part 1 part 2")
                return "Duty prompt part 1 part 2"
            elif "constraint" in sys_prompt.lower():
                if callback:
                    callback("Constraint prompt part 1")
                    callback("Constraint prompt part 1 part 2")
                return "Constraint prompt part 1 part 2"
            elif "few_shots" in sys_prompt.lower():
                if callback:
                    callback("Few shots prompt part 1")
                    callback("Few shots prompt part 1 part 2")
                return "Few shots prompt part 1 part 2"
            elif "variable_name" in sys_prompt.lower():
                if callback:
                    callback("test_agent")
                return "test_agent"
            elif "display_name" in sys_prompt.lower():
                if callback:
                    callback("Test Agent")
                return "Test Agent"
            elif "description" in sys_prompt.lower():
                if callback:
                    callback("Test agent description")
                return "Test agent description"
            return "Default response"

        mock_call_llm.side_effect = mock_llm_call

        # Test data
        mock_sub_agents = [{"name": "agent1", "description": "Agent 1"}]
        mock_task_description = "Test task"
        mock_tools = [{"name": "tool1", "description": "Tool 1"}]
        mock_tenant_id = "test_tenant"
        mock_language = "zh"

        # Execute - collect all results from the generator
        result_list = []
        for result in generate_system_prompt(
            mock_sub_agents,
            mock_task_description,
            mock_tools,
            mock_tenant_id,
            self.test_model_id,
            mock_language
        ):
            result_list.append(result)

        # Assert
        # Verify template loading
        mock_get_prompt_template.assert_called_once_with(mock_language)

        # Verify template joining
        mock_join_info.assert_called_once_with(
            prompt_for_generate=mock_prompt_config,
            sub_agent_info_list=mock_sub_agents,
            task_description=mock_task_description,
            tool_info_list=mock_tools,
            language=mock_language
        )

        # Verify LLM calls - should be called 6 times for each prompt type
        self.assertEqual(mock_call_llm.call_count, 6)

        # Verify that results contain the expected structure
        # Should have streaming results and final results
        self.assertGreater(len(result_list), 0)

        # Check that we get results for all expected types
        result_types = [r["type"] for r in result_list]
        expected_types = ["duty", "constraint", "few_shots",
                          "agent_var_name", "agent_display_name", "agent_description"]

        for expected_type in expected_types:
            self.assertIn(expected_type, result_types,
                          f"Missing result type: {expected_type}")

        # Check that all final results are marked as complete
        final_results = [r for r in result_list if r.get("is_complete", False)]
        final_types = [r["type"] for r in final_results]

        for expected_type in expected_types:
            self.assertIn(expected_type, final_types,
                          f"Missing final result for type: {expected_type}")

        # Verify content structure
        for result in result_list:
            self.assertIn("type", result)
            self.assertIn("content", result)
            self.assertIn("is_complete", result)
            self.assertIsInstance(result["is_complete"], bool)
            self.assertIsInstance(result["content"], str)

    @patch('backend.services.prompt_service.call_llm_for_system_prompt')
    @patch('backend.services.prompt_service.join_info_for_generate_system_prompt')
    @patch('backend.services.prompt_service.get_prompt_generate_prompt_template')
    def test_generate_system_prompt_with_exception(self, mock_get_prompt_template, mock_join_info, mock_call_llm):
        # Setup
        mock_prompt_config = {
            "USER_PROMPT": "Test user prompt template",
            "DUTY_SYSTEM_PROMPT": "Generate duty prompt",
            "CONSTRAINT_SYSTEM_PROMPT": "Generate constraint prompt",
            "FEW_SHOTS_SYSTEM_PROMPT": "Generate few shots prompt",
            "AGENT_VARIABLE_NAME_SYSTEM_PROMPT": "Generate agent var name",
            "AGENT_DISPLAY_NAME_SYSTEM_PROMPT": "Generate agent display name",
            "AGENT_DESCRIPTION_SYSTEM_PROMPT": "Generate agent description"
        }
        mock_get_prompt_template.return_value = mock_prompt_config
        mock_join_info.return_value = "Joined template content"

        # Mock call_llm_for_system_prompt to raise exception for one prompt type
        def mock_llm_call_with_exception(model_id, content, sys_prompt, callback, tenant_id):
            if "duty" in sys_prompt.lower():
                raise Exception("LLM error for duty prompt")
            elif "constraint" in sys_prompt.lower():
                if callback:
                    callback("Constraint prompt")
                return "Constraint prompt"
            else:
                if callback:
                    callback("Other prompt")
                return "Other prompt"

        mock_call_llm.side_effect = mock_llm_call_with_exception

        # Test data
        mock_sub_agents = [{"name": "agent1", "description": "Agent 1"}]
        mock_task_description = "Test task"
        mock_tools = [{"name": "tool1", "description": "Tool 1"}]
        mock_tenant_id = "test_tenant"
        mock_language = "en"

        # Execute - should handle exceptions gracefully
        result_list = []
        for result in generate_system_prompt(
            mock_sub_agents,
            mock_task_description,
            mock_tools,
            mock_tenant_id,
            self.test_model_id,
            mock_language
        ):
            result_list.append(result)

        # Assert - should still return results for other prompt types
        self.assertGreater(len(result_list), 0)

        # Constraint should work fine
        constraint_results = [
            r for r in result_list if r["type"] == "constraint"]
        self.assertGreater(len(constraint_results), 0)

        # Verify that duty result exists but might be empty due to exception handling
        duty_results = [r for r in result_list if r["type"] == "duty"]

        # Should still have duty result entry with empty content
        self.assertGreater(len(duty_results), 0)

    @patch('backend.services.prompt_service.Template')
    def test_join_info_for_generate_system_prompt(self, mock_template):
        # Setup
        mock_prompt_for_generate = {"USER_PROMPT": "Test User Prompt"}
        mock_sub_agents = [
            {"name": "agent1", "description": "Agent 1 desc"},
            {"name": "agent2", "description": "Agent 2 desc"}
        ]
        mock_task_description = "Test task"
        mock_tools = [
            {"name": "tool1", "description": "Tool 1 desc",
                "inputs": "input1", "output_type": "output1"},
            {"name": "tool2", "description": "Tool 2 desc",
                "inputs": "input2", "output_type": "output2"}
        ]

        mock_template_instance = MagicMock()
        mock_template.return_value = mock_template_instance
        mock_template_instance.render.return_value = "Rendered content"

        # Execute
        result = join_info_for_generate_system_prompt(
            mock_prompt_for_generate, mock_sub_agents, mock_task_description, mock_tools
        )

        # Assert
        self.assertEqual(result, "Rendered content")
        mock_template.assert_called_once_with(
            mock_prompt_for_generate["USER_PROMPT"], undefined=StrictUndefined)
        mock_template_instance.render.assert_called_once()
        # Check template variables
        template_vars = mock_template_instance.render.call_args[0][0]
        self.assertIn("tool_description", template_vars)
        self.assertIn("assistant_description", template_vars)
        self.assertEqual(
            template_vars["task_description"], mock_task_description)


    @patch('backend.services.prompt_service.get_model_by_model_id')
    @patch('backend.services.prompt_service.OpenAIServerModel')
    @patch('backend.services.prompt_service.get_model_name_from_config')
    def test_call_llm_for_system_prompt_exception(self, mock_get_model_name, mock_openai, mock_get_model_by_id):
        # Setup
        mock_model_config = {
            "base_url": "http://example.com",
            "api_key": "fake-key"
        }
        mock_get_model_by_id.return_value = mock_model_config
        mock_get_model_name.return_value = "gpt-4"

        mock_llm_instance = mock_openai.return_value
        mock_llm_instance.client = MagicMock()
        mock_llm_instance.client.chat.completions.create.side_effect = Exception(
            "LLM error")
        mock_llm_instance._prepare_completion_kwargs.return_value = {}

        # Execute and Assert
        with self.assertRaises(Exception) as context:
            call_llm_for_system_prompt(self.test_model_id, "user prompt", "system prompt")

        self.assertIn("LLM error", str(context.exception))

    def test_process_thinking_tokens_normal_token(self):
        """Test process_thinking_tokens with normal token when not thinking"""
        token_join = []
        callback_calls = []

        def mock_callback(text):
            callback_calls.append(text)

        is_thinking = _process_thinking_tokens(
            "Hello", False, token_join, mock_callback)

        self.assertFalse(is_thinking)
        self.assertEqual(token_join, ["Hello"])
        self.assertEqual(callback_calls, ["Hello"])

    def test_process_thinking_tokens_start_thinking(self):
        """Test process_thinking_tokens when encountering <think> tag"""
        token_join = []
        callback_calls = []

        def mock_callback(text):
            callback_calls.append(text)

        is_thinking = _process_thinking_tokens(
            "<think>", False, token_join, mock_callback)

        self.assertTrue(is_thinking)
        self.assertEqual(token_join, [])
        self.assertEqual(callback_calls, [])

    def test_process_thinking_tokens_content_while_thinking(self):
        """Test process_thinking_tokens with content while in thinking mode"""
        token_join = ["Hello"]
        callback_calls = []

        def mock_callback(text):
            callback_calls.append(text)

        is_thinking = _process_thinking_tokens(
            "thinking content", True, token_join, mock_callback)

        self.assertTrue(is_thinking)
        self.assertEqual(token_join, ["Hello"])  # Should not change
        self.assertEqual(callback_calls, [])

    def test_process_thinking_tokens_end_thinking(self):
        """Test process_thinking_tokens when encountering </think> tag"""
        token_join = ["Hello"]
        callback_calls = []

        def mock_callback(text):
            callback_calls.append(text)

        is_thinking = _process_thinking_tokens(
            "</think>", True, token_join, mock_callback)

        self.assertFalse(is_thinking)
        self.assertEqual(token_join, ["Hello"])  # Should not change
        self.assertEqual(callback_calls, [])

    def test_process_thinking_tokens_content_after_thinking(self):
        """Test process_thinking_tokens with content after thinking ends"""
        token_join = ["Hello"]
        callback_calls = []

        def mock_callback(text):
            callback_calls.append(text)

        is_thinking = _process_thinking_tokens(
            "World", False, token_join, mock_callback)

        self.assertFalse(is_thinking)
        self.assertEqual(token_join, ["Hello", "World"])
        self.assertEqual(callback_calls, ["HelloWorld"])

    def test_process_thinking_tokens_complete_flow(self):
        """Test process_thinking_tokens with complete thinking flow"""
        token_join = []
        callback_calls = []

        def mock_callback(text):
            callback_calls.append(text)

        # Start with normal content
        is_thinking = _process_thinking_tokens(
            "Start ", False, token_join, mock_callback)
        self.assertFalse(is_thinking)

        # Enter thinking mode
        is_thinking = _process_thinking_tokens(
            "<think>", False, token_join, mock_callback)
        self.assertTrue(is_thinking)

        # Thinking content (ignored)
        is_thinking = _process_thinking_tokens(
            "thinking", True, token_join, mock_callback)
        self.assertTrue(is_thinking)

        # More thinking content (ignored)
        is_thinking = _process_thinking_tokens(
            " more", True, token_join, mock_callback)
        self.assertTrue(is_thinking)

        # End thinking
        is_thinking = _process_thinking_tokens(
            "</think>", True, token_join, mock_callback)
        self.assertFalse(is_thinking)

        # Continue with normal content
        is_thinking = _process_thinking_tokens(
            " End", False, token_join, mock_callback)
        self.assertFalse(is_thinking)

        # Verify final state
        self.assertEqual(token_join, ["Start ", " End"])
        self.assertEqual(callback_calls, ["Start ", "Start  End"])

    def test_process_thinking_tokens_no_callback(self):
        """Test process_thinking_tokens without callback function"""
        token_join = []

        is_thinking = _process_thinking_tokens("Hello", False, token_join, None)

        self.assertFalse(is_thinking)
        self.assertEqual(token_join, ["Hello"])

    def test_process_thinking_tokens_empty_token(self):
        """Test process_thinking_tokens with empty token"""
        token_join = []
        callback_calls = []

        def mock_callback(text):
            callback_calls.append(text)

        is_thinking = _process_thinking_tokens(
            "", False, token_join, mock_callback)

        self.assertFalse(is_thinking)
        self.assertEqual(token_join, [""])
        self.assertEqual(callback_calls, [""])


if __name__ == '__main__':
    unittest.main()
