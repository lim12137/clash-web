'use client';

import { GlobalConfig, AppConfig, ModelConfig, KnowledgeBaseConfig, APP_CONFIG_KEY, MODEL_CONFIG_KEY, DATA_CONFIG_KEY, defaultConfig } from '../types/config';

export class ConfigStore {
  private static instance: ConfigStore;
  private config: GlobalConfig;

  private constructor() {
    this.config = this.loadFromStorage();
  }

  static getInstance(): ConfigStore {
    if (!ConfigStore.instance) {
      ConfigStore.instance = new ConfigStore();
    }
    return ConfigStore.instance;
  }

  // 深度合并配置
  private deepMerge<T>(target: T, source: Partial<T>): T {
    if (!source) return target;
    
    const result = { ...target } as T;
    
    Object.keys(source).forEach(key => {
      const targetValue = (target as any)[key];
      const sourceValue = (source as any)[key];
      
      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        (result as any)[key] = this.deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        (result as any)[key] = sourceValue;
      }
    });
    
    return result;
  }

  // 从存储加载配置
  private loadFromStorage(): GlobalConfig {
    try {
      if (typeof window === 'undefined') {
        return defaultConfig;
      }

      // 从各个独立的存储键中加载配置
      const storedAppConfig = localStorage.getItem(APP_CONFIG_KEY);
      const storedModelConfig = localStorage.getItem(MODEL_CONFIG_KEY);
      const storedDataConfig = localStorage.getItem(DATA_CONFIG_KEY);
      
      // 创建合并配置对象
      const mergedConfig: Partial<GlobalConfig> = {};
      
      // 如果存在应用配置，则解析并合并
      if (storedAppConfig) {
        try {
          mergedConfig.app = JSON.parse(storedAppConfig);
        } catch (e) {
          console.error("解析应用配置失败:", e);
        }
      }
      
      // 如果存在模型配置，则解析并合并
      if (storedModelConfig) {
        try {
          mergedConfig.models = JSON.parse(storedModelConfig);
        } catch (e) {
          console.error("解析模型配置失败:", e);
        }
      }
      
      // 如果存在数据配置，则解析并合并
      if (storedDataConfig) {
        try {
          mergedConfig.data = JSON.parse(storedDataConfig);
        } catch (e) {
          console.error("解析数据配置失败:", e);
        }
      }
      
      // 兼容旧版配置 - 如果没有找到新的分离配置，尝试从旧的统一配置中加载
      if (!storedAppConfig && !storedModelConfig && !storedDataConfig) {
        const oldConfig = localStorage.getItem('app_config');
        if (oldConfig) {
          try {
            const parsedOldConfig = JSON.parse(oldConfig);
            // 迁移旧配置到新的键中
            if (parsedOldConfig.app) localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(parsedOldConfig.app));
            if (parsedOldConfig.models) localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(parsedOldConfig.models));
            if (parsedOldConfig.data) localStorage.setItem(DATA_CONFIG_KEY, JSON.stringify(parsedOldConfig.data));
            // 合并旧配置
            return this.deepMerge(defaultConfig, parsedOldConfig);
          } catch (e) {
            console.error("解析旧配置失败:", e);
          }
        }
      }

      // 将加载的配置与默认配置深度合并
      return this.deepMerge(defaultConfig, mergedConfig);
    } catch (error) {
      console.error("加载配置失败:", error);
      return defaultConfig;
    }
  }

  // 保存配置到存储
  private saveToStorage(): void {
    try {
      if (typeof window === 'undefined') return;
      
      // 分别保存各个配置到对应的存储键中
      localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(this.config.app));
      localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(this.config.models));
      localStorage.setItem(DATA_CONFIG_KEY, JSON.stringify(this.config.data));
      
      // 触发配置更新事件
      window.dispatchEvent(new CustomEvent('configChanged', { 
        detail: { config: this.config } 
      }));
    } catch (error) {
      console.error("保存配置失败:", error);
    }
  }

  // 获取完整配置
  getConfig(): GlobalConfig {
    return this.config;
  }

  // 更新完整配置
  updateConfig(partial: Partial<GlobalConfig>): void {
    this.config = this.deepMerge(this.config, partial);
    this.saveToStorage();
  }

  // 获取应用配置
  getAppConfig(): AppConfig {
    return this.config.app;
  }

  // 更新应用配置
  updateAppConfig(partial: Partial<AppConfig>): void {
    this.config.app = this.deepMerge(this.config.app, partial);
    this.saveToStorage();
  }

  // 获取模型配置
  getModelConfig(): ModelConfig {
    return this.config.models;
  }

  // 更新模型配置
  updateModelConfig(partial: Partial<ModelConfig>): void {
    this.config.models = this.deepMerge(this.config.models, partial);
    this.saveToStorage();
  }

  // 获取知识库配置
  getDataConfig(): KnowledgeBaseConfig {
    return this.config.data;
  }

  // 更新知识库配置
  updateDataConfig(partial: Partial<KnowledgeBaseConfig>): void {
    this.config.data = this.deepMerge(this.config.data, partial);
    this.saveToStorage();
  }
  
  // 清除所有配置
  clearAllConfig(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(APP_CONFIG_KEY);
    localStorage.removeItem(MODEL_CONFIG_KEY);
    localStorage.removeItem(DATA_CONFIG_KEY);
    
    // 同时清除旧版配置键
    localStorage.removeItem('app_config');
    
    // 重置为默认配置
    this.config = {...defaultConfig};
    
    // 触发配置更新事件
    window.dispatchEvent(new CustomEvent('configChanged', { 
      detail: { config: this.config } 
    }));
  }

  // 新增：后端配置转前端localStorage结构
  static transformBackend2Frontend(backendConfig: any): GlobalConfig {
    // 适配 app 字段
    const app = backendConfig.app
      ? {
          appName: backendConfig.app.name,
          appDescription: backendConfig.app.description,
          iconType: backendConfig.app.icon?.type,
          customIconUrl: backendConfig.app.icon?.customUrl,
          avatarUri: backendConfig.app.icon?.avatarUri || null
        }
      : undefined;

    // 适配 models 字段
    const models = backendConfig.models ? {
      llm: {
        modelName: backendConfig.models.llm?.modelName || "",
        displayName: backendConfig.models.llm?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.llm?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.llm?.apiConfig?.modelUrl || ""
        }
      },
      llmSecondary: {
        modelName: backendConfig.models.llmSecondary?.modelName || "",
        displayName: backendConfig.models.llmSecondary?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.llmSecondary?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.llmSecondary?.apiConfig?.modelUrl || ""
        }
      },
      embedding: {
        modelName: backendConfig.models.embedding?.modelName || "",
        displayName: backendConfig.models.embedding?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.embedding?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.embedding?.apiConfig?.modelUrl || ""
        },
        dimension: backendConfig.models.embedding?.dimension || 0
      },
      multiEmbedding: {
        modelName: backendConfig.models.multiEmbedding?.modelName || "",
        displayName: backendConfig.models.multiEmbedding?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.multiEmbedding?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.multiEmbedding?.apiConfig?.modelUrl || ""
        },
        dimension: backendConfig.models.multiEmbedding?.dimension || 0
      },
      rerank: {
        modelName: backendConfig.models.rerank?.modelName || "",
        displayName: backendConfig.models.rerank?.displayName || ""
      },
      vlm: {
        modelName: backendConfig.models.vlm?.modelName || "",
        displayName: backendConfig.models.vlm?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.vlm?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.vlm?.apiConfig?.modelUrl || ""
        }
      },
      stt: {
        modelName: backendConfig.models.stt?.modelName || "",
        displayName: backendConfig.models.stt?.displayName || ""
      },
      tts: {
        modelName: backendConfig.models.tts?.modelName || "",
        displayName: backendConfig.models.tts?.displayName || ""
      }
    } : undefined;

    // 适配 data 字段
    const data = backendConfig.data ? {
      selectedKbNames: backendConfig.data.selectedKbNames || [],
      selectedKbModels: backendConfig.data.selectedKbModels || [],
      selectedKbSources: backendConfig.data.selectedKbSources || []
    } : undefined;

    return {
      app,
      models,
      data,
    } as GlobalConfig;
  }
}

// 导出单例
export const configStore = ConfigStore.getInstance(); 