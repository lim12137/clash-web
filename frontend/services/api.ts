import { STATUS_CODES } from "@/types/auth";

const API_BASE_URL = '/api';
const UPLOAD_SERVICE_URL = '/api/file';

export const API_ENDPOINTS = {
  user: {
    signup: `${API_BASE_URL}/user/signup`,
    signin: `${API_BASE_URL}/user/signin`,
    refreshToken: `${API_BASE_URL}/user/refresh_token`,
    logout: `${API_BASE_URL}/user/logout`,
    session: `${API_BASE_URL}/user/session`,
    currentUserId: `${API_BASE_URL}/user/current_user_id`,
    serviceHealth: `${API_BASE_URL}/user/service_health`,
  },
  conversation: {
    list: `${API_BASE_URL}/conversation/list`,
    create: `${API_BASE_URL}/conversation/create`,
    save: `${API_BASE_URL}/conversation/save`,
    rename: `${API_BASE_URL}/conversation/rename`,
    detail: (id: number) => `${API_BASE_URL}/conversation/${id}`,
    delete: (id: number) => `${API_BASE_URL}/conversation/${id}`,
    generateTitle: `${API_BASE_URL}/conversation/generate_title`,
    sources: `${API_BASE_URL}/conversation/sources`,
    opinion: `${API_BASE_URL}/conversation/message/update_opinion`,
  },
  agent: {
    run: `${API_BASE_URL}/agent/run`,
  },
  stt: {
    ws: `/api/voice/stt/ws`,
  },
  tts: {
    ws: `/api/voice/tts/ws`,
  },
  storage: {
    upload: `${UPLOAD_SERVICE_URL}/storage`,
    files: `${UPLOAD_SERVICE_URL}/storage`,
    file: (objectName: string) => `${UPLOAD_SERVICE_URL}/storage/${objectName}`,
    delete: (objectName: string) => `${UPLOAD_SERVICE_URL}/storage/${objectName}`,
    preprocess: `${UPLOAD_SERVICE_URL}/preprocess`,
  },
  proxy: {
    image: (url: string) => `${API_BASE_URL}/proxy/image?url=${encodeURIComponent(url)}`,
  },
  modelEngine: {
    // 基本健康检查
    healthcheck: `${API_BASE_URL}/me/healthcheck`,
    
    // 官方模型服务
    officialModelList: `${API_BASE_URL}/me/model/list`,
    officialModelHealthcheck: (modelName: string, timeout: number = 2) => 
      `${API_BASE_URL}/me/model/healthcheck?model_name=${encodeURIComponent(modelName)}&timeout=${timeout}`,
      
    // 自定义模型服务
    customModelList: `${API_BASE_URL}/model/list`,
    customModelCreate: `${API_BASE_URL}/model/create`,
    customModelDelete: `${API_BASE_URL}/model/delete`,
    customModelHealthcheck: (modelName: string) => 
      `${API_BASE_URL}/model/healthcheck?model_name=${encodeURIComponent(modelName)}`,
    updateConnectStatus: `${API_BASE_URL}/model/update_connect_status`,
  },
  knowledgeBase: {
    // Elasticsearch 服务
    health: `${API_BASE_URL}/indices/health`,
    indices: `${API_BASE_URL}/indices`,
    indexInfo: (indexName: string) => `${API_BASE_URL}/indices/${indexName}/info`,
    indexDetail: (indexName: string) => `${API_BASE_URL}/indices/${indexName}`,
    
    // 文件上传服务
    upload: `${UPLOAD_SERVICE_URL}/upload`,
  },
  config: {
    save: `${API_BASE_URL}/config/save_config`,
    load: `${API_BASE_URL}/config/load_config`,
  }
};

// 通用错误处理
export class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// 重构：拦截器等是不是需要单独文件管理？
// API请求拦截器
export const fetchWithErrorHandling = async (url: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(url, options);
    
    // 处理HTTP错误
    if (!response.ok) {
      // 检查是否为会话过期错误 (401)
      if (response.status === 401) {
        handleSessionExpired();
        throw new ApiError(STATUS_CODES.TOKEN_EXPIRED, "登录已过期，请重新登录");
      }
      
      // 处理自定义499错误码 (客户端关闭连接)
      if (response.status === 499) {
        handleSessionExpired();
        throw new ApiError(STATUS_CODES.TOKEN_EXPIRED, "连接已断开，会话可能已过期");
      }
      
      // 其他HTTP错误
      const errorText = await response.text();
      throw new ApiError(response.status, errorText || `请求失败: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    // 处理网络错误
    if (error instanceof TypeError && error.message.includes('NetworkError')) {
      console.error('网络错误:', error);
      throw new ApiError(STATUS_CODES.SERVER_ERROR, "网络连接错误，请检查网络连接");
    }
    
    // 处理连接重置错误
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('连接错误:', error);
      
      // 对于用户管理相关的请求，可能是登录过期
      if (url.includes('/user/session') || url.includes('/user/current_user_id')) {
        handleSessionExpired();
        throw new ApiError(STATUS_CODES.TOKEN_EXPIRED, "连接已断开，会话可能已过期");
      } else {
        throw new ApiError(STATUS_CODES.SERVER_ERROR, "服务器连接错误，请稍后重试");
      }
    }
    
    // 重新抛出其他错误
    throw error;
  }
};

// 处理会话过期的方法
function handleSessionExpired() {
  // 防止重复触发
  if (window.__isHandlingSessionExpired) {
    return;
  }
  
  // 标记正在处理中
  window.__isHandlingSessionExpired = true;
  
  // 清除本地存储的会话信息
  if (typeof window !== "undefined") {
    localStorage.removeItem("session");
    
    // 使用自定义事件通知应用中的其他组件（如SessionExpiredListener）
    if (window.dispatchEvent) {
      // 确保使用与EVENTS.SESSION_EXPIRED常量一致的事件名
      window.dispatchEvent(new CustomEvent('session-expired', {
        detail: { message: "登录已过期，请重新登录" }
      }));
    }
    
    // 300ms后重置标记，允许将来再次触发
    setTimeout(() => {
      window.__isHandlingSessionExpired = false;
    }, 300);
  }
}

// 为TypeScript添加全局接口扩展
declare global {
  interface Window {
    __isHandlingSessionExpired?: boolean;
  }
}