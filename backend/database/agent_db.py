from fastapi import HTTPException

from services.tool_configuration_service import scan_tools
from utils.user_utils import get_user_info
from database.client import get_db_session, as_dict, filter_property
from database.db_models import ToolInfo, AgentInfo, UserAgent, ToolInstance


def update_tools(tools):
    """
    Update the ToolInfo table based on the provided list of tools.

    :param tools: List of dictionaries representing tools, each containing tool information
    :return: None
    """
    with get_db_session() as session:
        # Query all existing ToolInfo records from the database
        existing_tools = {tool.name: tool for tool in session.query(ToolInfo).filter(ToolInfo.delete_flag != 'Y').all()}

        tool_names_in_input = {tool['name'] for tool in tools}

        # Handle new or updated tools
        for tool in tools:
            tool_name = tool['name']
            if tool_name in existing_tools:
                # Check if the tool needs to be updated
                existing_tool = existing_tools[tool_name]
                for key, value in tool.items():
                    if hasattr(existing_tool, key) and getattr(existing_tool, key) != value:
                        setattr(existing_tool, key, value)
                existing_tool.delete_flag = 'N'
            else:
                # Insert new tool
                new_tool = ToolInfo(**tool)
                new_tool.delete_flag = 'N'
                session.add(new_tool)

        # Mark deleted tools
        for name in set(existing_tools.keys()) - tool_names_in_input:
            existing_tools[name].delete_flag = 'Y'

def query_or_create_main_agent_id(tenant_id: str = None) -> int:
    """
    obtain the main_agent id, create a blank placeholder if it does not exist
    """
    with get_db_session() as session:
        query = session.query(AgentInfo).filter(AgentInfo.delete_flag != 'Y').filter(AgentInfo.parent_agent_id is not None)
        if tenant_id:
            query = query.filter(AgentInfo.tenant_id == tenant_id)
        main_agent = query.first()

        if main_agent is None:
            main_agent = create_agent({"name": "main",
                               "tenant_id": tenant_id,
                               "created_by": tenant_id,
                               "updated_by": tenant_id,
                               "enabled": True})
            return main_agent["agent_id"]
        else:
            return main_agent.agent_id

def query_sub_agents(main_agent_id: int, tenant_id: str = None, user_id: str = None):
    """
    Query the TenantAgent list based on the optional tenant_id.
    Filter out records with delete_flag set to 'Y'.

    :param main_agent_id: Optional main agent ID for filtering
    :param tenant_id: Optional tenant ID for filtering
    :param user_id: Optional user ID for merging
    :return: List of TenantAgent objects that meet the criteria
    """
    with get_db_session() as session:
        query = session.query(AgentInfo).filter(AgentInfo.delete_flag != 'Y').filter(AgentInfo.parent_agent_id == main_agent_id)
        if tenant_id:
            query = query.filter(AgentInfo.tenant_id == tenant_id)
        agents = query.all()

        if not user_id:
            return agents

        user_agents = session.query(UserAgent).filter(
            UserAgent.tenant_id == tenant_id,
            UserAgent.user_id == user_id,
            UserAgent.delete_flag != 'Y'
        ).all()

        agent_dict = {str(agent.agent_id): agent for agent in agents}

        for user_agent in user_agents:
            agent_id = str(user_agent.agent_id)
            if agent_id in agent_dict:
                agent_info = agent_dict[agent_id]
                for key, value in user_agent.__dict__.items():
                    if key not in ['_sa_instance_state', 'agent_id'] and hasattr(agent_info, key):
                        setattr(agent_info, key, value)

        return [as_dict(agent) for agent in agents]


def create_agent(agent_info, db_session=None):
    """
    Create a new agent in the database.
    :param agent_info: Dictionary containing agent information
    :param db_session: Database session
    :return: Created agent object
    """
    with get_db_session(db_session) as session:
        new_agent = AgentInfo(**filter_property(agent_info, AgentInfo))
        new_agent.delete_flag = 'N'
        session.add(new_agent)
        session.flush()
        return as_dict(new_agent)


