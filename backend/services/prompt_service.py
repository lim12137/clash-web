import os
import concurrent.futures

import yaml
from smolagents import OpenAIServerModel
from smolagents.utils import BASE_BUILTIN_MODULES
from smolagents.agents import populate_template
from jinja2 import StrictUndefined, Template
from dotenv import load_dotenv

from consts.model import GeneratePromptRequest, FineTunePromptRequest, AgentDetailInformation
from services.tool_configuration_service import get_tool_detail_information
from database.agent_db import query_tool_instances, query_sub_agents
from utils.prompt_utils import fill_agent_prompt
from utils.user_utils import get_user_info


load_dotenv()


def call_llm_for_system_prompt(user_prompt: str, system_prompt: str) -> str:
    """
    Call LLM to generate system prompt

    Args:
        user_prompt: description of the current task
        system_prompt: system prompt for the LLM

    Returns:
        str: Generated system prompt
    """
    llm = OpenAIServerModel(model_id=os.getenv('LLM_MODEL_NAME'),
                            api_base=os.getenv('LLM_MODEL_URL'),
                            api_key=os.getenv('LLM_API_KEY'), temperature=0.3, top_p=0.95)
    messages = [{"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}]
    response = llm(messages)

    return response.content.strip()


def generate_system_prompt_impl(prompt_info: GeneratePromptRequest):
    with open('backend/prompts/utils/prompt_generate.yaml', "r", encoding="utf-8") as f:
        prompt_for_generate = yaml.safe_load(f)
    _, tenant_id = get_user_info()
    tool_list = query_tool_instances(tenant_id=tenant_id, agent_id=prompt_info.agent_id)

    tool_id_list = [tool.get("tool_id") for tool in tool_list]
    tool_info_list = get_tool_detail_information(tool_id_list)
    tool_description = "\n".join([str(tool) for tool in tool_info_list])

    agent_id = prompt_info.agent_id
    sub_agent_raw_info_list = query_sub_agents(main_agent_id=agent_id, tenant_id=tenant_id)
    sub_agent_info_list = []
    for sub_agent_raw_info in sub_agent_raw_info_list:
        agent_detail_information = AgentDetailInformation()
        agent_detail_information.name = sub_agent_raw_info.get("name")
        agent_detail_information.description = sub_agent_raw_info.get("description")
        sub_agent_info_list.append(agent_detail_information)
    agent_description = "\n".join([str(sub_agent_info) for sub_agent_info in sub_agent_info_list])

    compiled_template = Template(prompt_for_generate["USER_PROMPT"], undefined=StrictUndefined)
    content = compiled_template.render({
        "tool_description": tool_description,
        "agent_description": agent_description,
        "task_description": prompt_info.task_description
    })

    # use thread pool to execute three functions
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        # submit three tasks and get future objects
        duty_future = executor.submit(call_llm_for_system_prompt, content, prompt_for_generate["DUTY_SYSTEM_PROMPT"])
        constraint_future = executor.submit(call_llm_for_system_prompt, content, prompt_for_generate["CONSTRAINT_SYSTEM_PROMPT"])
        few_shots_future = executor.submit(call_llm_for_system_prompt, content, prompt_for_generate["FEW_SHOTS_SYSTEM_PROMPT"])

        # get results
        duty_prompt = duty_future.result()
        constraint_prompt = constraint_future.result()
        few_shots_prompt = few_shots_future.result()

    # fill the system prompt
    agent_prompt = fill_agent_prompt(
        duty=duty_prompt,
        constraint=constraint_prompt,
        few_shots=few_shots_prompt,
        is_manager_agent=len(sub_agent_raw_info_list) > 0
    )
    need_filled_system_prompt = agent_prompt["system_prompt"]

    # fill the tool description and agent description
    system_prompt = populate_template(
        need_filled_system_prompt,
        variables={
            "tools": {tool.name: tool for tool in tool_info_list},
            "managed_agents": {sub_agent.name: sub_agent for sub_agent in sub_agent_info_list},
            "authorized_imports": str(BASE_BUILTIN_MODULES),
        },
    )

    return system_prompt


def fine_tune_prompt(req: FineTunePromptRequest):
    with open('backend/prompts/utils/prompt_fine_tune.yaml', "r", encoding="utf-8") as f:
        prompt_for_fine_tune = yaml.safe_load(f)

    compiled_template = Template(prompt_for_fine_tune["FINE_TUNE_USER_PROMPT"], undefined=StrictUndefined)
    content = compiled_template.render({
        "prompt": req.system_prompt,
        "command": req.command
    })

    regenerate_prompt = call_llm_for_system_prompt(
        user_prompt=content,
        system_prompt=prompt_for_fine_tune["FINE_TUNE_SYSTEM_PROMPT"]
    )
    return regenerate_prompt
