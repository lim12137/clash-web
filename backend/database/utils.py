import logging
from typing import Dict, Any, List, Tuple

def add_creation_timestamp(fields: List[str], placeholders: str) -> Tuple[List[str], str]:
    """
    Add creation timestamp fields to the field list and placeholder string
    
    Args:
        fields: List of fields
        placeholders: Placeholder string
        
    Returns:
        Tuple[List[str], str]: Field list and placeholder string with timestamp fields added
    """
    # Add timestamp fields to the field list
    fields_with_timestamp = fields.copy()
    fields_with_timestamp.extend(["create_time", "update_time"])

    # Add CURRENT_TIMESTAMP to placeholders
    placeholders_with_timestamp = placeholders + ", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP"

    return fields_with_timestamp, placeholders_with_timestamp


def add_update_timestamp(set_clause: List[str]) -> List[str]:
    """
    Add update timestamp to SET clause list
    
    Args:
        set_clause: SET clause list, e.g. ["field1 = %s", "field2 = %s"]
        
    Returns:
        List[str]: SET clause list with timestamp update added
    """
    # Add update timestamp to SET clause
    set_clause_with_timestamp = set_clause.copy()
    set_clause_with_timestamp.append("update_time = CURRENT_TIMESTAMP")

    return set_clause_with_timestamp
