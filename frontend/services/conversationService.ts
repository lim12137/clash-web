import { API_ENDPOINTS, ApiError } from './api';
import type { 
  ConversationListResponse, 
  ConversationListItem,
  ApiConversationResponse
} from '@/types/conversation';

export interface STTResponse {
  result?: {
    text: string;
  };
  text?: string;
}

// Obtain the auxiliary functions and abnormal function functions of the authorization header for adaptation
export const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'AgentFrontEnd/1.0',
    'Authorization': 'Bearer 1234'
  };
};

const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'AgentFrontEnd/1.0',
  };
};

export const conversationService = {
  // 获取会话列表
  async getList(): Promise<ConversationListItem[]> {
    const response = await fetch(API_ENDPOINTS.conversation.list, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await response.json() as ConversationListResponse;
    
    if (data.code === 0) {
      return data.data || [];
    }
    
    throw new ApiError(data.code, data.message);
  },

  // 创建新会话
  async create() {
    const response = await fetch(API_ENDPOINTS.conversation.create, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });

    const data = await response.json();
    
    if (data.code === 0) {
      return data.data;
    }
    
    throw new ApiError(data.code, data.message);
  },

  // 重命名会话
  async rename(conversationId: number, name: string) {
    const response = await fetch(API_ENDPOINTS.conversation.rename, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        conversation_id: conversationId,
        name,
      }),
    });

    const data = await response.json();
    
    if (data.code === 0) {
      return data.data;
    }
    
    throw new ApiError(data.code, data.message);
  },

  // 获取会话详情
  async getDetail(conversationId: number, signal?: AbortSignal): Promise<ApiConversationResponse> {
    try {
      const response = await fetch(API_ENDPOINTS.conversation.detail(conversationId), {
        method: 'GET',
        headers: getHeaders(),
        signal,
      });

      // 如果在请求返回前信号已被中止，提前返回
      if (signal?.aborted) {
        return { code: -1, message: "请求已取消", data: [] };
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.code === 0) {
        return data;
      }
      
      throw new ApiError(data.code, data.message);
    } catch (error: any) {
      // 如果是取消请求引起的错误，返回特定响应而不是抛出错误
      if (error instanceof Error && error.name === 'AbortError' || signal?.aborted) {
        return { code: -1, message: "请求已取消", data: [] };
      }
      throw error;
    }
  },

  // 删除会话
  async delete(conversationId: number) {
    const response = await fetch(API_ENDPOINTS.conversation.delete(conversationId), {
      method: 'DELETE',
      headers: getHeaders(),
    });

    const data = await response.json();
    
    if (data.code === 0) {
      return true;
    }
    
    throw new ApiError(data.code, data.message);
  },

  // 语音转文字相关功能
  stt: {
    // 创建WebSocket连接
    createWebSocket(): WebSocket {
      return new WebSocket(API_ENDPOINTS.stt.ws);
    },

    // 处理音频数据
    processAudioData(inputData: Float32Array): Int16Array {
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return pcmData;
    },

    // 获取音频配置
    getAudioConstraints() {
      return {
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };
    },

    // 获取音频上下文配置
    getAudioContextOptions() {
      return {
        sampleRate: 16000,
      };
    }
  },

  // Add TTS related functionality
  tts: {
    // Create WebSocket connection
    createWebSocket(): WebSocket {
      return new WebSocket(API_ENDPOINTS.tts.ws);
    },
  },

  // 添加文件预处理方法
  async preprocessFiles(query: string, files: File[], signal?: AbortSignal): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    try {
      // 使用FormData处理文件上传
      const formData = new FormData();
      formData.append('query', query);

      // 添加文件
      if (files && files.length > 0) {
        files.forEach(file => {
          formData.append('files', file);
        });
      }

      const response = await fetch(API_ENDPOINTS.storage.preprocess, {
        method: 'POST',
        body: formData,
        signal,
      });

      if (!response.body) {
        throw new Error("Response body is null");
      }

      return response.body.getReader();
    } catch (error) {
      // 如果是取消请求的错误，则静默处理
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('文件预处理请求已被取消');
        throw new Error('请求已被取消');
      }
      // 其他错误正常抛出
      throw error;
    }
  },

  // 添加运行代理的方法
  async runAgent(params: {
    query: string;
    conversation_id: number;
    is_set: boolean;
    history: Array<{ role: string; content: string; }>;
    files?: File[];  // 添加可选的files参数
    minio_files?: Array<{
      object_name: string;
      name: string;
      type: string;
      size: number;
      url?: string;
      description?: string; // 添加文件描述字段
    }>; // 更新为完整的附件信息对象数组
  }, signal?: AbortSignal) {
    try {
      // 构造请求参数
      const requestParams = {
        query: params.query,
        conversation_id: params.conversation_id,
        is_set: params.is_set,
        history: params.history,
        minio_files: params.minio_files || null // 添加minio_files参数
      };

      const response = await fetch(API_ENDPOINTS.agent.run, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestParams),
        signal,
      });

      if (!response.body) {
        throw new Error("Response body is null");
      }

      return response.body.getReader();
    } catch (error: any) {
      // 如果是取消请求的错误，则静默处理
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Agent请求已被取消');
        throw new Error('请求已被取消');
      }
      // 其他错误正常抛出
      throw error;
    }
  },

  // 获取消息来源（图片和搜索）
  async getSources(params: {
    conversation_id?: number;
    message_id?: number;
    type?: 'all' | 'image' | 'search';
  }) {
    try {
      const response = await fetch(API_ENDPOINTS.conversation.sources, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (data.code === 0) {
        return data.data;
      }

      throw new ApiError(data.code, data.message);
    } catch (error: any) {
      console.error('获取消息来源失败:', error);
      throw error;
    }
  },

  // 生成对话标题
  async generateTitle(params: {
    conversation_id: number;
    history: Array<{ role: 'user' | 'assistant'; content: string; }>;
  }) {
    const response = await fetch(API_ENDPOINTS.conversation.generateTitle, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (data.code === 0) {
      return data.data;
    }

    throw new ApiError(data.code, data.message);
  },

  // 保存消息
  async saveMessage(params: {
    conversation_id: number;
    message_idx: string;
    role: "user" | "assistant";
    message: any[];
    minio_files?: Array<{
      object_name: string;
      name: string;
      type: string;
      size: number;
      url?: string;
    }>;
  }) {
    const response = await fetch(API_ENDPOINTS.conversation.save, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    
    if (data.code === 0) {
      return data.data;
    }
    
    throw new ApiError(data.code, data.message);
  },

  // 点赞/点踩消息
  async updateOpinion(params: { message_id: number; opinion: 'Y' | 'N' | null }) {
    const response = await fetch(API_ENDPOINTS.conversation.opinion, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.code === 0) {
      return true;
    }
    throw new ApiError(data.code, data.message);
  },
}; 