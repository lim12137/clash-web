// 知识库相关类型定义

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
  userId?: string;
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
  status: string // 文档状态：解析中、解析完成、解析失败
  selected?: boolean // 用于UI选择状态
}

// 索引信息响应接口
export interface IndexInfoResponse {
  success?: boolean;
  message?: string;
  base_info: {
    doc_count: number;
    unique_sources_count: number;
    store_size: string;
    process_source: string;
    embedding_model: string;
    creation_date: string;
    update_date: string;
  };
  search_performance?: {
    total_search_count: number;
    hit_count: number;
  };
  fields?: string[];
  files?: Array<{
    path_or_url: string;
    file: string;
    file_size: number;
    create_time: string;
    id?: string;
    status?: string;
    chunk_count?: number;
  }>;
} 