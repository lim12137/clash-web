import { API_ENDPOINTS } from './api';
import { fetchWithAuth, getAuthHeaders } from '@/lib/auth';
// @ts-ignore
const fetch = fetchWithAuth;

// 用户选中的知识库配置类型
export interface UserKnowledgeConfig {
  selectedKbNames: string[];
  selectedKbModels: string[];
  selectedKbSources: string[];
}


export class UserConfigService {
  // 获取用户选中的知识库列表
  async loadKnowledgeList(): Promise<UserKnowledgeConfig | null> {
    console.log('🔄 调用 loadKnowledgeList 接口...');
    try {
      const response = await fetch(API_ENDPOINTS.tenantConfig.loadKnowledgeList, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('加载用户知识库配置失败:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('📥 loadKnowledgeList 响应:', result);
      if (result.status === 'success') {
        return result.content;
      }
      return null;
    } catch (error) {
      console.error('加载用户知识库配置请求异常:', error);
      return null;
    }
  }

  // 更新用户选中的知识库列表
  async updateKnowledgeList(knowledgeList: string[]): Promise<boolean> {
    console.log('💾 调用 updateKnowledgeList 接口，数据:', knowledgeList);
    try {
      const response = await fetch(API_ENDPOINTS.tenantConfig.updateKnowledgeList, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ knowledge_list: knowledgeList }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('更新用户知识库配置失败:', errorData);
        return false;
      }

      const result = await response.json();
      console.log('📤 updateKnowledgeList 响应:', result);
      return result.status === 'success';
    } catch (error) {
      console.error('更新用户知识库配置请求异常:', error);
      return false;
    }
  }
}

// 导出单例实例
export const userConfigService = new UserConfigService(); 