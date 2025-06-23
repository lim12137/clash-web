// Unified encapsulation of knowledge base related API calls

import { Document, KnowledgeBase, KnowledgeBaseCreateParams } from '@/types/knowledgeBase';
import { API_ENDPOINTS } from './api';
import { getAuthHeaders } from '@/lib/auth';

// Knowledge base service class
class KnowledgeBaseService {
  // 健康检查缓存
  private healthCheckCache: { isHealthy: boolean; timestamp: number } | null = null;
  // 健康检查缓存有效期（毫秒）
  private healthCheckCacheDuration = 60000; // 60秒

  // Check Elasticsearch health (force refresh, no caching for setup page)
  async checkHealth(): Promise<boolean> {
    try {
      // 在 setup 页面中强制刷新，不使用缓存
      console.log("强制刷新健康检查，不使用缓存");
      this.healthCheckCache = null; // 清除缓存

      const response = await fetch(API_ENDPOINTS.knowledgeBase.health);
      const data = await response.json();
      
      const isHealthy = data.status === "healthy" && data.elasticsearch === "connected";
      
      // 不再更新缓存，每次都获取最新状态
      
      return isHealthy;
    } catch (error) {
      console.error("Elasticsearch健康检查失败:", error);
      // 不再缓存错误状态
      return false;
    }
  }

  // Get knowledge bases with stats (very slow, don't use it)
  async getKnowledgeBasesInfo(skipHealthCheck = false): Promise<KnowledgeBase[]> {
    try {
      // First check Elasticsearch health (unless skipped)
      if (!skipHealthCheck) {
        const isElasticsearchHealthy = await this.checkHealth();
        if (!isElasticsearchHealthy) {
          console.warn("Elasticsearch service unavailable");
          return [];
        }
      }

      let knowledgeBases: KnowledgeBase[] = [];

      // Get knowledge bases from Elasticsearch
      try {
        const response = await fetch(`${API_ENDPOINTS.knowledgeBase.indices}?include_stats=true`);
        const data = await response.json();
        
        if (data.indices && data.indices_info) {
          // Convert Elasticsearch indices to knowledge base format
          knowledgeBases = data.indices_info.map((indexInfo: any) => {
            const stats = indexInfo.stats?.base_info || {};
            
            return {
              id: indexInfo.name,
              name: indexInfo.name,
              description: "Elasticsearch index",
              documentCount: stats.doc_count || 0,
              chunkCount: stats.chunk_count || 0,
              createdAt: stats.creation_date || new Date().toISOString().split("T")[0],
              embeddingModel: stats.embedding_model || "unknown",
              avatar: "",
              chunkNum: 0,
              language: "",
              nickname: "",
              parserId: "",
              permission: "",
              tokenNum: 0,
              source: "elasticsearch",
            };
          });
        }
      } catch (error) {
        console.error("Failed to get Elasticsearch indices:", error);
      }
      
      return knowledgeBases;
    } catch (error) {
      console.error("Failed to get knowledge base list:", error);
      throw error;
    }
  }

  async getKnowledgeBases(skipHealthCheck = false): Promise<string[]> {
    try {
      // First check Elasticsearch health (unless skipped)
      if (!skipHealthCheck) {
        const isElasticsearchHealthy = await this.checkHealth();
        if (!isElasticsearchHealthy) {
          console.warn("Elasticsearch service unavailable");
          return [];
        }
      }

      let knowledgeBases = [];

      try{
        const response = await fetch(`${API_ENDPOINTS.knowledgeBase.indices}`);
        const data = await response.json();
        knowledgeBases = data.indices;
      } catch (error) {
        console.error("Failed to get knowledge base list:", error);
      }

      return knowledgeBases;
    } catch (error) {
      console.error("Failed to get knowledge base list:", error);
      throw error;
    }
  }

