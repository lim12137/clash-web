import { API_ENDPOINTS } from './api';

// 获取授权头的辅助函数
const getAuthHeaders = () => {
  const session = typeof window !== "undefined" ? localStorage.getItem("session") : null;
  const sessionObj = session ? JSON.parse(session) : null;

  return {
    'Content-Type': 'application/json',
    'User-Agent': 'AgentFrontEnd/1.0',
    ...(sessionObj?.access_token && { "Authorization": `Bearer ${sessionObj.access_token}` }),
  };
};

export const agentService = {
  // Run Agent and return ReadableStream
  async run(params: {
    query: string;
    conversation_id: number;
    is_set: boolean;
    history: Array<{ role: 'user' | 'assistant'; content: string; }>;
    minio_files?: Array<{
      object_name: string;
      name: string;
      type: string;
      size: number;
      url?: string;
      description?: string;
    }>;
  }): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(API_ENDPOINTS.agent.run, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body;
  },
}; 