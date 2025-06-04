from typing import List
import asyncio
from threading import Thread
from smolagents import ActionStep, TaskStep, AgentText, handle_agent_output_types, ToolCollection


from ..agents.code_agent import CoreAgent
from ..agents.agent_const import AgentRunInfo, AgentHistory
from ..agents.agent_create_factory import AgentCreateFactory
from ..utils.observer import MessageObserver, ProcessType


def add_message_to_observer(observer: MessageObserver, step_log: ActionStep):
    if not isinstance(step_log, ActionStep):
        return
    # Keep duration
    if hasattr(step_log, "duration"):
        observer.add_message("", ProcessType.TOKEN_COUNT, str(round(float(step_log.duration), 2)))

    if hasattr(step_log, "error") and step_log.error is not None:
        observer.add_message("", ProcessType.ERROR, str(step_log.error))


def agent_run_with_observer(agent: CoreAgent, query: str, reset=True):
    if not isinstance(agent, CoreAgent):
        raise TypeError("agent must be a CoreAgent object")

    observer = agent.observer
    total_input_tokens, total_output_tokens = 0, 0
    try:
        for step_log in agent.run(query, stream=True, reset=reset):
            # Check if we need to stop from external stop_event
            if agent.stop_event.is_set():
                observer.add_message(agent.agent_name, ProcessType.ERROR, "Agent execution interrupted by external stop signal")

            if getattr(agent.model, "last_input_token_count", None) is not None:
                total_input_tokens += agent.model.last_input_token_count
                total_output_tokens += agent.model.last_output_token_count
                if isinstance(step_log, ActionStep):
                    step_log.input_token_count = agent.model.last_input_token_count
                    step_log.output_token_count = agent.model.last_output_token_count

            # Add content to observer
            add_message_to_observer(observer, step_log)

        final_answer = step_log  # Last log is the run's final_answer
        final_answer = handle_agent_output_types(final_answer)

        if isinstance(final_answer, AgentText):
            observer.add_message(agent.agent_name, ProcessType.FINAL_ANSWER, final_answer.to_string())
        else:
            observer.add_message(agent.agent_name, ProcessType.FINAL_ANSWER, str(final_answer))
    except Exception as e:
        observer.add_message(agent_name=agent.agent_name, process_type=ProcessType.ERROR,
                             content=f"Error in interaction: {str(e)}")
        raise ValueError(f"Error in interaction: {str(e)}")


def agent_run_thread(agent_run_info: AgentRunInfo):
    if not isinstance(agent_run_info, AgentRunInfo):
        raise TypeError("agent_run_info must be a AgentRunInfo object")

    try:
        mcp_host = agent_run_info.mcp_host
        if mcp_host is None:
            factory = AgentCreateFactory(observer=agent_run_info.observer,
                                         model_config_list=agent_run_info.model_config_list,
                                         stop_event=agent_run_info.stop_event)
            agent = factory.create_single_agent(agent_run_info.agent_config)
            add_history_to_agent(agent, agent_run_info.history)
            agent_run_with_observer(agent=agent, query=agent_run_info.query, reset=False)
        else:
            with ToolCollection.from_mcp({"url": mcp_host}) as tool_collection:
                factory = AgentCreateFactory(observer=agent_run_info.observer,
                                            model_config_list=agent_run_info.model_config_list,
                                            stop_event=agent_run_info.stop_event,
                                            mcp_tool_collection=tool_collection)
                agent = factory.create_single_agent(agent_run_info.agent_config)
                add_history_to_agent(agent, agent_run_info.history)
                agent_run_with_observer(agent=agent, query=agent_run_info.query, reset=False)
    except Exception as e:
        raise ValueError(f"Error in agent_run_thread: {e}")


def add_history_to_agent(agent: CoreAgent, history: List[AgentHistory]):
    """
    Add conversation history to agent's memory

    Args:
        agent: The CoreAgent instance to update
        history: List of conversation messages with role and content
    """
    if history is None:
        return

    if not all(isinstance(msg, AgentHistory) for msg in history):
        raise TypeError("history must be a list of AgentHistory objects")

    agent.memory.reset()
    # Add conversation history to memory sequentially
    for msg in history:
        if msg.role == 'user':
            # Create task step for user message
            agent.memory.steps.append(TaskStep(task=msg.content))
        elif msg.role == 'assistant':
            agent.memory.steps.append(ActionStep(action_output=msg.content, model_output=msg.content))


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