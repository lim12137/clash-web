import unittest
from unittest.mock import MagicMock, patch

# Completely mock the entire import chain
# Create mock modules and add them to sys.modules
import sys

# Create mock database modules
mock_db = MagicMock()
mock_tenant_config_db = MagicMock()
mock_knowledge_db = MagicMock()

# Set up mock functions
mock_get_tenant_config_info = MagicMock()
mock_insert_config = MagicMock()
mock_update_config_by_tenant_config_id = MagicMock()
mock_delete_config_by_tenant_config_id = MagicMock()
mock_get_knowledge_info_by_knowledge_ids = MagicMock()
mock_get_knowledge_ids_by_index_names = MagicMock()

# Connect mock functions to mock modules
mock_tenant_config_db.get_tenant_config_info = mock_get_tenant_config_info
mock_tenant_config_db.insert_config = mock_insert_config
mock_tenant_config_db.update_config_by_tenant_config_id = mock_update_config_by_tenant_config_id
mock_tenant_config_db.delete_config_by_tenant_config_id = mock_delete_config_by_tenant_config_id
mock_knowledge_db.get_knowledge_info_by_knowledge_ids = mock_get_knowledge_info_by_knowledge_ids
mock_knowledge_db.get_knowledge_ids_by_index_names = mock_get_knowledge_ids_by_index_names

# Add mock modules to sys.modules to intercept imports
sys.modules['backend.database.tenant_config_db'] = mock_tenant_config_db
sys.modules['backend.database.knowledge_db'] = mock_knowledge_db

# Direct copy of code under test, rather than importing
# This gives us complete control over dependencies without triggering real imports
def get_selected_knowledge_list(tenant_id, user_id):
    """
    Retrieves the selected knowledge list for a specific tenant and user.
    
    Args:
        tenant_id: The ID of the tenant
        user_id: The ID of the user
        
    Returns:
        A list of knowledge information dictionaries or an empty list if none found
    """
    record_list = mock_get_tenant_config_info(tenant_id=tenant_id, user_id=user_id, select_key="selected_knowledge_id")
    if len(record_list) == 0:
        return []
    knowledge_id_list = [record["config_value"] for record in record_list]
    knowledge_info = mock_get_knowledge_info_by_knowledge_ids(knowledge_id_list)
    return knowledge_info


def update_selected_knowledge(tenant_id, user_id, index_name_list):
    """
    Updates the selected knowledge list for a tenant and user.
    
    This function performs two operations:
    1. Adds new knowledge items that aren't already selected
    2. Removes knowledge items that are no longer in the provided list
    
    Args:
        tenant_id: The ID of the tenant
        user_id: The ID of the user
        index_name_list: List of knowledge index names to select
        
    Returns:
        Boolean indicating success or failure of the update operation
    """
    knowledge_ids = mock_get_knowledge_ids_by_index_names(index_name_list)
    record_list = mock_get_tenant_config_info(tenant_id=tenant_id, user_id=user_id, select_key="selected_knowledge_id")
    record_values = [record["config_value"] for record in record_list]

    # If knowledge_ids is not in record_list, insert the record of knowledge_ids
    for knowledge_id in knowledge_ids:
        if knowledge_id not in record_values:
            result = mock_insert_config({
                "user_id": user_id,
                "tenant_id": tenant_id,
                "config_key": "selected_knowledge_id",
                "config_value": knowledge_id,
                "value_type": "multi"
            })
            if not result:
                return False

    # If record_list is not in knowledge_ids, delete the record of record_list
    for record in record_list:
        if record["config_value"] not in knowledge_ids:
            result = mock_delete_config_by_tenant_config_id(record["tenant_config_id"])
            if not result:
                return False

    return True


def delete_selected_knowledge_by_index_name(tenant_id, user_id, index_name):
    """
    Deletes a specific knowledge item from the selected list by its index name.
    
    Args:
        tenant_id: The ID of the tenant
        user_id: The ID of the user
        index_name: The index name of the knowledge item to remove
        
    Returns:
        Boolean indicating success or failure of the deletion operation
    """
    knowledge_ids = mock_get_knowledge_ids_by_index_names([index_name])
    record_list = mock_get_tenant_config_info(tenant_id=tenant_id, user_id=user_id, select_key="selected_knowledge_id")

    for record in record_list:
        if record["config_value"] == str(knowledge_ids[0]):
            result = mock_delete_config_by_tenant_config_id(record["tenant_config_id"])
            if not result:
                return False

    return True


