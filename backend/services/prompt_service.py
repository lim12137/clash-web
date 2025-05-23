import os
import concurrent.futures
import logging

import yaml
from smolagents import OpenAIServerModel
from smolagents.utils import BASE_BUILTIN_MODULES
from smolagents.agents import populate_template
from jinja2 import StrictUndefined, Template
from dotenv import load_dotenv

from consts.model import GeneratePromptRequest, FineTunePromptRequest, AgentDetailInformation, AgentInfoRequest
from services.tool_configuration_service import get_tool_detail_information
from database.agent_db import query_tool_instances, query_sub_agents, save_agent_prompt, update_agent
from utils.prompt_utils import fill_agent_prompt
from utils.user_utils import get_user_info


load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)


def call_llm_for_system_prompt(user_prompt: str, system_prompt: str) -> str:
    """
    Call LLM to generate system prompt

    Args:
        user_prompt: description of the current task
        system_prompt: system prompt for the LLM

    Returns:
        str: Generated system prompt
    """
    logger.info("Calling LLM for system prompt generation")

    llm = OpenAIServerModel(model_id=os.getenv('LLM_MODEL_NAME'),
                            api_base=os.getenv('LLM_MODEL_URL'),
                            api_key=os.getenv('LLM_API_KEY'), temperature=0.3, top_p=0.95)
    messages = [{"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}]
    
    try:
        response = llm(messages)
        logger.info("Successfully generated prompt from LLM")
        return response.content.strip()
    except Exception as e:
        logger.error(f"Failed to generate prompt from LLM: {str(e)}")
        raise e


def generate_system_prompt_impl(prompt_info: GeneratePromptRequest):
    logger.info(f"Starting prompt generation for agent_id: {prompt_info.agent_id}")
    user_id, tenant_id = get_user_info()
    with open('backend/prompts/utils/prompt_generate.yaml', "r", encoding="utf-8") as f:
        prompt_for_generate = yaml.safe_load(f)

    # Get description of tool and agent
    tool_info_list, sub_agent_info_list = get_tool_and_agent_description(tenant_id, prompt_info, user_id)
    tool_description = "\n".join([str(tool) for tool in tool_info_list])
    agent_description = "\n".join([str(sub_agent_info) for sub_agent_info in sub_agent_info_list])

    # Generate content using template
    compiled_template = Template(prompt_for_generate["USER_PROMPT"], undefined=StrictUndefined)
    content = compiled_template.render({
        "tool_description": tool_description,
        "agent_description": agent_description,
        "task_description": prompt_info.task_description
    })

    # Generate prompts using thread pool
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        duty_future = executor.submit(call_llm_for_system_prompt, content, prompt_for_generate["DUTY_SYSTEM_PROMPT"])
        constraint_future = executor.submit(call_llm_for_system_prompt, content, prompt_for_generate["CONSTRAINT_SYSTEM_PROMPT"])
        few_shots_future = executor.submit(call_llm_for_system_prompt, content, prompt_for_generate["FEW_SHOTS_SYSTEM_PROMPT"])
        duty_prompt = duty_future.result()
        constraint_prompt = constraint_future.result()
        few_shots_prompt = few_shots_future.result()

    # Fill the system prompt
    logger.info("Filling agent prompt template")
    agent_prompt = fill_agent_prompt(
        duty=duty_prompt,
        constraint=constraint_prompt,
        few_shots=few_shots_prompt,
        is_manager_agent=len(sub_agent_info_list) > 0
    )
    need_filled_system_prompt = agent_prompt["system_prompt"]

    # Populate template with variables
    logger.info("Populating template with variables")
    system_prompt = populate_template(
        need_filled_system_prompt,
        variables={
            "tools": {tool.name: tool for tool in tool_info_list},
            "managed_agents": {sub_agent.name: sub_agent for sub_agent in sub_agent_info_list},
            "authorized_imports": str(BASE_BUILTIN_MODULES),
        },
    )

    # Update agent with task_description and prompt
    logger.info("Updating agent with business_description and prompt")
    agent_info = AgentInfoRequest(
        agent_id=prompt_info.agent_id,
        business_description=prompt_info.task_description,
        prompt=system_prompt
    )
    update_agent(
        agent_id=prompt_info.agent_id,
        agent_info=agent_info,
        tenant_id=tenant_id,
        user_id=user_id
    )

    logger.info("Prompt generation and agent update completed successfully")
    return system_prompt


def get_tool_and_agent_description(tenant_id, prompt_info, user_id: str = None):

    logger.info(f"Processing for tenant_id: {tenant_id}")

    # Get tool information
    logger.info("Fetching tool instances")
    tool_list = query_tool_instances(tenant_id=tenant_id, agent_id=prompt_info.agent_id)
    logger.info(f"Found {len(tool_list)} tool instances")

    tool_id_list = [tool.get("tool_id") for tool in tool_list]
    tool_info_list = get_tool_detail_information(tool_id_list)

    # Get agent information
    logger.info("Fetching sub-agents information")
    agent_id = prompt_info.agent_id
    sub_agent_raw_info_list = query_sub_agents(main_agent_id=agent_id, tenant_id=tenant_id, user_id=user_id)

    logger.info(f"Found {len(sub_agent_raw_info_list)} sub-agents")

    sub_agent_info_list = []
    for sub_agent_raw_info in sub_agent_raw_info_list:
        if not sub_agent_raw_info["enabled"]:
            continue
        agent_detail_information = AgentDetailInformation()
        agent_detail_information.name = sub_agent_raw_info.get("name")
        agent_detail_information.description = sub_agent_raw_info.get("description")
        sub_agent_info_list.append(agent_detail_information)

    return tool_info_list, sub_agent_info_list


def fine_tune_prompt(req: FineTunePromptRequest):
    logger.info("Starting prompt fine-tuning")

    try:
        with open('backend/prompts/utils/prompt_fine_tune.yaml', "r", encoding="utf-8") as f:
            prompt_for_fine_tune = yaml.safe_load(f)

        compiled_template = Template(prompt_for_fine_tune["FINE_TUNE_USER_PROMPT"], undefined=StrictUndefined)
        content = compiled_template.render({
            "prompt": req.system_prompt,
            "command": req.command
        })

        logger.info("Calling LLM for prompt fine-tuning")
        regenerate_prompt = call_llm_for_system_prompt(
            user_prompt=content,
            system_prompt=prompt_for_fine_tune["FINE_TUNE_SYSTEM_PROMPT"]
        )
        logger.info("Successfully completed prompt fine-tuning")
        return regenerate_prompt

    except Exception as e:
        logger.error(f"Error in prompt fine-tuning process: {str(e)}")
        raise e


def save_prompt_impl(agent_id: int, prompt: str):
    """
    Save a prompt for an agent
    """
    logger.info(f"Starting prompt save for agent_id: {agent_id}")
    try:
        _, tenant_id = get_user_info()
        logger.info(f"Processing for tenant_id: {tenant_id}")
        
        result = save_agent_prompt(
            agent_id=agent_id,
            prompt=prompt,
            tenant_id=tenant_id
        )
        logger.info("Successfully saved prompt")
        return result
    except Exception as e:
        logger.error(f"Failed to save prompt: {str(e)}")
        raise e
