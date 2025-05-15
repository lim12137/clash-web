import { Tool, convertParamType } from '@/types/agentAndToolConst';

/**
 * 从后端获取工具列表
 * @returns 转换后的工具列表
 */
export const fetchTools = async () => {
  try {
    const response = await fetch('/api/tool/search');
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    const data = await response.json();
    
    // 将后端Tool格式转换为前端需要的Tool格式
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
