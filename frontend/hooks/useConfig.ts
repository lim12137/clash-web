'use client';

import { useState, useEffect, useCallback } from 'react';
import { configStore } from '@/lib/config';
import type { GlobalConfig, AppConfig, ModelConfig, KnowledgeBaseConfig } from '@/types/config';
import { getAvatarUrl } from '@/lib/avatar';

export function useConfig() {
  const [config, setConfig] = useState<GlobalConfig>(() => configStore.getConfig());

  // 监听配置变更
  useEffect(() => {
    const handleConfigChange = (event: CustomEvent<{ config: GlobalConfig }>) => {
      setConfig(event.detail.config);
    };

    window.addEventListener('configChanged', handleConfigChange as EventListener);
    return () => {
      window.removeEventListener('configChanged', handleConfigChange as EventListener);
    };
  }, []);

  // 更新完整配置
  const updateConfig = useCallback((partial: Partial<GlobalConfig>) => {
    configStore.updateConfig(partial);
  }, []);

  // 更新应用配置
  const updateAppConfig = useCallback((partial: Partial<AppConfig>) => {
    configStore.updateAppConfig(partial);
  }, []);

  // 更新模型配置
  const updateModelConfig = useCallback((partial: Partial<ModelConfig>) => {
    configStore.updateModelConfig(partial);
  }, []);

  // 更新知识库配置
  const updateDataConfig = useCallback((partial: Partial<KnowledgeBaseConfig>) => {
    configStore.updateDataConfig(partial);
  }, []);


  // 获取头像URL
  const getAppAvatarUrl = useCallback((size: number = 30) => {
    return getAvatarUrl(config.app, size);
  }, [config.app]);

  return {
    config,
    updateConfig,
    updateAppConfig,
    updateModelConfig,
    updateDataConfig,
    // 便捷访问
    appConfig: config.app,
    modelConfig: config.models,
    dataConfig: config.data,
    // 头像相关功能
    getAppAvatarUrl
  };
} 