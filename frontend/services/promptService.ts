import { API_ENDPOINTS } from './api';

import { fetchWithAuth, getAuthHeaders } from '@/lib/auth';
// @ts-ignore
const fetch = fetchWithAuth;

/**
 * Prompt Generation Request Parameters
 */
export interface GeneratePromptParams {
  agent_id: number;
  task_description: string;
}

/**
 * Save Prompt Request Parameters (using agent/update)
 */
export interface SavePromptParams {
  agent_id: number;
  prompt: string;
}

/**
 * Stream Response Data Structure
 */
export interface StreamResponseData {
  type: 'duty' | 'constraint' | 'few_shots' | 'agent_var_name' | 'agent_description' | 'agent_display_name';
  content: string;
  is_complete: boolean;
}

/**
 * Get Request Headers
 */
const getHeaders = () => {
  return getAuthHeaders();
};

export const generatePromptStream = async (
  params: GeneratePromptParams,
  onData: (data: StreamResponseData) => void,
  onError?: (err: any) => void,
  onComplete?: () => void
) => {
  try {
    const response = await fetch(API_ENDPOINTS.prompt.generate, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.replace('data: ', ''));
            if (json.success) {
              onData(json.data);
            }
          } catch (e) {
            if (onError) onError(e);
          }
        }
      }
    }
    if (onComplete) onComplete();
  } catch (err) {
    if (onError) onError(err);
    if (onComplete) onComplete();
  }
};
