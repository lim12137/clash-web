import { GlobalConfig } from '@/types/config';
import { API_ENDPOINTS } from './api';
import { ConfigStore } from '@/lib/config';
import { getAuthHeaders } from '@/lib/auth';

export class ConfigService {
  // Save global configuration to backend
  async saveConfigToBackend(config: GlobalConfig): Promise<boolean> {
    try {
      const response = await fetch(API_ENDPOINTS.config.save, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('保存配置失败:', errorData);
        return false;
      }

      const result = await response.json();
      return true;
    } catch (error) {
      console.error('保存配置请求异常:', error);
      return false;
    }
  }

  // Add: Load configuration from backend and write to localStorage
  async loadConfigToFrontend(): Promise<boolean> {
    try {
      const response = await fetch(API_ENDPOINTS.config.load, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('加载配置失败:', errorData);
        return false;
      }
      const result = await response.json();
      const config = result.config;
      if (config) {
        // Use the conversion function of configStore
        const frontendConfig = ConfigStore.transformBackend2Frontend(config);

        // Write to localStorage separately
        if (frontendConfig.app) localStorage.setItem('app', JSON.stringify(frontendConfig.app));
        if (frontendConfig.models) localStorage.setItem('model', JSON.stringify(frontendConfig.models));
        return true;
      }
      return false;
    } catch (error) {
      console.error('加载配置请求异常:', error);
      return false;
    }
  }
}

// Export singleton instance
export const configService = new ConfigService(); 