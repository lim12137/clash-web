import { Tool, convertParamType } from '@/types/agentAndToolConst';

/**
 * Get tool list from backend
 * @returns Converted tool list
 */
export const fetchTools = async () => {
  try {
    const response = await fetch('/api/tool/list');
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    const data = await response.json();
    
    // Convert backend Tool format to frontend Tool format
    const formattedTools = data.map((tool: Tool) => ({
      id: String(tool.tool_id),
      name: tool.name,
      description: tool.description,
      source: tool.source,
      initParams: tool.params.map(param => {
        return {
          name: param.name,
          type: convertParamType(param.type),
          required: !param.optional,
          value: param.default,
          description: param.description
        };
      })
    }));
    
    return {
      success: true,
      data: formattedTools,
      message: ''
    };
  } catch (error) {
    console.error('获取工具列表出错:', error);
    return {
      success: false,
      data: [],
      message: '获取工具列表失败，请稍后重试'
    };
  }
};

/**
 * Get agent list from backend
 * @returns Object containing main_agent_id and sub_agent_list
 */
export const fetchAgentList = async () => {
  try {
    const response = await fetch('/api/agent/list');
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    const data = await response.json();
    
    // Convert backend data to frontend format
    const formattedAgents = data.sub_agent_list.map((agent: any) => ({
      id: agent.agent_id,
      name: agent.name,
      description: agent.description,
      modelName: agent.model_name,
      max_step: agent.max_steps,
      prompt: agent.prompt,
      parentAgentId: agent.parent_agent_id,
      enabled: agent.enabled,
      createTime: agent.create_time,
      updateTime: agent.update_time,
      tools: agent.tools ? agent.tools.map((tool: any) => {
        console.log(tool)
        const params = typeof tool.params === 'string' ? JSON.parse(tool.params) : tool.params;
        return {
          id: tool.tool_instance_id,
          name: tool.name,
          description: tool.description,
          source: tool.source,
          initParams: Array.isArray(params) ? params.map((param: any) => ({
            name: param.name,
            type: convertParamType(param.type),
            required: !param.optional,
            value: param.default,
            description: param.description
          })) : []
        };
      }) : [],
      provide_run_summary: agent.provide_run_summary
    }));
    
    return {
      success: true,
      data: {
        mainAgentId: data.main_agent_id,
        subAgentList: formattedAgents
      },
      message: ''
    };
  } catch (error) {
    console.error('获取 agent 列表失败:', error);
    return {
      success: false,
      data: {
        mainAgentId: null,
        subAgentList: []
      },
      message: '获取 agent 列表失败，请稍后重试'
    };
  }
};