  // Check whether the knowledge base name already exists in Elasticsearch
  async checkKnowledgeBaseNameExists(name: string): Promise<boolean> {
    try {
      const knowledgeBases = await this.getKnowledgeBases(true);
      return knowledgeBases.includes(name);
    } catch (error) {
      console.error("Failed to check knowledge base name existence:", error);
      throw error;
    }
  }

  // Create a new knowledge base
  async createKnowledgeBase(params: KnowledgeBaseCreateParams): Promise<KnowledgeBase> {
    try {
      // First check Elasticsearch health status to avoid subsequent operation failures
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        throw new Error("Elasticsearch service unavailable, cannot create knowledge base");
      }
      
      const response = await fetch(API_ENDPOINTS.knowledgeBase.indexDetail(params.name), {
        method: "POST",
        headers: getAuthHeaders(), // Add user authentication information to obtain the user id
        body: JSON.stringify({
          name: params.name,
          description: params.description || "",
          embeddingModel: params.embeddingModel || "",
        }),
      });

      const result = await response.json();
      // 修改判断逻辑，后端返回status字段而不是success字段
      if (result.status !== "success") {
        throw new Error(result.message || "创建知识库失败");
      }

      // Create a full KnowledgeBase object with default values
      return {
        id: result.id || params.name, // Use returned ID or name as ID
        name: params.name,
        description: params.description || null,
        documentCount: 0,
        chunkCount: 0,
        createdAt: new Date().toISOString(),
        embeddingModel: params.embeddingModel || "",
        avatar: "",
        chunkNum: 0,
        language: "",
        nickname: "",
        parserId: "",
        permission: "",
        tokenNum: 0,
        source: params.source || "elasticsearch",
      };
    } catch (error) {
      console.error("Failed to create knowledge base:", error);
      throw error;
    }
  }

  // Delete a knowledge base
  async deleteKnowledgeBase(id: string): Promise<void> {
    try {
      // Use REST-style DELETE request to delete index
      const response = await fetch(API_ENDPOINTS.knowledgeBase.indexDetail(id), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const result = await response.json();
      if (result.status !== "success") {
        throw new Error(result.message || "Failed to delete knowledge base");
      }
    } catch (error) {
      console.error("Failed to delete knowledge base:", error);
      throw error;
    }
  }

  // Get all files from a knowledge base, regardless of the existence of index
  // searchRedis: true means search redis to get the file in Celery, false means only search in ES
  async getAllFiles(kbId: string, searchRedis: boolean = false): Promise<Document[]> {
    try {
      const response = await fetch(API_ENDPOINTS.knowledgeBase.listFiles(kbId, searchRedis));
      const result = await response.json();

      if (result.status !== "success") {
        throw new Error("Failed to get file list");
      }

      if (!result.files || !Array.isArray(result.files)) {
        return [];
      }

      return result.files.map((file: any) => ({
        id: file.path_or_url,
        kb_id: kbId,
        name: file.file,
        type: this.getFileTypeFromName(file.file || file.path_or_url),
        size: file.file_size,
        create_time: file.create_time,
        chunk_num: file.chunk_count || 0,
        token_num: 0,
        status: file.status || "UNKNOWN",
        latest_task_id: file.latest_task_id || ""
      }));
    } catch (error) {
      console.error("Failed to get all files:", error);
      throw error;
    }
  }
  
  // Get file type from filename
  private getFileTypeFromName(filename: string): string {
    if (!filename) return "Unknown";
    
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'PDF';
      case 'doc':
      case 'docx':
        return 'Word';
      case 'xls':
      case 'xlsx':
        return 'Excel';
      case 'ppt':
      case 'pptx':
        return 'PowerPoint';
      case 'txt':
        return 'Text';
      case 'md':
        return 'Markdown';
      default:
        return 'Unknown';
    }
  }

  // Upload documents to a knowledge base
  async uploadDocuments(kbId: string, files: File[], chunkingStrategy?: string): Promise<void> {
    try {
      // Create FormData object
      const formData = new FormData();
      formData.append("index_name", kbId);

      // Add files
      for (let i = 0; i < files.length; i++) {
        formData.append("file", files[i]);
      }

      // If chunking strategy is provided, add it to the request
      if (chunkingStrategy) {
        formData.append("chunking_strategy", chunkingStrategy);
      }

      // Send request - cannot use getAuthHeaders，cuz we actually need content-type: multipart/form-data here
      const response = await fetch(API_ENDPOINTS.knowledgeBase.upload, {
        method: "POST",
        headers: {
          'User-Agent': 'AgentFrontEnd/1.0'
        },
        body: formData,
      });

      // Check response status code
      if (!response.ok) {
        const result = await response.json();
        
        // Handle 400 error (no files or invalid files)
        if (response.status === 400) {
          if (result.error === "No files in the request") {
            throw new Error("No files in the request");
          } else if (result.error === "No valid files uploaded") {
            throw new Error(`Invalid file upload: ${result.errors.join(", ")}`);
          }
          throw new Error(result.error || "File upload validation failed");
        }
        
        // Handle 500 error (data processing service failure)
        if (response.status === 500) {
          const errorMessage = `Data processing service failed: ${result.error}. Uploaded files: ${result.files.join(", ")}`;
          throw new Error(errorMessage);
        }
        
        throw new Error("File upload failed");
      }

      // Handle successful response (201)
      const result = await response.json();
      if (response.status === 201) {
        return;
      }

      throw new Error("Unknown response status");
    } catch (error) {
      console.error("Failed to upload files:", error);
      throw error;
    }
  }

  // Delete a document from a knowledge base
  async deleteDocument(docId: string, kbId: string): Promise<void> {
    try {
      // Use REST-style DELETE request to delete document, requires knowledge base ID and document path
      const response = await fetch(
        `${API_ENDPOINTS.knowledgeBase.indexDetail(kbId)}/documents?path_or_url=${encodeURIComponent(docId)}`, 
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (result.status !== "success") {
        throw new Error(result.message || "Failed to delete document");
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
      throw error;
    }
  }

  // Summary index content
  async summaryIndex(indexName: string, batchSize: number = 1000, onProgress?: (text: string) => void): Promise<string> {
    try {
      const response = await fetch(API_ENDPOINTS.knowledgeBase.summary(indexName) + `?batch_size=${batchSize}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let summary = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解码二进制数据为文本
        const chunk = decoder.decode(value, { stream: true });
        
        // 处理SSE格式的数据
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.trim().startsWith('data:')) {
            try {
              // 提取JSON数据
              const jsonStr = line.substring(line.indexOf('{'));
              const data = JSON.parse(jsonStr);
              
              if (data.status === 'success') {
                // 累加消息部分到摘要
                summary += data.message;
                
                // 如果提供了进度回调，则调用它
                if (onProgress) {
                  onProgress(data.message);
                }
              } else if (data.status === 'error') {
                throw new Error(data.message);
              }
            } catch (e) {
              console.error('解析SSE数据失败:', e, line);
            }
          }
        }
      }
      
      return summary;
    } catch (error) {
      console.error('Error summarizing index:', error);
      throw error;
    }
  }

  // Change knowledge base summary
  async changeSummary(indexName: string, summaryResult: string): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.knowledgeBase.changeSummary(indexName), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          summary_result: summaryResult
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
      }

      if (data.status !== "success") {
        throw new Error(data.message || "Failed to change summary");
      }
    } catch (error) {
      console.error('Error changing summary:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to change summary');
    }
  }

  // Get knowledge base summary
  async getSummary(indexName: string): Promise<string> {
    try {
      const response = await fetch(API_ENDPOINTS.knowledgeBase.getSummary(indexName), {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
      }

      if (data.status !== "success") {
        throw new Error(data.message || "Failed to get summary");
      }
      return data.summary;

    } catch (error) {
      console.error('Error geting summary:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get summary');
    }
  }
}

// Export a singleton instance
const knowledgeBaseService = new KnowledgeBaseService();
export default knowledgeBaseService; 