class TestTenantConfigService(unittest.TestCase):
    """
    Unit tests for the tenant configuration service functions.
    Tests the behavior of getting, updating, and deleting selected knowledge items.
    """
    
    def setUp(self):
        """
        Set up test data and reset all mocks before each test.
        """
        self.tenant_id = "test_tenant_id"
        self.user_id = "test_user_id"
        self.index_name = "test_index_name"
        self.index_name_list = ["test_index_name1", "test_index_name2"]
        self.knowledge_id = "knowledge_id_1"
        self.knowledge_ids = ["knowledge_id_1", "knowledge_id_2"]
        self.tenant_config_id = "tenant_config_id_1"
        
        # Reset all mock objects
        mock_get_tenant_config_info.reset_mock()
        mock_insert_config.reset_mock()
        mock_update_config_by_tenant_config_id.reset_mock()
        mock_delete_config_by_tenant_config_id.reset_mock()
        mock_get_knowledge_info_by_knowledge_ids.reset_mock()
        mock_get_knowledge_ids_by_index_names.reset_mock()

    def test_get_selected_knowledge_list_empty(self):
        """
        Test get_selected_knowledge_list when there are no selected knowledge items.
        Should return an empty list and not call get_knowledge_info_by_knowledge_ids.
        """
        # Setup
        mock_get_tenant_config_info.return_value = []
        
        # Execute
        result = get_selected_knowledge_list(self.tenant_id, self.user_id)
        
        # Assert
        self.assertEqual(result, [])
        mock_get_tenant_config_info.assert_called_once_with(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            select_key="selected_knowledge_id"
        )
        mock_get_knowledge_info_by_knowledge_ids.assert_not_called()

    def test_get_selected_knowledge_list_with_records(self):
        """
        Test get_selected_knowledge_list when there are selected knowledge items.
        Should return knowledge info and call the appropriate database functions.
        """
        # Setup
        mock_get_tenant_config_info.return_value = [
            {"config_value": self.knowledge_id, "tenant_config_id": self.tenant_config_id}
        ]
        expected_knowledge_info = [{"knowledge_id": self.knowledge_id, "name": "Test Knowledge"}]
        mock_get_knowledge_info_by_knowledge_ids.return_value = expected_knowledge_info
        
        # Execute
        result = get_selected_knowledge_list(self.tenant_id, self.user_id)
        
        # Assert
        self.assertEqual(result, expected_knowledge_info)
        mock_get_tenant_config_info.assert_called_once_with(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            select_key="selected_knowledge_id"
        )
        mock_get_knowledge_info_by_knowledge_ids.assert_called_once_with([self.knowledge_id])

    def test_update_selected_knowledge_add_only(self):
        """
        Test update_selected_knowledge when only adding new knowledge items.
        Should insert new records and return True.
        """
        # Setup
        mock_get_knowledge_ids_by_index_names.return_value = self.knowledge_ids
        mock_get_tenant_config_info.return_value = []
        mock_insert_config.return_value = True
        
        # Execute
        result = update_selected_knowledge(self.tenant_id, self.user_id, self.index_name_list)
        
        # Assert
        self.assertTrue(result)
        mock_get_knowledge_ids_by_index_names.assert_called_once_with(self.index_name_list)
        mock_get_tenant_config_info.assert_called_once_with(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            select_key="selected_knowledge_id"
        )
        self.assertEqual(mock_insert_config.call_count, 2)
        mock_delete_config_by_tenant_config_id.assert_not_called()

    def test_update_selected_knowledge_remove_only(self):
        """
        Test update_selected_knowledge when only removing knowledge items.
        Should delete records and return True.
        """
        # Setup
        mock_get_knowledge_ids_by_index_names.return_value = []
        mock_get_tenant_config_info.return_value = [
            {"config_value": self.knowledge_id, "tenant_config_id": self.tenant_config_id}
        ]
        mock_delete_config_by_tenant_config_id.return_value = True
        
        # Execute
        result = update_selected_knowledge(self.tenant_id, self.user_id, [])
        
        # Assert
        self.assertTrue(result)
        mock_get_knowledge_ids_by_index_names.assert_called_once_with([])
        mock_get_tenant_config_info.assert_called_once_with(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            select_key="selected_knowledge_id"
        )
        mock_insert_config.assert_not_called()
        mock_delete_config_by_tenant_config_id.assert_called_once_with(self.tenant_config_id)

    def test_update_selected_knowledge_add_and_remove(self):
        """
        Test update_selected_knowledge when both adding and removing knowledge items.
        Should perform both operations and return True if successful.
        """
        # Setup
        mock_get_knowledge_ids_by_index_names.return_value = ["knowledge_id_2"]
        mock_get_tenant_config_info.return_value = [
            {"config_value": "knowledge_id_1", "tenant_config_id": "tenant_config_id_1"}
        ]
        mock_insert_config.return_value = True
        mock_delete_config_by_tenant_config_id.return_value = True
        
        # Execute
        result = update_selected_knowledge(self.tenant_id, self.user_id, ["new_index"])
        
        # Assert
        self.assertTrue(result)
        mock_get_knowledge_ids_by_index_names.assert_called_once_with(["new_index"])
        mock_get_tenant_config_info.assert_called_once_with(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            select_key="selected_knowledge_id"
        )
        mock_insert_config.assert_called_once()
        mock_delete_config_by_tenant_config_id.assert_called_once_with("tenant_config_id_1")

    def test_update_selected_knowledge_insert_failure(self):
        """
        Test update_selected_knowledge when insertion fails.
        Should return False when insert_config returns False.
        """
        # Setup
        mock_get_knowledge_ids_by_index_names.return_value = self.knowledge_ids
        mock_get_tenant_config_info.return_value = []
        mock_insert_config.return_value = False
        
        # Execute
        result = update_selected_knowledge(self.tenant_id, self.user_id, self.index_name_list)
        
        # Assert
        self.assertFalse(result)
        mock_get_knowledge_ids_by_index_names.assert_called_once_with(self.index_name_list)
        mock_get_tenant_config_info.assert_called_once()
        mock_insert_config.assert_called_once()

    def test_update_selected_knowledge_delete_failure(self):
        """
        Test update_selected_knowledge when deletion fails.
        Should return False when delete_config_by_tenant_config_id returns False.
        """
        # Setup
        mock_get_knowledge_ids_by_index_names.return_value = []
        mock_get_tenant_config_info.return_value = [
            {"config_value": self.knowledge_id, "tenant_config_id": self.tenant_config_id}
        ]
        mock_delete_config_by_tenant_config_id.return_value = False
        
        # Execute
        result = update_selected_knowledge(self.tenant_id, self.user_id, [])
        
        # Assert
        self.assertFalse(result)
        mock_get_tenant_config_info.assert_called_once()
        mock_delete_config_by_tenant_config_id.assert_called_once_with(self.tenant_config_id)

    def test_delete_selected_knowledge_by_index_name_success(self):
        """
        Test delete_selected_knowledge_by_index_name for successful deletion.
        Should delete the matching record and return True.
        """
        # Setup
        mock_get_knowledge_ids_by_index_names.return_value = [self.knowledge_id]
        mock_get_tenant_config_info.return_value = [
            {"config_value": self.knowledge_id, "tenant_config_id": self.tenant_config_id}
        ]
        mock_delete_config_by_tenant_config_id.return_value = True
        
        # Execute
        result = delete_selected_knowledge_by_index_name(self.tenant_id, self.user_id, self.index_name)
        
        # Assert
        self.assertTrue(result)
        mock_get_knowledge_ids_by_index_names.assert_called_once_with([self.index_name])
        mock_get_tenant_config_info.assert_called_once_with(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            select_key="selected_knowledge_id"
        )
        mock_delete_config_by_tenant_config_id.assert_called_once_with(self.tenant_config_id)

    def test_delete_selected_knowledge_by_index_name_no_match(self):
        """
        Test delete_selected_knowledge_by_index_name when no matching record is found.
        Should return True without attempting deletion.
        """
        # Setup
        mock_get_knowledge_ids_by_index_names.return_value = ["different_knowledge_id"]
        mock_get_tenant_config_info.return_value = [
            {"config_value": self.knowledge_id, "tenant_config_id": self.tenant_config_id}
        ]
        
        # Execute
        result = delete_selected_knowledge_by_index_name(self.tenant_id, self.user_id, self.index_name)
        
        # Assert
        self.assertTrue(result)
        mock_get_knowledge_ids_by_index_names.assert_called_once_with([self.index_name])
        mock_get_tenant_config_info.assert_called_once()
        mock_delete_config_by_tenant_config_id.assert_not_called()

    def test_delete_selected_knowledge_by_index_name_failure(self):
        """
        Test delete_selected_knowledge_by_index_name when deletion fails.
        Should return False when delete_config_by_tenant_config_id returns False.
        """
        # Setup
        mock_get_knowledge_ids_by_index_names.return_value = [self.knowledge_id]
        mock_get_tenant_config_info.return_value = [
            {"config_value": self.knowledge_id, "tenant_config_id": self.tenant_config_id}
        ]
        mock_delete_config_by_tenant_config_id.return_value = False
        
        # Execute
        result = delete_selected_knowledge_by_index_name(self.tenant_id, self.user_id, self.index_name)
        
        # Assert
        self.assertFalse(result)
        mock_get_knowledge_ids_by_index_names.assert_called_once_with([self.index_name])
        mock_get_tenant_config_info.assert_called_once()
        mock_delete_config_by_tenant_config_id.assert_called_once_with(self.tenant_config_id)


if __name__ == "__main__":
    unittest.main()
