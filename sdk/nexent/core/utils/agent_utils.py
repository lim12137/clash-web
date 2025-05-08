from smolagents import ActionStep, AgentText, handle_agent_output_types

from ..agents import CoreAgent
from ..utils.observer import MessageObserver, ProcessType


def add_message_to_observer(observer: MessageObserver, step_log: ActionStep):
    if not isinstance(step_log, ActionStep):
        return
    # Keep duration
    if hasattr(step_log, "duration"):
        observer.add_message("", ProcessType.TOKEN_COUNT, str(round(float(step_log.duration), 2)))

    if hasattr(step_log, "error") and step_log.error is not None:
        observer.add_message("", ProcessType.ERROR, str(step_log.error))


def agent_run_with_observer(agent: CoreAgent, query, reset=True):
    total_input_tokens, total_output_tokens = 0, 0
    observer = agent.observer
    try:
        for step_log in agent.run(query, stream=True, reset=reset):
            # Check if we need to stop
            if agent.should_stop:
                observer.add_message(agent.agent_name, ProcessType.ERROR, "Agent execution interrupted by user")
                break

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
        print(f"Error in interaction: {str(e)}")
        observer.add_message(agent_name=agent.agent_name, process_type=ProcessType.ERROR,
                             content=f"Error in interaction: {str(e)}")
