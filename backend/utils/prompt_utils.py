import re

import yaml
from jinja2 import Undefined, Template


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


def load_prompt_templates(path, is_manager_agent, system_prompt=None):
    with open(path, "r", encoding="utf-8") as f:
        agent_prompt = yaml.safe_load(f)
    if system_prompt:
        agent_prompt["system_prompt"] = system_prompt
    return fill_agent_prompt(is_manager_agent=is_manager_agent, **agent_prompt)


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


def protect_jinja_blocks(template_str):
    """ protect the {% %} tags to {{ '{%' }} and {{ '%}' }} to avoid Jinja2 parsing """
    protected = re.sub(
        r'(\{%-\s*.*?\s*%}|\{%\s*.*?\s*%})',
        lambda m: f"{{{{ '{m.group(0)}' }}}}",
        template_str
    )
    return protected
