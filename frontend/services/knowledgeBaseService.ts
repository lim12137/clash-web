// 统一封装知识库相关API调用

import { Document, KnowledgeBase, KnowledgeBaseCreateParams, IndexInfoResponse } from '@/types/knowledgeBase';
import { API_ENDPOINTS } from './api';

// Knowledge base service class
class KnowledgeBaseService {
  // 新增：添加一个记录空列表请求的时间戳
  private emptyListTimestamp: number | null = null;
  // 新增：空列表缓存有效期（毫秒）
  private emptyListCacheDuration = 30000; // 30秒

  // Check Elasticsearch health
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(API_ENDPOINTS.knowledgeBase.health);
      const data = await response.json();
      
      if (data.status === "healthy" && data.elasticsearch === "connected") {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Elasticsearch健康检查失败:", error);
      return false;
    }
  }

  // Get knowledge bases
  async getKnowledgeBases(skipHealthCheck = false): Promise<KnowledgeBase[]> {
    try {
      // First check Elasticsearch health (unless skipped)
      if (!skipHealthCheck) {
        const isElasticsearchHealthy = await this.checkHealth();
        if (!isElasticsearchHealthy) {
          console.warn("Elasticsearch服务不可用");
          return [];
        }
      }

      // 新增：检查空列表缓存是否有效
      if (this.emptyListTimestamp !== null) {
        const now = Date.now();
        if (now - this.emptyListTimestamp < this.emptyListCacheDuration) {
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
              description: "Elasticsearch索引",
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
        console.error("获取Elasticsearch索引失败:", error);
      }
      
      // 新增：如果列表为空，设置空列表缓存时间戳
      if (knowledgeBases.length === 0) {
        this.emptyListTimestamp = Date.now();
      } else {
        // 如果列表不为空，清除缓存
        this.emptyListTimestamp = null;
      }
      
      return knowledgeBases;
    } catch (error) {
      console.error("获取知识库列表失败:", error);
      throw error;
    }
  }

  // 检查知识库名称是否已存在
  async checkKnowledgeBaseNameExists(name: string): Promise<boolean> {
    try {
      const knowledgeBases = await this.getKnowledgeBases(true);
      return knowledgeBases.some(kb => kb.name === name);
    } catch (error) {
      console.error("检查知识库名称存在性失败:", error);
      throw error;
    }
  }

  // Create a new knowledge base
  async createKnowledgeBase(params: KnowledgeBaseCreateParams): Promise<KnowledgeBase> {
    try {
      const response = await fetch(API_ENDPOINTS.knowledgeBase.indexDetail(params.name), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: params.name,
          description: params.description || "",
          embeddingModel: params.embeddingModel || "",
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "创建知识库失败");
      }

      // 创建知识库后清除空列表缓存
      this.emptyListTimestamp = null;

      // Create a full KnowledgeBase object with default values
      return {
        id: result.id || params.name, // 使用返回的ID或者名称作为ID
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
      console.error("创建知识库失败:", error);
      throw error;
    }
  }

  // Delete a knowledge base
  async deleteKnowledgeBase(id: string): Promise<void> {
    try {
      // 使用REST风格的DELETE请求删除索引
      const response = await fetch(API_ENDPOINTS.knowledgeBase.indexDetail(id), {
        method: "DELETE",
      });

      const result = await response.json();
      if (result.status !== "success") {
        throw new Error(result.message || "删除知识库失败");
      }
      
      // 删除知识库后清除空列表缓存，因为状态可能已改变
      this.emptyListTimestamp = null;
    } catch (error) {
      console.error("删除知识库失败:", error);
      throw error;
    }
  }

  // Get documents from a knowledge base
  async getDocuments(kbId: string, forceRefresh: boolean = false): Promise<Document[]> {
    try {
      // 添加随机查询参数，绕过浏览器缓存（仅在强制刷新时）
      const cacheParam = forceRefresh ? `&_t=${Date.now()}` : '';
      
      // 使用新接口 /indices/{index_name}/info 获取知识库详细信息，包含文件列表
      const response = await fetch(
        `${API_ENDPOINTS.knowledgeBase.indexInfo(kbId)}?include_files=true${cacheParam}`
      );
      const result = await response.json() as IndexInfoResponse;

      // 处理不同的响应格式，有些API返回success字段，有些直接返回数据
      if (result.success === false) {
        throw new Error(result.message || "获取文档列表失败");
      }

      // 标准API响应格式处理
      if (result.base_info && result.files && Array.isArray(result.files)) {
        return result.files.map((file) => ({
          id: file.path_or_url, // 使用路径或URL作为ID
          kb_id: kbId,
          name: file.file || file.path_or_url.split('/').pop() || 'Unknown',
          type: this.getFileTypeFromName(file.file || file.path_or_url),
          size: file.file_size || 0,
          create_time: file.create_time || new Date().toISOString(),
          chunk_num: file.chunk_count || 0,
          token_num: 0, // API 中没有提供，使用默认值
          status: file.status || "UNKNOWN" // 从API获取状态
        }));
      }

      // 如果未能获取到任何文档信息，返回空数组
      return [];
    } catch (error) {
      console.error("获取文档列表失败:", error);
      throw error;
    }
  }
  
  // 根据文件名获取文件类型
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
      // 创建 FormData 对象
      const formData = new FormData();
      formData.append("index_name", kbId);

      // 添加文件
      for (let i = 0; i < files.length; i++) {
        formData.append("file", files[i]);
      }

      // 如果提供了分块策略，则添加到请求中
      if (chunkingStrategy) {
        formData.append("chunking_strategy", chunkingStrategy);
      }

      // 发送请求
      const response = await fetch(API_ENDPOINTS.knowledgeBase.upload, {
        method: "POST",
        body: formData,
      });

      // 检查响应状态码
      if (!response.ok) {
        const result = await response.json();
        
        // 处理400错误（无文件或无效文件）
        if (response.status === 400) {
          if (result.error === "No files in the request") {
            throw new Error("请求中没有文件");
          } else if (result.error === "No valid files uploaded") {
            throw new Error(`无效的文件上传: ${result.errors.join(", ")}`);
          }
          throw new Error(result.error || "文件上传验证失败");
        }
        
        // 处理500错误（数据处理服务失败）
        if (response.status === 500) {
          const errorMessage = `数据处理服务失败: ${result.error}. 已上传文件: ${result.files.join(", ")}`;
          throw new Error(errorMessage);
        }
        
        throw new Error("文件上传失败");
      }

      // 处理成功响应（201）
      const result = await response.json();
      if (response.status === 201) {
        return;
      }

      throw new Error("未知的响应状态");
    } catch (error) {
      console.error("上传文件失败:", error);
      throw error;
    }
  }

  // Delete a document from a knowledge base
  async deleteDocument(docId: string, kbId: string): Promise<void> {
    try {
      // 使用REST风格的DELETE请求删除文档，需要知识库ID和文档路径
      const response = await fetch(
        `${API_ENDPOINTS.knowledgeBase.indexDetail(kbId)}/documents?path_or_url=${encodeURIComponent(docId)}`, 
        {
          method: "DELETE"
        }
      );

      const result = await response.json();
      if (result.status !== "success") {
        throw new Error(result.message || "删除文档失败");
      }
    } catch (error) {
      console.error("删除文档失败:", error);
      throw error;
    }
  }
}

// Export a singleton instance
const knowledgeBaseService = new KnowledgeBaseService();
export default knowledgeBaseService; 