import unittest
from unittest.mock import patch, MagicMock
from services.tool_configuration_service import get_tool_detail_information
from consts.model import ToolDetailInformation
from nexent.core.tools.exa_search_tool import EXASearchTool


class TestToolConfigurationService(unittest.TestCase):
    def test_get_tool_detail_information_local_tool_exa_search(self):
        test_tool_name = "exa_web_search"
        
        # call the function
        result = get_tool_detail_information(test_tool_name)
        
        # verify the result
        self.assertIsNotNone(result)
        self.assertIsInstance(result, ToolDetailInformation)
        self.assertEqual(result.name, test_tool_name)
        self.assertEqual(result.description, EXASearchTool.description)
        self.assertEqual(result.inputs, str(EXASearchTool.inputs))
        self.assertEqual(result.output_type, EXASearchTool.output_type)

    def test_get_tool_detail_information_none_tool(self):
        test_tool_name = "un_exist_tools"

        # call the function
        result = get_tool_detail_information(test_tool_name)

        # verify the result
        self.assertIsNone(result)

if __name__ == '__main__':
    unittest.main()
