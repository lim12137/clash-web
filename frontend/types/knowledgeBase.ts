// Knowledge base related type definitions

// Document status constants
export const NON_TERMINAL_STATUSES = ["WAIT_FOR_PROCESSING", "PROCESSING", "WAIT_FOR_FORWARDING", "FORWARDING"];

// Knowledge base basic type
export interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  chunkCount: number
  documentCount: number
  createdAt: any
  embeddingModel: string
  avatar: string
  chunkNum: number
  language: string
  nickname: string
  parserId: string
  permission: string
  tokenNum: number
  source: string
}

// Create knowledge base parameter type
export interface KnowledgeBaseCreateParams {
  name: string;
  description: string;
  source?: string;
  embeddingModel?: string;
}

// Document type
export interface Document {
  id: string
  kb_id: string
  name: string
  type: string
  size: number
  create_time: string
  chunk_num: number
  token_num: number
  status: string
  selected?: boolean // For UI selection status
  latest_task_id: string // For marking the latest celery task
}
