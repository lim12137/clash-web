import time
from threading import Thread
from typing import Any

from fastapi import HTTPException
from smolagents import ToolCollection
from smolagents import handle_agent_output_types, AgentText, ActionStep

from ..agents import CoreAgent
from ..models import OpenAIModel
from ..utils.observer import MessageObserver, ProcessType


def add_message_to_observer(observer: MessageObserver, step_log: ActionStep):
    if not isinstance(step_log, ActionStep):
        return
    # 此处删除了token消耗数量

    # 保留耗时
    if hasattr(step_log, "duration"):
        observer.add_message("", ProcessType.TOKEN_COUNT, str(round(float(step_log.duration), 2)))

    if hasattr(step_log, "error") and step_log.error is not None:
        observer.add_message("", ProcessType.ERROR, str(step_log.error))


def agent_run_thread(agent: CoreAgent, query: str, mcp_host, reset=True):
    try:
        with ToolCollection.from_mcp({"url": mcp_host}) as tool_collection:
            agent.tools.update({tool.name: tool for tool in tool_collection.tools})

            total_input_tokens, total_output_tokens = 0, 0
            observer = agent.observer
            try:
                for step_log in agent.run(query, stream=True, reset=reset):
                    # 检查是否需要停止
                    if agent.should_stop:
                        observer.add_message(agent.agent_name, ProcessType.ERROR, "Agent运行被用户中断")
                        break

                    if getattr(agent.model, "last_input_token_count", None) is not None:
                        total_input_tokens += agent.model.last_input_token_count
                        total_output_tokens += agent.model.last_output_token_count
                        if isinstance(step_log, ActionStep):
                            step_log.input_token_count = agent.model.last_input_token_count
                            step_log.output_token_count = agent.model.last_output_token_count

                    # 把内容放入到observer
                    add_message_to_observer(observer, step_log)

                final_answer = step_log  # Last log is the run's final_answer
                final_answer = handle_agent_output_types(final_answer)

                if isinstance(final_answer, AgentText):
                    observer.add_message(agent.agent_name, ProcessType.FINAL_ANSWER, final_answer.to_string())
                else:
                    observer.add_message(agent.agent_name, ProcessType.FINAL_ANSWER, str(final_answer))
            except Exception as e:
                print(f"Error in interaction: {str(e)}")
                observer.add_message(agent_name=agent.agent_name, process_type=ProcessType.ERROR,
                                     content=f"Error in interaction: {str(e)}")
    except Exception as e:
        print(f"mcp连接出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"MCP服务器未连接: {str(e)}")


def agent_run(agent: Any, query: str, reset=True):
    if not isinstance(agent, CoreAgent):
        raise HTTPException(status_code=400, detail="Create Agent Object with CodeAgent")
    if not isinstance(agent.model, OpenAIModel):
        raise HTTPException(status_code=400, detail="Create Model Object with OpenAIModel")
    if not isinstance(agent.observer, MessageObserver):
        raise HTTPException(status_code=400, detail="Create Observer Object with MessageObserver")

    observer = agent.observer

    thread_agent = Thread(target=agent_run_thread, args=(agent, query, reset))
    thread_agent.start()

    while thread_agent.is_alive():
        cached_message = observer.get_cached_message()
        for message in cached_message:
            yield f"data: {message}\n\n"

        time.sleep(0.2)

    # 确保信息发送完毕
    cached_message = observer.get_cached_message()
    for message in cached_message:
        yield f"data: {message}\n\n"
