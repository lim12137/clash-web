from typing import Dict, Any, Optional, List
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError

from .client import get_db_session, as_dict, filter_property
from .db_models import McpRecord


def create_mcp_record(mcp_data: Dict[str, Any], tenant_id: str, user_id: str) -> bool:
    """
    Create a new MCP record
    
    :param mcp_data: Dictionary containing MCP information
    :param tenant_id: Tenant ID
    :param user_id: User ID
    :return: Created MCP record
    """
    with get_db_session() as session:
        try:
            # Add default values
            mcp_data.update({
                "tenant_id": tenant_id,
                "user_id": user_id,
                "created_by": user_id,
                "updated_by": user_id,
                "delete_flag": "N"
            })
            
            new_mcp = McpRecord(**filter_property(mcp_data, McpRecord))
            session.add(new_mcp)
            session.flush()
            
            return True
        except SQLAlchemyError:
            session.rollback()
    return False

def delete_mcp_record_by_name_and_url(mcp_name: str, mcp_server: str, tenant_id: str, user_id: str) -> bool:
    """
    Delete a MCP record by name and URL
    
    :param mcp_name: MCP name
    :param mcp_server: MCP server URL
    :param tenant_id: Tenant ID
    :param user_id: User ID
    :return: True if successful, False otherwise
    """
    with get_db_session() as session:
        try:
            session.query(McpRecord).filter(
                McpRecord.mcp_name == mcp_name,
                McpRecord.mcp_server == mcp_server,
                McpRecord.tenant_id == tenant_id,
                McpRecord.delete_flag != 'Y'
            ).update({"delete_flag": "Y", "updated_by": user_id})
            session.commit()
            return True
        except SQLAlchemyError:
            session.rollback()
    return False

def get_mcp_records_by_tenant(tenant_id: str) -> List[Dict[str, Any]]:
    """
    Get all MCP records for a tenant
    
    :param tenant_id: Tenant ID
    :return: List of MCP records
    """
    with get_db_session() as session:
        mcp_records = session.query(McpRecord).filter(
            McpRecord.tenant_id == tenant_id,
            McpRecord.delete_flag != 'Y'
        ).all()
        
        return [as_dict(record) for record in mcp_records]

def check_mcp_name_exists(mcp_name: str) -> bool:
    """
    Check if MCP name already exists
    
    :param mcp_name: MCP name to check
    :return: True if name exists, False otherwise
    """
    with get_db_session() as session:
        query = session.query(McpRecord).filter(
            McpRecord.mcp_name == mcp_name,
            McpRecord.delete_flag != 'Y'
        )
        return query.first() is not None
