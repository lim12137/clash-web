'use client';

import { GlobalConfig, AppConfig, ModelConfig, APP_CONFIG_KEY, MODEL_CONFIG_KEY, defaultConfig } from '../types/config';

class ConfigStoreClass {
  private static instance: ConfigStoreClass | null = null;
  private config: GlobalConfig | null = null;

  private constructor() {
    // Bind all methods to ensure 'this' context is preserved
    this.getConfig = this.getConfig.bind(this);
    this.updateConfig = this.updateConfig.bind(this);
    this.getAppConfig = this.getAppConfig.bind(this);
    this.updateAppConfig = this.updateAppConfig.bind(this);
    this.getModelConfig = this.getModelConfig.bind(this);
    this.updateModelConfig = this.updateModelConfig.bind(this);
    this.clearConfig = this.clearConfig.bind(this);
    this.reloadFromStorage = this.reloadFromStorage.bind(this);
    
    // Initialize config
    this.initializeConfig();
  }

  static getInstance(): ConfigStoreClass {
    if (!ConfigStoreClass.instance) {
      ConfigStoreClass.instance = new ConfigStoreClass();
    }
    return ConfigStoreClass.instance;
  }

  private initializeConfig(): void {
    try {
      this.config = this.loadFromStorage();
    } catch (error) {
      console.error('Failed to initialize config:', error);
      this.config = JSON.parse(JSON.stringify(defaultConfig));
    }
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
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        return JSON.parse(JSON.stringify(defaultConfig));
      }

      const storedAppConfig = localStorage.getItem(APP_CONFIG_KEY);
      const storedModelConfig = localStorage.getItem(MODEL_CONFIG_KEY);

      // Start with default configuration
      let mergedConfig: GlobalConfig = JSON.parse(JSON.stringify(defaultConfig));

      // Check for old configuration format and migrate if found
      const oldConfig = localStorage.getItem('config');
      if (oldConfig) {
        try {
          const parsedOldConfig = JSON.parse(oldConfig);
          // Migrate old config to new format
          if (parsedOldConfig.app) localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(parsedOldConfig.app));
          if (parsedOldConfig.models) localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(parsedOldConfig.models));
          
          // Remove old config
          localStorage.removeItem('config');
        } catch (error) {
          console.error('Failed to migrate old config:', error);
        }
      }

      // Override with stored configuration
      if (storedAppConfig) {
        try {
          mergedConfig.app = JSON.parse(storedAppConfig);
        } catch (error) {
          console.error('Failed to parse app config:', error);
        }
      }

      if (storedModelConfig) {
        try {
          mergedConfig.models = JSON.parse(storedModelConfig);
        } catch (error) {
          console.error('Failed to parse model config:', error);
        }
      }

      return mergedConfig;
    } catch (error) {
      console.error('Failed to load config from storage:', error);
      return JSON.parse(JSON.stringify(defaultConfig));
    }
  }

  // 保存配置到存储
  private saveToStorage(): void {
    try {
      if (typeof window === 'undefined' || !this.config) return;
      
      localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(this.config.app));
      localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(this.config.models));
    } catch (error) {
      console.error('Failed to save config to storage:', error);
    }
  }

  // 确保配置已初始化
  private ensureConfig(): void {
    if (!this.config) {
      this.initializeConfig();
    }
  }

  // 获取完整配置
  getConfig(): GlobalConfig {
    this.ensureConfig();
    return this.config!;
  }

  // 更新完整配置
  updateConfig(partial: Partial<GlobalConfig>): void {
    this.ensureConfig();
    this.config = this.deepMerge(this.config!, partial);
    this.saveToStorage();
  }

  // 获取应用配置
  getAppConfig(): AppConfig {
    this.ensureConfig();
    return this.config!.app;
  }

  // 更新应用配置
  updateAppConfig(partial: Partial<AppConfig>): void {
    this.ensureConfig();
    this.config!.app = this.deepMerge(this.config!.app, partial);
    this.saveToStorage();
  }

  // 获取模型配置
  getModelConfig(): ModelConfig {
    this.ensureConfig();
    return this.config!.models;
  }

  // 更新模型配置
  updateModelConfig(partial: Partial<ModelConfig>): void {
    this.ensureConfig();
    this.config!.models = this.deepMerge(this.config!.models, partial);
    this.saveToStorage();
  }

  // 清除所有配置
  clearConfig(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(APP_CONFIG_KEY);
      localStorage.removeItem(MODEL_CONFIG_KEY);
    }
    this.config = JSON.parse(JSON.stringify(defaultConfig));
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
        modelName: backendConfig.models.llm?.name || "",
        displayName: backendConfig.models.llm?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.llm?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.llm?.apiConfig?.modelUrl || ""
        }
      },
      llmSecondary: {
        modelName: backendConfig.models.llmSecondary?.name || "",
        displayName: backendConfig.models.llmSecondary?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.llmSecondary?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.llmSecondary?.apiConfig?.modelUrl || ""
        }
      },
      embedding: {
        modelName: backendConfig.models.embedding?.name || "",
        displayName: backendConfig.models.embedding?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.embedding?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.embedding?.apiConfig?.modelUrl || ""
        },
        dimension: backendConfig.models.embedding?.dimension || 0
      },
      multiEmbedding: {
        modelName: backendConfig.models.multiEmbedding?.name || "",
        displayName: backendConfig.models.multiEmbedding?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.multiEmbedding?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.multiEmbedding?.apiConfig?.modelUrl || ""
        },
        dimension: backendConfig.models.multiEmbedding?.dimension || 0
      },
      rerank: {
        modelName: backendConfig.models.rerank?.name || "",
        displayName: backendConfig.models.rerank?.displayName || ""
      },
      vlm: {
        modelName: backendConfig.models.vlm?.name || "",
        displayName: backendConfig.models.vlm?.displayName || "",
        apiConfig: {
          apiKey: backendConfig.models.vlm?.apiConfig?.apiKey || "",
          modelUrl: backendConfig.models.vlm?.apiConfig?.modelUrl || ""
        }
      },
      stt: {
        modelName: backendConfig.models.stt?.name || "",
        displayName: backendConfig.models.stt?.displayName || ""
      },
      tts: {
        modelName: backendConfig.models.tts?.name || "",
        displayName: backendConfig.models.tts?.displayName || ""
      }
    } : undefined;

    return {
      app,
      models,
    } as GlobalConfig;
  }

  // 新增：从localStorage重新加载配置并触发configChanged事件
  reloadFromStorage(): void {
    this.config = this.loadFromStorage();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('configChanged', {
        detail: { config: this.config }
      }));
    }
  }
}

// 导出类作为 ConfigStore
export const ConfigStore = ConfigStoreClass;

// 导出单例
export const configStore = ConfigStoreClass.getInstance(); 