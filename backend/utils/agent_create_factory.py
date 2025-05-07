import json
import re
import logging
import yaml

from nexent.core.agents import CoreAgent
from nexent.core.models import OpenAIModel
from nexent.core.utils import MessageObserver
from nexent.core.tools import EXASearchTool, SummaryTool, KnowledgeBaseSearchTool # not remove

from utils.config_utils import config_manager

class AgentCreateFactory:
    def __init__(self, mcp_tool_collection, observer:MessageObserver):
        """
        init the agent create factory   
        
        Args:
            mcp_tool_collection: 
            observer: 
        """
        if config_manager is None:
            raise ValueError("must provide a ConfigManager instance")
            
        self.observer = observer
        self.models = {}
        self.mcp_tool_collection = mcp_tool_collection

    @staticmethod
    def _replace_env_vars(value):
        """replace the environment variables in the string"""
        if isinstance(value, str) and "${" in value:
            pattern = r'\${([^}]+)}'
            matches = re.findall(pattern, value)
            for match in matches:
                env_value = config_manager.get_config(match, "")
                value = value.replace(f"${{{match}}}", env_value)
                
            # 如果值看起来像是JSON数组，尝试解析它
            if value.startswith("[") and value.endswith("]"):
                try:
                    value = json.loads(value)
                except:
                    pass
        return value
    
    def _process_config_values(self, config):
        """recursively process all environment variables in the config"""
        if isinstance(config, dict):
            return {k: self._process_config_values(v) for k, v in config.items()}
        elif isinstance(config, list):
            return [self._process_config_values(item) for item in config]
        else:
            return self._replace_env_vars(config)
    
    def create_model(self, model_config):
        """create a model instance"""
        return OpenAIModel(
            observer=self.observer,
            model_id=model_config.get("model_id", ""),
            api_key=model_config.get("api_key", ""),
            api_base=model_config.get("api_base", ""),
            temperature=model_config.get("temperature", 0.1)
        )
    
    def create_tool(self, tool_config):
        """create a tool instance according to the tool config"""
        try:
            try:
                tool_name = tool_config.get("name")
                params = tool_config.get("params", {})
                source = tool_config.get("source")
                model_name = tool_config.get("model", None)
                if model_name is not None:
                    model = self.get_model(model_name)
                    params["model"] = model
            except Exception as e:
                print(f"Error in loading tool config: {e}")
        
            if source == "local":
                tool_class = globals().get(tool_name)
                if tool_class is None:
                    raise ValueError(f"{tool_name} not found in local")
                else:
                    tools_obj = tool_class(**params)
                    if hasattr(tools_obj, 'observer'):
                        tools_obj.observer = self.observer
            elif source == "mcp":
                tools_obj = None
                for tool in self.mcp_tool_collection.tools:
                    if tool.name == tool_name:
                        tools_obj = tool
                        break
                if tools_obj is None:
                    raise ValueError(f"{tool_name} not found in MCP server")

            else:
                raise ValueError(f"unsupported tool source: {source}")
            
            return tools_obj
        except Exception as e:
            print(f"Error in creating tool: {e}")
            return None

    @staticmethod
    def load_prompt_templates(path):
        """load the prompt templates"""
        if path:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return yaml.safe_load(f)
            except FileNotFoundError:
                print(f"warning: prompt template file {path} not found")
        return None

    def get_model(self, model_name):
        model = self.models.get(model_name, None)
        if model is None:
            print(f"Error: {model_name} is not found!")
        return model
    
    def create_from_json(self, json_config_path):
        """create an agent from a JSON file
        
        Args:
            json_config_path:
        """
        # 加载JSON配置
        with open(json_config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        
        # process the environment variables
        config = self._process_config_values(config)
        
        # create models
        for model_name, model_config in config.get("models", {}).items():
            self.models[model_name] = self.create_model(model_config)
        
        # create managed agents
        managed_agents = []
        for agent_config in config.get("managed_agents", []):
            agent = self.create_single_agent(agent_config=agent_config,
                                             managed_agents=[])
            managed_agents.append(agent)
        
        # create the main agent
        main_agent = self.create_single_agent(agent_config=config.get("main_agent"),
                                              managed_agents=managed_agents)
        return main_agent

    def create_single_agent(self, agent_config, managed_agents):
        # get the model
        model_name = agent_config.get("model")
        model = self.get_model(model_name)
        # load the prompt templates
        prompt_templates_path = agent_config.get("prompt_templates_path")
        prompt_templates = self.load_prompt_templates(prompt_templates_path)
        logging.info(f"prompt_templates: {prompt_templates_path}")
        tools = self.create_tools_list(agent_config)
        # create the agent
        agent = CoreAgent(
            observer=self.observer,
            tools=tools,
            model=model,
            name=agent_config.get("name"),
            description=agent_config.get("description", ""),
            max_steps=agent_config.get("max_steps", 5),
            prompt_templates=prompt_templates,
            provide_run_summary=agent_config.get("provide_run_summary", False),
            managed_agents=managed_agents
        )
        return agent

    def create_tools_list(self, main_config):
        # create tools
        tools = []
        for tool_config in main_config.get("tools", []):
            try:
                tools.append(self.create_tool(tool_config))
            except Exception as e:
                print(f"Error in create tools: {e}")
        return tools

