import asyncio
from threading import Thread
import os
import importlib.util
from langchain_core.tools import BaseTool
from smolagents.tools import Tool

from smolagents import ToolCollection

from .nexent_agent import NexentAgent, ProcessType
from .agent_model import AgentRunInfo


def agent_run_thread(agent_run_info: AgentRunInfo):
    if not isinstance(agent_run_info, AgentRunInfo):
        raise TypeError("agent_run_info must be a AgentRunInfo object")

    try:
        mcp_host = agent_run_info.mcp_host
        if mcp_host is None or len(mcp_host)==0:
            nexent = NexentAgent(
                observer=agent_run_info.observer,
                model_config_list=agent_run_info.model_config_list,
                stop_event=agent_run_info.stop_event
            )
            agent = nexent.create_single_agent(agent_run_info.agent_config)
            nexent.set_agent(agent)
            nexent.add_history_to_agent(agent_run_info.history)
            nexent.agent_run_with_observer(query=agent_run_info.query, reset=False)
        else:
            agent_run_info.observer.add_message("", ProcessType.AGENT_NEW_RUN, "<MCP_START>")
            mcp_client_list = [{"url": mcp_url} for mcp_url in mcp_host]
            
            # Load local LangChain tools once and extend the MCP ToolCollection with them
            langchain_tools = load_langchain_tools()


            with ToolCollection.from_mcp(mcp_client_list, trust_remote_code=True) as tool_collection:
                # Merge LangChain tools into the MCP tool collection for downstream usage
                if langchain_tools:
                    tool_collection.tools.extend(langchain_tools)
                nexent = NexentAgent(
                    observer=agent_run_info.observer,
                    model_config_list=agent_run_info.model_config_list,
                    stop_event=agent_run_info.stop_event,
                    mcp_tool_collection=tool_collection
                )
                agent = nexent.create_single_agent(agent_run_info.agent_config)
                nexent.set_agent(agent)
                nexent.add_history_to_agent(agent_run_info.history)
                nexent.agent_run_with_observer(query=agent_run_info.query, reset=False)
    except Exception as e:
        if "Couldn't connect to the MCP server" in str(e):
            mcp_connect_error_str = "MCP服务器连接超时。" if agent_run_info.observer.lang == "zh" else "Couldn't connect to the MCP server."
            agent_run_info.observer.add_message("", ProcessType.FINAL_ANSWER, mcp_connect_error_str)
        else:
            agent_run_info.observer.add_message("", ProcessType.FINAL_ANSWER, f"Run Agent Error: {e}")
        raise ValueError(f"Error in agent_run_thread: {e}")


async def agent_run(agent_run_info: AgentRunInfo):
    if not isinstance(agent_run_info, AgentRunInfo):
        raise TypeError("agent_run_info must be a AgentRunInfo object")

    observer = agent_run_info.observer

    thread_agent = Thread(target=agent_run_thread, args=(agent_run_info,))
    thread_agent.start()

    while thread_agent.is_alive():
        cached_message = observer.get_cached_message()
        for message in cached_message:
            yield message

            # Prevent artificial slowdown of model streaming output
            if len(cached_message) < 8:
                # Ensure streaming output has some time interval
                 await asyncio.sleep(0.05)
        await asyncio.sleep(0.1)

    # Ensure all messages are sent
    cached_message = observer.get_cached_message()
    for message in cached_message:
        yield message


def load_langchain_tools(directory: str | None = None):
    """Scan *directory* (default: backend/mcp_service/langchain) for LangChain BaseTool
    instances and return them wrapped as smolagents.tools.Tool objects.

    Args:
        directory: Custom directory path. If *None*, use the project-relative
                   backend/mcp_service/langchain.

    Returns:
        List[Tool]: Converted tools ready for use in ToolCollection.
    """
    if directory is None:
        directory = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../../backend/mcp_service/langchain")
        )

    langchain_tools: list[Tool] = []

    if not os.path.isdir(directory):
        return langchain_tools  # Gracefully return empty list if directory missing

    for filename in os.listdir(directory):
        if not filename.endswith(".py") or filename.startswith("__"):
            continue
        module_path = os.path.join(directory, filename)
        module_name = f"nexent_langchain_tool_{filename[:-3]}"  # unique name to avoid conflicts
        try:
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)  # type: ignore
                # Iterate over attributes to find LangChain BaseTool instances
                for attr_name in dir(module):
                    if attr_name.startswith("__"):
                        continue
                    obj = getattr(module, attr_name)
                    if isinstance(obj, BaseTool):
                        try:
                            langchain_tools.append(Tool.from_langchain(obj))
                        except Exception:
                            continue  # Ignore objects that fail conversion
        except Exception:
            # Ignore modules that cannot be imported
            continue

    return langchain_tools