def update_agent(agent_id, agent_info, tenant_id=None, user_id=None):
    """
    Update an existing agent in the database.
    :param agent_id: ID of the agent to update
    :param agent_info: Dictionary containing updated agent information
    :param tenant_id: Optional tenant ID
    :param user_id: Optional user ID
    :return: Updated agent object
    """
    with get_db_session() as session:
        agent = session.query(AgentInfo).filter(AgentInfo.agent_id == agent_id).filter(
            AgentInfo.tenant_id == tenant_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        for key, value in filter_property(agent_info, AgentInfo).items():
            setattr(agent, key, value)
        agent.updated_by = user_id


def create_or_update_user_agent(agent_info, tenant_id: str = None, user_id: str = None):
    """
    Create or update a user agent in the database.
    :param agent_info: Dictionary containing user agent information
    :param tenant_id: Optional tenant ID for filtering
    :param user_id: Optional user ID for merging
    :return: Created or updated user agent object
    """
    with get_db_session() as session:
        user_agent = session.query(UserAgent).filter(
            UserAgent.tenant_id == tenant_id,
            UserAgent.user_id == user_id,
            UserAgent.agent_id == agent_info['agent_id'],
            UserAgent.delete_flag != 'Y'
        ).first()
        if not user_agent:
            new_user_agent = UserAgent(**agent_info)
            new_user_agent.delete_flag = 'N'
            session.add(new_user_agent)
            session.flush()
            return as_dict(new_user_agent)

        for key, value in agent_info.items():
            setattr(user_agent, key, value)


def create_tool(tool_info, tenant_id: str, agent_id: int, user_id: str = None, db_session=None):
    """
    Create ToolInstance in the database based on tenant_id and agent_id, optional user_id.
    :param tool_info: Dictionary containing tool information
    :param tenant_id: Tenant ID for filtering, mandatory
    :param user_id: Optional user ID for filtering
    :param agent_id: Optional agent ID for filtering
    :param db_session: Optional database session
    :return: Created or updated ToolInstance object
    """
    # Add tenant_id and user_id to tool_info
    tool_info['tenant_id'] = tenant_id
    tool_info['user_id'] = user_id
    tool_info['agent_id'] = agent_id
    with get_db_session(db_session) as session:
        # Create a new ToolInstance
        new_tool_instance = ToolInstance(**filter_property(tool_info, ToolInstance))
        session.add(new_tool_instance)
        return new_tool_instance


def create_or_update_tool(tool_info, tenant_id: str, agent_id: int, user_id: str = None, db_session=None):
    """
    Create or update a ToolInstance in the database based on tenant_id and agent_id, optional user_id.

    :param tool_info: Dictionary containing tool information
    :param tenant_id: Tenant ID for filtering, mandatory
    :param user_id: Optional user ID for filtering
    :param agent_id: Optional agent ID for filtering
    :param db_session: Optional database session
    :return: Created or updated ToolInstance object
    """
    # Add tenant_id and user_id to tool_info
    tool_info['tenant_id'] = tenant_id
    tool_info['user_id'] = user_id

    with get_db_session(db_session) as session:
        # Query if there is an existing ToolInstance
        query = session.query(ToolInstance).filter(ToolInstance.tenant_id == tenant_id).filter(
            ToolInstance.agent_id == agent_id)
        if user_id:
            query = query.filter(ToolInstance.user_id == user_id)

        tool_instance = query.first()

        if tool_instance:
            # Update the existing ToolInstance
            for key, value in tool_info.items():
                if hasattr(tool_instance, key):
                    setattr(tool_instance, key, value)
        else:
            create_tool(tool_info, tenant_id, agent_id, user_id, db_session)

        session.flush()
        return tool_instance


def query_tools():
    """
    Query ToolInfo in the database based on tenant_id and agent_id, optional user_id.
    :return: List of ToolInfo objects
    """
    with get_db_session() as session:
        tools = session.query(ToolInfo).filter(ToolInfo.delete_flag != 'Y').all()
        return [as_dict(tool) for tool in tools]


def query_tool_instances(tenant_id: str, user_id: str = None):
    """
    Query ToolInstance in the database based on tenant_id and agent_id, optional user_id.
    :param tenant_id: Tenant ID for filtering, mandatory
    :param user_id: Optional user ID for filtering
    :return: List of ToolInstance objects
    """
    with get_db_session() as session:
        query = session.query(ToolInstance).filter(ToolInstance.tenant_id == tenant_id).filter(
            ToolInstance.delete_flag != 'Y')
        if user_id:
            query = query.filter(ToolInstance.user_id == user_id)
        tools = query.all()
        return [as_dict(tool) for tool in tools]


def delete_agent(agent_id, tenant_id: str = None, user_id: str = None):
    """
    Delete an agent in the database.
    :param agent_id: ID of the agent to delete
    :param tenant_id: Tenant ID for filtering, mandatory
    :param user_id: Optional user ID for filtering
    :return: None
    """
    with get_db_session() as session:
        session.query(AgentInfo).filter(AgentInfo.agent_id == agent_id).filter(AgentInfo.tenant_id == tenant_id).update(
            {'delete_flag': 'Y', 'updated_by': user_id})
        session.query(ToolInstance).filter(ToolInstance.agent_id == agent_id).filter(
            AgentInfo.tenant_id == tenant_id).update({ToolInstance.delete_flag: 'Y', 'updated_by': user_id})


def update_tool_table_from_scan_tool_list():
    """
    scan all tools and update the tool table in PG database, remove the duplicate tools
    """
    user_id, _ = get_user_info()
    tool_list = scan_tools()
    with get_db_session() as session:
        # get all existing tools (including complete information)
        existing_tools = session.query(ToolInfo).filter(ToolInfo.delete_flag != 'Y').all()
        existing_tool_dict = {f"{tool.name}&{tool.source}": tool for tool in existing_tools}
        
        for tool in tool_list:
            filtered_tool_data = filter_property(tool.__dict__, ToolInfo)
            
            if f"{tool.name}&{tool.source}" in existing_tool_dict:
                # by tool name and source to identify the existing tool
                existing_tool = existing_tool_dict[f"{tool.name}&{tool.source}"]
                for key, value in filtered_tool_data.items():
                    setattr(existing_tool, key, value)
                existing_tool.updated_by = user_id
            else:
                # create new tool
                filtered_tool_data.update({"created_by": user_id, "updated_by": user_id, "author": user_id})
                new_tool = ToolInfo(**filtered_tool_data)
                session.add(new_tool)
        
        session.flush()
