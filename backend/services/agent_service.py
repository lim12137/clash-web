from collections import defaultdict

from consts.model import AgentInfoRequest
from database.agent_db import create_agent, create_tool, query_agents, query_tool_instances, query_tools
from database.client import get_db_session


def create_agent_api(request: AgentInfoRequest, tenant_id: str = None, user_id: str = None):
    """
    Create agent API endpoint
    :param request: AgentInfoRequest
    :param tenant_id: str
    :param user_id: str
    :return: AgentInfo
    """
    # Ensure configuration is up to date
    with get_db_session() as session:
        agent = create_agent(request, session)
        for tool in request.tools:
            create_tool(tool, tenant_id, agent["agent_id"], user_id, session)
        return agent

def query_agents_api(tenant_id: str = None, user_id: str = None):
    """
    Query agent API endpoint, create if the main Agent cannot be found.
    :param tenant_id: str
    :param user_id: str
    :return: List[AgentInfo]
    """
    agents = query_agents(tenant_id, user_id)
    if len(agents) == 0:
        main_agent = create_agent({"name": "main", "tenant_id": tenant_id})
        agents.append(main_agent)
        return agents

    tools = query_tools()
    tool_instances = query_tool_instances(tenant_id, user_id)

    # Merge tool instance with tool
    merge_tool_instance(tool_instances, tools)

    # Add tool instances to agent
    add_tools_to_agent(agents, tool_instances)

    return agents


def add_tools_to_agent(agents, tool_instances):
    """
    Add tools to agents
    :param agents: List[AgentInfo]
    :param tool_instances: List[ToolInstance]
    :return: None
    """
    # Group tool_instances by agent_id
    tool_instances_by_agent = defaultdict(list)
    for tool_instance in tool_instances:
        agent_id = tool_instance.get("agent_id")
        if agent_id is not None:
            tool_instances_by_agent[agent_id].append(tool_instance)
    # Map agent_id to agent
    agent_dict = {agent["agent_id"]: agent for agent in agents}
    # Assign grouped tools to corresponding agents
    for agent_id, tools in tool_instances_by_agent.items():
        if agent_id in agent_dict:
            agent_dict[agent_id]["tools"] = tools


def merge_tool_instance(tool_instances, tools):
    """
    Merge tool instance with tool
    :param tool_instances: List[ToolInstance]
    :param tools: List[Tool]
    :return: None
    """
    # Create a dictionary to map tool_id to tool
    tool_dict = {tool["tool_id"]: tool.copy() for tool in tools}

    # Assign properties from tool to tool_instance
    for tool_instance in tool_instances:
        tool_id = tool_instance.get("tool_id")
        if tool_id in tool_dict:
            tool = tool_dict[tool_id]
            for key, value in tool.items():
                if key not in tool_instance:
                    tool_instance[key] = value
