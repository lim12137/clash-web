from collections import defaultdict

from database.agent_db import create_agent, query_tool_instances, query_tools, \
    query_or_create_main_agent_id, query_sub_agents, search_sub_agent_by_main_agent_id


def get_creating_sub_agent_id_api(main_agent_id: int, tenant_id: str = None) -> int:
    #  first find the sub agent, if it exists, it means the agent was created before, but exited prematurely; if it does not exist, create a new one
    sub_agent_id = search_sub_agent_by_main_agent_id(main_agent_id, tenant_id)
    if sub_agent_id:
        return sub_agent_id
    else:
        return create_agent({"tenant_id": tenant_id,
                            "created_by": tenant_id,
                            "updated_by": tenant_id,
                            "enabled": False,
                            "parent_agent_id": main_agent_id})["agent_id"]


def query_or_create_main_agents_api(tenant_id: str = None):
    main_agents_id = query_or_create_main_agent_id(tenant_id)
    return main_agents_id


def query_sub_agents_api(main_agent_id: int, tenant_id: str = None, user_id: str = None):
    sub_agents = query_sub_agents(main_agent_id, tenant_id, user_id)

    tools = query_tools()
    tool_instances = query_tool_instances(tenant_id, user_id)
    merge_tool_instance(tool_instances, tools)

    # Add tool instances to agent
    add_tools_to_agent(sub_agents, tool_instances)
    return sub_agents


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
