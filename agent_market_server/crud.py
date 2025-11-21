"""
CRUD operations for Agent Market Server
"""
import logging
from typing import List, Dict, Any, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from database import get_db_session, as_dict
from models import MarketAgent, MarketTool, MarketMcpServer, MarketAgentToolRel, MarketAgentMcpRel

logger = logging.getLogger("crud")


def get_agent_list(
    page: int = 1,
    page_size: int = 20,
    enabled_only: bool = True
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Get paginated list of agents
    
    Args:
        page: Page number (starts from 1)
        page_size: Number of items per page
        enabled_only: If True, only return enabled agents
        
    Returns:
        Tuple of (agent_list, total_count)
    """
    with get_db_session() as session:
        query = session.query(MarketAgent).filter(MarketAgent.delete_flag != 'Y')
        
        if enabled_only:
            query = query.filter(MarketAgent.enabled == True)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * page_size
        agents = query.order_by(MarketAgent.create_time.desc()).offset(offset).limit(page_size).all()
        
        # Convert to list format with basic info
        agent_list = []
        for agent in agents:
            agent_list.append({
                "agent_id": agent.agent_id,
                "name": agent.name,
                "display_name": agent.display_name,
                "description": agent.description,
                "logo_url": agent.logo_url,
                "enabled": agent.enabled,
                "create_time": agent.create_time.isoformat() if agent.create_time else None
            })
        
        return agent_list, total


def get_agent_detail(agent_id: int) -> Optional[Dict[str, Any]]:
    """
    Get detailed information for a specific agent
    
    Args:
        agent_id: Agent ID
        
    Returns:
        Dictionary with agent details including tools and MCP servers
    """
    with get_db_session() as session:
        agent = session.query(MarketAgent).options(
            joinedload(MarketAgent.tools).joinedload(MarketAgentToolRel.tool),
            joinedload(MarketAgent.mcps).joinedload(MarketAgentMcpRel.mcp)
        ).filter(
            MarketAgent.agent_id == agent_id,
            MarketAgent.delete_flag != 'Y'
        ).first()
        
        if not agent:
            return None
        
        # Build agent info dict
        agent_info = as_dict(agent)
        
        # Add tools information
        tools = []
        for rel in agent.tools:
            if rel.delete_flag != 'Y' and rel.tool.delete_flag != 'Y':
                tool_dict = as_dict(rel.tool)
                # Map tool_metadata back to metadata for API compatibility
                if 'tool_metadata' in tool_dict:
                    tool_dict['metadata'] = tool_dict.pop('tool_metadata')
                tools.append(tool_dict)
        
        agent_info['tools'] = tools
        
        # Add MCP servers information
        mcp_info = []
        for rel in agent.mcps:
            if rel.delete_flag != 'Y' and rel.mcp.delete_flag != 'Y':
                mcp_dict = {
                    "mcp_server_name": rel.mcp.mcp_server_name,
                    "mcp_url": rel.mcp.mcp_url
                }
                mcp_info.append(mcp_dict)
        
        agent_info['mcp_info'] = mcp_info
        
        # Add managed_agents (empty list for compatibility)
        agent_info['managed_agents'] = []
        
        return agent_info


def create_agent_with_relations(agent_data: Dict[str, Any]) -> int:
    """
    Create a new agent with tools and MCP server relationships
    
    Args:
        agent_data: Dictionary containing agent information, tools, and mcp_info
        
    Returns:
        Created agent ID
    """
    with get_db_session() as session:
        # Extract tools and mcp_info
        tools_data = agent_data.pop('tools', [])
        mcp_info_data = agent_data.pop('mcp_info', [])
        agent_data.pop('managed_agents', None)  # Remove if exists
        
        # Create agent
        agent = MarketAgent(**agent_data)
        agent.delete_flag = 'N'
        session.add(agent)
        session.flush()
        
        agent_id = agent.agent_id
        
        # Create tools and relationships
        for tool_data in tools_data:
            # Check if tool already exists by name and class_name
            existing_tool = session.query(MarketTool).filter(
                MarketTool.name == tool_data['name'],
                MarketTool.class_name == tool_data['class_name'],
                MarketTool.delete_flag != 'Y'
            ).first()
            
            if existing_tool:
                tool_id = existing_tool.tool_id
            else:
                # Create new tool
                tool = MarketTool(
                    name=tool_data['name'],
                    class_name=tool_data['class_name'],
                    description=tool_data.get('description'),
                    inputs=tool_data.get('inputs'),
                    output_type=tool_data.get('output_type'),
                    source=tool_data.get('source'),
                    usage=tool_data.get('usage'),
                    params=tool_data.get('params'),
                    tool_metadata=tool_data.get('metadata'),
                    delete_flag='N'
                )
                session.add(tool)
                session.flush()
                tool_id = tool.tool_id
            
            # Create relationship
            rel = MarketAgentToolRel(
                agent_id=agent_id,
                tool_id=tool_id,
                delete_flag='N'
            )
            session.add(rel)
        
        # Create MCP servers and relationships
        for mcp_data in mcp_info_data:
            # Check if MCP server already exists by name and URL
            existing_mcp = session.query(MarketMcpServer).filter(
                MarketMcpServer.mcp_server_name == mcp_data['mcp_server_name'],
                MarketMcpServer.mcp_url == mcp_data['mcp_url'],
                MarketMcpServer.delete_flag != 'Y'
            ).first()
            
            if existing_mcp:
                mcp_id = existing_mcp.mcp_id
            else:
                # Create new MCP server
                mcp = MarketMcpServer(
                    mcp_server_name=mcp_data['mcp_server_name'],
                    mcp_url=mcp_data['mcp_url'],
                    delete_flag='N'
                )
                session.add(mcp)
                session.flush()
                mcp_id = mcp.mcp_id
            
            # Create relationship
            rel = MarketAgentMcpRel(
                agent_id=agent_id,
                mcp_id=mcp_id,
                delete_flag='N'
            )
            session.add(rel)
        
        session.commit()
        return agent_id


def delete_agent(agent_id: int) -> bool:
    """
    Soft delete an agent
    
    Args:
        agent_id: Agent ID to delete
        
    Returns:
        True if successful, False otherwise
    """
    with get_db_session() as session:
        agent = session.query(MarketAgent).filter(
            MarketAgent.agent_id == agent_id
        ).first()
        
        if not agent:
            return False
        
        agent.delete_flag = 'Y'
        session.commit()
        return True

