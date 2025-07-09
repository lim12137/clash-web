import unittest

import importlib

class TestConversationManagementAppAdd(unittest.TestCase):
    def test_add(self):
        module = importlib.import_module('backend.apps.test')
        self.assertEqual(module.add(1, 2), 3)
        self.assertEqual(module.add(-1, -2), -3)
        self.assertEqual(module.add(0, 0), 0)

if __name__ == '__main__':
    unittest.main() 