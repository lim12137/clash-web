from typing import List

from threading import Event
from .agent_const import ModelConfig, ToolConfig, AgentConfig
from ..utils.observer import MessageObserver
from ..models.openai_llm import OpenAIModel
from .code_agent import CoreAgent
from ..tools import (
    EXASearchTool,
    KnowledgeBaseSearchTool,
    SummaryTool,
    SendEmailTool,
    GetEmailTool)           # Used for tool creation, do not delete!!!


class AgentCreateFactory:
    def __init__(self, observer: MessageObserver,
                 model_config_list: List[ModelConfig],
                 stop_event: Event,
                 mcp_tool_collection=None):
        """
        init the agent create factory

        Args:
            mcp_tool_collection:
            observer:
            model_config_list:
        """
        if not isinstance(observer, MessageObserver):
            raise TypeError("Create Observer Object with MessageObserver")

        self.observer = observer
        self.model_config_list = model_config_list
        self.stop_event = stop_event
        self.mcp_tool_collection = mcp_tool_collection


    def create_model(self, model_cite_name: str):
        """create a model instance"""
        model_config = next(model_config for model_config in self.model_config_list if model_config.cite_name == model_cite_name)
        if model_config is None:
            raise ValueError(f"Model {model_cite_name} not found")
        model = OpenAIModel(
            observer=self.observer,
            model_id=model_config.model_name,
            api_key=model_config.api_key,
            api_base=model_config.url,
            temperature=model_config.temperature,
            top_p=model_config.top_p
        )
        model.stop_event = self.stop_event
        return model

    def create_local_tool(self, tool_config: ToolConfig):
        class_name = tool_config.class_name
        params = tool_config.params
        tool_class = globals().get(class_name)
        if tool_class is None:
            raise ValueError(f"{class_name} not found in local")
        else:
            tools_obj = tool_class(**params)
            if hasattr(tools_obj, 'observer'):
                tools_obj.observer = self.observer

            if class_name == "KnowledgeBaseSearchTool":
                tools_obj.update_search_index_names(tool_config.metadata.get("index_names", []))
            return tools_obj

    def create_mcp_tool(self, class_name):
        if self.mcp_tool_collection is None:
            raise ValueError("MCP tool collection is not initialized")
        tool_obj = next(
            (tool for tool in self.mcp_tool_collection.tools if tool.name == class_name),
            None
        )
        if tool_obj is None:
            raise ValueError(f"{class_name} not found in MCP server")
        return tool_obj

    def create_tool(self, tool_config: ToolConfig):
        """create a tool instance according to the tool config"""
        if not isinstance(tool_config, ToolConfig):
            raise TypeError("tool_config must be a ToolConfig object")
        try:
            class_name = tool_config.class_name
            source = tool_config.source

            if source == "local":
                tool_obj = self.create_local_tool(tool_config)
            elif source == "mcp":
                tool_obj = self.create_mcp_tool(class_name)
            else:
                raise ValueError(f"unsupported tool source: {source}")
            return tool_obj
        except Exception as e:
            raise ValueError(f"Error in creating tool: {e}")

    def create_single_agent(self, agent_config: AgentConfig):
        if not isinstance(agent_config, AgentConfig):
            raise TypeError("agent_config must be a AgentConfig object")

        try:
            model = self.create_model(agent_config.model_name)
            prompt_templates = agent_config.prompt_templates

            try:
                tool_list = [self.create_tool(tool_config) for tool_config in agent_config.tools]
            except Exception as e:
                raise ValueError(f"Error in creating tool: {e}")

            try:
                managed_agents_list = [self.create_single_agent(agent_config) for agent_config in agent_config.managed_agents]
            except Exception as e:
                raise ValueError(f"Error in creating managed agent: {e}")

            # create the agent
            agent = CoreAgent(
                observer=self.observer,
                tools=tool_list,
                model=model,
                name=agent_config.name,
                description=agent_config.description,
                max_steps=agent_config.max_steps,
                prompt_templates=prompt_templates,
                provide_run_summary=agent_config.provide_run_summary,
                managed_agents=managed_agents_list
            )
            agent.stop_event = self.stop_event
            return agent
        except Exception as e:
            raise ValueError(f"Error in creating agent, agent name: {agent_config.name}, Error: {e}")
