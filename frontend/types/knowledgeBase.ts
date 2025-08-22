// 知识库相关类型定义

// 文档状态常量
export const NON_TERMINAL_STATUSES = ["WAIT_FOR_PROCESSING", "PROCESSING", "WAIT_FOR_FORWARDING", "FORWARDING"];

// 知识库基本类型
export interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  chunkCount: number
  documentCount: number
  createdAt: string
  embeddingModel: string
  avatar: string
  chunkNum: number
  language: string
  nickname: string
  parserId: string
  permission: string
  tokenNum: number
  source: string // 来自deepdoc还是modelengine
}

// 创建知识库的参数类型
export interface KnowledgeBaseCreateParams {
  name: string;
  description: string;
  source?: string;
  embeddingModel?: string;
}

// 文档类型
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
  selected?: boolean // 用于UI选择状态
  latest_task_id: string //用于标记对应的最新celery任务
}
