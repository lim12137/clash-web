from database.agent_db import update_tools, create_agent, update_agent, create_user_agent, query_agents
from database.client import get_db_session
from database.db_models import ToolInfo, AgentInfo, UserAgent


def test_update_tools():
    tools = [
        {"name": "test_tool1", "description": "Description 1", "params": []},
        {"name": "test_tool2", "description": "Description 2", "params": []},
        {"name": "test_tool3", "description": "Description 3", "params": []},
    ]
    try:
        update_tools(tools)

        tools[1]["description"] = "Updated Description 2"
        tools.append({"name": "test_tool4", "description": "Description 4", "params": []})
        tools.remove(tools[0])
        update_tools(tools)

        with get_db_session() as session:
            existing_tools = {tool.name: tool for tool in
                              session.query(ToolInfo).filter(ToolInfo.delete_flag != 'Y').all()}

            # Assert that exactly three tools were created or updated
            assert len(existing_tools) == 3
            # Assert that the descriptions of the existing tools match the expected values
            assert existing_tools["test_tool4"].description == "Description 4"
            # Assert that the description of the updated tool matches the expected value
            assert existing_tools["test_tool2"].description == "Updated Description 2"
    finally:
        with get_db_session() as session:
            test_tools = [tool["name"] for tool in tools]
            test_tools.append("test_tool1")
            session.query(ToolInfo).filter(ToolInfo.name.in_(test_tools)).delete()


def test_create_agents():
    agent = {
        "name": "test_agent",
        "description": "Description 1",
        "prompt_core": "Prompt 1",
    }

    try:
        create_agent(agent)

        with get_db_session() as session:
            existing_agents = session.query(AgentInfo).filter(AgentInfo.delete_flag != "Y").filter(
                AgentInfo.name == agent["name"]).all()
            # Assert that exactly one agent was created
            assert len(existing_agents) == 1
    finally:
        with get_db_session() as session:
            session.query(AgentInfo).filter(AgentInfo.name == agent["name"]).delete()


def test_update_agents():
    agent = {
        "name": "test_agent",
        "description": "Description 1",
        "prompt_core": "Prompt 1",
    }

    try:
        agent = create_agent(agent)
        update_info = {"description": "Description 2"}
        update_agent(agent["agent_id"], update_info)
        with get_db_session() as session:
            existing_agents = session.query(AgentInfo).filter(AgentInfo.delete_flag!= "Y").filter(
                AgentInfo.name == agent["name"]).all()

            # Assert that exactly one agent was updated
            assert existing_agents[0].description == update_info["description"]
    finally:
        with get_db_session() as session:
            session.query(AgentInfo).filter(AgentInfo.name == agent["name"]).delete()

def test_create_user_agent():
    user_agent = {
        "agent_id": 1,
        "prompt_core": "test use case Prompt 1",
    }
    try:
        create_user_agent(user_agent)

        with get_db_session() as session:
            existing_agents = session.query(UserAgent).filter(UserAgent.delete_flag!= "Y").filter(
                UserAgent.prompt_core == user_agent["prompt_core"]).all()

            # Assert that exactly one agent was created
            assert len(existing_agents) == 1
    finally:
        with get_db_session() as session:
            session.query(UserAgent).filter(UserAgent.prompt_core == user_agent["prompt_core"]).delete()

def test_query_agents():
    agent = {
        "name": "test_agent",
        "description": "Description 1",
        "prompt_core": "Prompt 1",
        "tenant_id": "test_tenant_id",
    }

    user_agent = {
        "prompt_core": "test use case user Prompt 1",
        "tenant_id": "test_tenant_id",
        "user_id": "test_user_id",
    }

    try:
        agent = create_agent(agent)
        user_agent["agent_id"] = agent["agent_id"]
        create_user_agent(user_agent)

        result = query_agents(agent["tenant_id"], user_agent["user_id"])

        # Assert that exactly one agent was created
        assert len(result) == 1
        # Assert that the agent information matches the expected values
        assert result[0]["name"] == agent["name"]
        assert result[0]["description"] == agent["description"]
        assert result[0]["prompt_core"] == user_agent["prompt_core"]
    finally:
        with get_db_session() as session:
            session.query(AgentInfo).filter(AgentInfo.name == agent["name"]).delete()
            session.query(UserAgent).filter(UserAgent.prompt_core == user_agent["prompt_core"]).delete()