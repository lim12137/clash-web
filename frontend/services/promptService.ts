import { API_ENDPOINTS } from './api';

/**
 * 提示词生成请求参数
 */
export interface GeneratePromptParams {
  agent_id: number;
  task_description: string;
}

/**
 * 提示词微调请求参数
 */
export interface FineTunePromptParams {
  system_prompt: string;
  command: string;
}

/**
 * 保存提示词请求参数
 */
export interface SavePromptParams {
  agent_id: number;
  prompt: string;
}

/**
 * 获取请求头
 */
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'AgentFrontEnd/1.0',
  };
};

/**
 * 生成系统提示词
 * @param params 请求参数
 * @param savePrompt 是否保存提示词
 * @returns 生成的提示词
 */
export const generatePrompt = async (params: GeneratePromptParams, savePrompt: boolean = false): Promise<string> => {
  try {
    const response = await fetch(`${API_ENDPOINTS.prompt.generate}?save_prompt=${savePrompt}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '生成提示词失败');
    }

    const data = await response.json();
    return data.data || '';
  } catch (error) {
    console.error('生成提示词失败:', error);
    throw error;
  }
};

/**
 * 微调系统提示词
 * @param params 请求参数
 * @returns 微调后的提示词
 */
export const fineTunePrompt = async (params: FineTunePromptParams): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.prompt.fineTune, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '微调提示词失败');
    }

    const data = await response.json();
    return data.data || '';
  } catch (error) {
    console.error('微调提示词失败:', error);
    throw error;
  }
};

/**
 * 保存系统提示词
 * @param params 请求参数
 * @returns 保存结果
 */
export const savePrompt = async (params: SavePromptParams): Promise<any> => {
  try {
    const response = await fetch(API_ENDPOINTS.prompt.save, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '保存提示词失败');
    }

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('保存提示词失败:', error);
    throw error;
  }
}; 