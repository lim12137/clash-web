import unittest
import os
import sys



# Add the project root to the Python path to ensure correct module imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from nexent.data_process.core import DataProcessCore


class TestDataProcessCore(unittest.TestCase):
    """
    Test suite for the refactored DataProcessCore.
    """

    def setUp(self):
        """
        Set up the test environment.
        """
        self.core = DataProcessCore()
        self.test_dir = 'test/sdk'
        self.txt_file_path = os.path.join(self.test_dir, 'test_data_process_doc.txt')
        self.excel_file_path = os.path.join(self.test_dir, 'test_data_process_sheet.xlsx')

    def test_process_local_txt_file(self):
        """
        Test processing a generic text file from a local path.
        """
        print("\n--- Testing local TXT file processing ---")
        self.assertTrue(os.path.exists(self.txt_file_path), f"Test file not found: {self.txt_file_path}")
        
        result = self.core.file_process(file_path_or_url=self.txt_file_path, destination='local')
        
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        self.assertIn('content', result[0])
        print(f"Successfully processed local TXT file. Chunks found: {len(result)}")
        print(f"First chunk content snippet: '{result[0]['content'][:100]}...'")

    def test_process_local_excel_file(self):
        """
        Test processing an Excel file from a local path.
        NOTE: Requires 'test/test_sheet.xlsx' to exist.
        """
        print("\n--- Testing local Excel file processing ---")
        if not os.path.exists(self.excel_file_path):
            print(f"SKIPPING: Test file not found: {self.excel_file_path}")
            self.skipTest(f"Test file not found: {self.excel_file_path}")
            return

        result = self.core.file_process(file_path_or_url=self.excel_file_path, destination='local')
        
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        self.assertIn('content', result[0])
        self.assertIn('metadata', result[0])
        self.assertEqual(result[0]['metadata']['file_type'], 'xlsx')
        print(f"Successfully processed local Excel file. Chunks found: {len(result)}")

    def test_process_memory_txt_file(self):
        """
        Test processing a generic text file from in-memory bytes.
        """
        print("\n--- Testing in-memory TXT file processing ---")
        self.assertTrue(os.path.exists(self.txt_file_path), f"Test file not found: {self.txt_file_path}")

        with open(self.txt_file_path, 'rb') as f:
            file_bytes = f.read()

        result = self.core.file_process(file_data=file_bytes, filename='test_data_process_doc.txt')

        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        self.assertIn('content', result[0])
        self.assertEqual(result[0]['filename'], 'test_data_process_doc.txt')
        print(f"Successfully processed in-memory TXT file. Chunks found: {len(result)}")

    def test_process_memory_excel_file(self):
        """
        Test processing an Excel file from in-memory bytes.
        NOTE: Requires 'test/test_sheet.xlsx' to exist.
        """
        print("\n--- Testing in-memory Excel file processing ---")
        if not os.path.exists(self.excel_file_path):
            print(f"SKIPPING: Test file not found: {self.excel_file_path}")
            self.skipTest(f"Test file not found: {self.excel_file_path}")
            return

        with open(self.excel_file_path, 'rb') as f:
            file_bytes = f.read()

        result = self.core.file_process(file_data=file_bytes, filename='test_data_process_sheet.xlsx')

        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)
        self.assertIn('content', result[0])
        self.assertIn('metadata', result[0])
        self.assertEqual(result[0]['metadata']['file_type'], 'xlsx')
        print(f"Successfully processed in-memory Excel file. Chunks found: {len(result)}")

if __name__ == '__main__':
    unittest.main() 