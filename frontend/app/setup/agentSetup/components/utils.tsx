import { Agent, Tool } from '../ConstInterface';

// 模拟服务函数
export const generateSystemPrompt = async (
  businessLogic: string, 
  selectedAgents: Agent[], 
  selectedTools: Tool[]
): Promise<string> => {
  // 这里是模拟实现，实际项目中应导入真实服务
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`你是一个智能AI助手，专门负责${businessLogic || '通用任务'}。
你应该始终保持友好和专业的态度，提供准确的信息和有用的建议。

${selectedAgents.length > 0 ? `你可以调用以下子代理辅助你的工作：
${selectedAgents.map(agent => `- ${agent.name}：${agent.description}`).join('\n')}

` : ''}根据用户的需求，你可以使用以下工具来辅助你的回答：
${selectedTools.map(tool => `- ${tool.name}：${tool.description}`).join('\n')}

请始终在能力范围内回答问题，如果不确定，请说明你不知道。`);
    }, 1500);
  });
}; 