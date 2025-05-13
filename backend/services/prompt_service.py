import re
import os
import yaml
from smolagents import OpenAIServerModel
from smolagents.utils import BASE_BUILTIN_MODULES
from smolagents.agents import populate_template

from dotenv import load_dotenv
from consts.model import GeneratePromptRequest, FineTunePromptRequest
from services.tool_configuration_service import get_tool_detail_information
import concurrent.futures
from jinja2 import Undefined, StrictUndefined, Template


load_dotenv()

class KeepTemplateUndefined(Undefined):
    """
    use to handle undefined variables in Jinja2 templates
    """
    def __str__(self):
        return f"{{{{ {self._undefined_name} }}}}"

    def __getattr__(self, name):
        # when accessing undefined variable properties (e.g. {{ user.name }}), return {{ user.name }}
        return KeepTemplateUndefined(name=f"{self._undefined_name}.{name}")

    def __iter__(self):
        # key point: return a placeholder for undefined iterable objects to keep for loop structure
        return iter([KeepTemplateUndefined(name="tool")])  # return a virtual tool object

    def __call__(self, *args, **kwargs):
        # when calling undefined variable methods (e.g. {{ tools.values() }}), return the original call form
        return KeepTemplateUndefined(name=f"{self._undefined_name}()")

def protect_jinja_blocks(template_str):
    """ protect the {% %} tags to {{ '{%' }} and {{ '%}' }} to avoid Jinja2 parsing """
    protected = re.sub(
        r'(\{%-\s*.*?\s*%}|\{%\s*.*?\s*%})',
        lambda m: f"{{{{ '{m.group(0)}' }}}}",
        template_str
    )
    return protected

def fill_agent_prompt(duty,
                      constraint,
                      few_shots,
                      is_manager_agent=True):
    """
    use three parts to fill the system prompt
    """
    if is_manager_agent:
        prompt_file = 'backend/prompts/manager_system_prompt_template.yaml'
    else:
        prompt_file = 'backend/prompts/managed_system_prompt_template.yaml'
    with open(prompt_file, "r", encoding="utf-8") as file:
        manager_system_prompt_template = yaml.safe_load(file)
    protected_template = protect_jinja_blocks(manager_system_prompt_template["system_prompt"])
    compiled_template = Template(protected_template, undefined=KeepTemplateUndefined)

    system_prompt = compiled_template.render({
        "duty": duty,
        "constraint": constraint,
        "few_shots": few_shots
    })

    agent_prompt = {
        "system_prompt": system_prompt,
        "managed_agent": manager_system_prompt_template["managed_agent"]
    }

    return agent_prompt

def load_prompt_templates(path, is_manager_agent):
    with open(path, "r", encoding="utf-8") as f:
        agent_prompt = yaml.safe_load(f)
    return fill_agent_prompt(is_manager_agent=is_manager_agent, **agent_prompt)

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

def generate_system_prompt(prompt_info: GeneratePromptRequest):
    with open('backend/prompts/utils/prompt_generate.yaml', "r", encoding="utf-8") as f:
        prompt_for_generate = yaml.safe_load(f)
    tool_list = [get_tool_detail_information(tool) for tool in prompt_info.tool_list]

    task_description = prompt_info.task_description
    tool_description = "\n".join([str(tool) for tool in tool_list])
    agent_description = "\n".join([str(sub_agent) for sub_agent in prompt_info.sub_agent_list])

    compiled_template = Template(prompt_for_generate["USER_PROMPT"], undefined=StrictUndefined)
    content = compiled_template.render({
        "tool_description": tool_description,
        "agent_description": agent_description,
        "task_description":task_description
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
    agent_prompt = fill_agent_prompt(duty=duty_prompt,
                                      constraint=constraint_prompt,
                                      few_shots=few_shots_prompt,
                                      is_manager_agent=len(prompt_info.sub_agent_list)>0)
    need_filled_system_prompt = agent_prompt["system_prompt"]

    # fill the tool description and agent description
    system_prompt = populate_template(
        need_filled_system_prompt,
        variables={
            "tools": {tool.name: tool for tool in tool_list},
            "managed_agents": {sub_agent.name: sub_agent for sub_agent in prompt_info.sub_agent_list},
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

    regenerate_prompt = call_llm_for_system_prompt(user_prompt=content,
                                                  system_prompt=prompt_for_fine_tune["FINE_TUNE_SYSTEM_PROMPT"])
    return regenerate_prompt
