"use client"

import { ModelOption, ModelType, SingleModelConfig, ModelConnectStatus } from '../types/config'
import { API_ENDPOINTS } from './api'

// API响应类型
interface ApiResponse<T = any> {
  code: number
  message?: string
  data?: T
}

// 错误类
export class ModelError extends Error {
  constructor(message: string, public code?: number) {
    super(message)
    this.name = 'ModelError'
    // 重写 stack 属性，使其只返回消息
    Object.defineProperty(this, 'stack', {
      get: function() {
        return this.message
      }
    })
  }

  // 重写 toString 方法，使其只返回消息
  toString() {
    return this.message
  }
}

// 获取授权头的辅助函数
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

// 模型服务
export const modelService = {
  // 获取官方模型列表
  getOfficialModels: async (): Promise<ModelOption[]> => {
    try {
      const response = await fetch(API_ENDPOINTS.modelEngine.officialModelList, {
        headers: getHeaders()
      })
      const result: ApiResponse<any[]> = await response.json()
      
      if (result.code === 200 && result.data) {
        const modelOptions: ModelOption[] = []
        const typeMap: Record<string, ModelType> = {
          embed: "embedding",
          chat: "llm",
          asr: "stt",
          tts: "tts",
          rerank: "rerank",
          vlm: "vlm"
        }

        for (const model of result.data) {
          if (typeMap[model.type]) {
            modelOptions.push({
              name: model.id,
              type: typeMap[model.type],
              maxTokens: 0,
              source: "official",
              apiKey: model.api_key,
              apiUrl: model.base_url,
              displayName: model.id
            })
          }
        }

        return modelOptions
      }
      // If API call was not successful, return empty array
      return []
    } catch (error) {
      // In case of any error, return empty array
      console.warn('Failed to load official models:', error)
      return []
    }
  },

  // 获取自定义模型列表
  getCustomModels: async (): Promise<ModelOption[]> => {
    try {
      const response = await fetch(API_ENDPOINTS.modelEngine.customModelList, {
        headers: getHeaders()
      })
      const result: ApiResponse<any[]> = await response.json()
      
      if (result.code === 200 && result.data) {
        return result.data.map(model => ({
          name: model.model_name,
          type: model.model_type as ModelType,
          maxTokens: model.max_tokens || 0,
          source: "custom",
          apiKey: model.api_key,
          apiUrl: model.base_url,
          displayName: model.display_name || model.model_name,
          connect_status: model.connect_status as ModelConnectStatus || "未检测"
        }))
      }
      // If API call was not successful, return empty array
      console.warn('Failed to load custom models:', result.message || 'Unknown error')
      return []
    } catch (error) {
      // In case of any error, return empty array
      console.warn('Failed to load custom models:', error)
      return []
    }
  },

  // 添加自定义模型
  addCustomModel: async (model: {
    name: string
    type: ModelType
    url: string
    apiKey?: string
    maxTokens: number
    displayName?: string
  }): Promise<void> => {
    try {
      const response = await fetch(API_ENDPOINTS.modelEngine.customModelCreate, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model_repo: "",
          model_name: model.name,
          model_type: model.type,
          base_url: model.url,
          api_key: model.apiKey,
          max_tokens: model.maxTokens,
          display_name: model.displayName
        })
      })
      
      const result: ApiResponse = await response.json()
      
      if (result.code !== 200) {
        throw new ModelError(result.message || '添加自定义模型失败', result.code)
      }
    } catch (error) {
      if (error instanceof ModelError) throw error
      throw new ModelError('添加自定义模型失败', 500)
    }
  },

  // 删除自定义模型
  deleteCustomModel: async (modelName: string): Promise<void> => {
    try {
      // 获取本地会话信息
      const response = await fetch(API_ENDPOINTS.modelEngine.customModelDelete, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model_name: modelName
        })
      })
      
      const result: ApiResponse = await response.json()
      
      if (result.code !== 200) {
        throw new ModelError(result.message || '删除自定义模型失败', result.code)
      }
    } catch (error) {
      if (error instanceof ModelError) throw error
      throw new ModelError('删除自定义模型失败', 500)
    }
  },

  // 验证模型连接状态
  verifyModel: async (modelConfig: SingleModelConfig): Promise<boolean> => {
    try {
      if (!modelConfig.modelName) return false

      // 先获取官方和自定义模型列表
      const [officialModels, customModels] = await Promise.all([
        modelService.getOfficialModels(),
        modelService.getCustomModels()
      ])

      // 判断模型是否在官方模型列表中
      const isOfficialModel = officialModels.some(model => model.name === modelConfig.modelName)

      // 根据模型来源选择不同的验证接口
      const endpoint = isOfficialModel 
        ? API_ENDPOINTS.modelEngine.officialModelHealthcheck(modelConfig.modelName, 2)
        : API_ENDPOINTS.modelEngine.customModelHealthcheck(modelConfig.modelName)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          ...(modelConfig.apiConfig?.apiKey && { 'X-API-KEY': modelConfig.apiConfig.apiKey })
        },
        body: modelConfig.apiConfig ? JSON.stringify({
          model_url: modelConfig.apiConfig.modelUrl
        }) : undefined
      })
      
      const result: ApiResponse<{connectivity: boolean}> = await response.json()
      
      if (result.code === 200 && result.data) {
        return result.data.connectivity
      }
      return false
    } catch (error) {
      return false
    }
  },

  // 验证自定义模型连接
  verifyCustomModel: async (modelName: string, signal?: AbortSignal): Promise<boolean> => {
    try {
      if (!modelName) return false

      // 调用健康检查API
      const response = await fetch(API_ENDPOINTS.modelEngine.customModelHealthcheck(modelName), {
        method: "GET",
        headers: getHeaders(),
        signal // 使用AbortSignal，如果提供的话
      })
      
      const result: ApiResponse<{connectivity: boolean}> = await response.json()
      
      if (result.code === 200 && result.data) {
        return result.data.connectivity
      }
      return false
    } catch (error) {
      // 检查是否是因为请求被取消
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`验证模型 ${modelName} 连接被取消`);
        // 重新抛出中止错误，让调用者知道请求被取消
        throw error;
      }
      console.error(`验证模型 ${modelName} 连接失败:`, error)
      return false
    }
  },

  // 更新模型状态到后端
  updateModelStatus: async (modelName: string, status: string): Promise<boolean> => {
    try {
      if (!modelName) {
        console.error('尝试更新状态时模型名为空');
        return false;
      }
      
      const response = await fetch(API_ENDPOINTS.modelEngine.updateConnectStatus, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          model_name: modelName,
          connect_status: status
        })
      });
      
      // 检查HTTP状态码
      if (!response.ok) {
        console.error(`更新模型状态HTTP错误，状态码: ${response.status}`);
        return false;
      }
      
      const result: ApiResponse = await response.json();
      
      if (result.code !== 200) {
        console.error('同步模型状态到数据库失败:', result.message);
        return false;
      } else {
        return true;
      }
    } catch (error) {
      console.error('同步模型状态到数据库出错:', error);
      return false;
    }
  },

  // 同步模型列表
  syncModels: async (): Promise<void> => {
    try {
      // 尝试同步官方模型，但失败不中断流程
      try {
        const officialResponse = await fetch(API_ENDPOINTS.modelEngine.officialModelList, {
          method: 'GET',
          headers: getHeaders()
        });
        
        const officialResult: ApiResponse = await officialResponse.json();
        
        if (officialResult.code !== 200) {
          console.error('同步ModelEngine模型失败:', officialResult.message || '未知错误');
        }
      } catch (officialError) {
        console.error('同步ModelEngine模型时发生错误:', officialError);
      }
      
      // 同步自定义模型，必须成功，否则抛出错误
      const customResponse = await fetch(API_ENDPOINTS.modelEngine.customModelList, {
        method: 'GET',
        headers: getHeaders()
      });
      
      const customResult: ApiResponse = await customResponse.json();
      
      if (customResult.code !== 200) {
        throw new ModelError(customResult.message || '同步自定义模型失败', customResult.code);
      }
      
    } catch (error) {
      if (error instanceof ModelError) throw error;
      throw new ModelError('同步模型失败', 500);
    }
  },

  // 将ModelOption转换为SingleModelConfig
  convertToSingleModelConfig: (modelOption: ModelOption): SingleModelConfig => {
    return {
      modelName: modelOption.name,
      displayName: modelOption.displayName || modelOption.name,
      apiConfig: modelOption.apiKey ? {
        apiKey: modelOption.apiKey,
        modelUrl: modelOption.apiUrl || '',
      } : undefined
    }
  }
} 