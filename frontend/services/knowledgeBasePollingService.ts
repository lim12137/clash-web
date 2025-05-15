// 知识库轮询服务 - 封装轮询相关逻辑，从组件中分离业务逻辑

import { Document } from '@/types/knowledgeBase';
import knowledgeBaseService from './knowledgeBaseService';

class KnowledgeBasePollingService {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private docStatusPollingInterval: number = 5000; // 5秒
  private knowledgeBasePollingInterval: number = 1000; // 1秒
  private maxKnowledgeBasePolls: number = 30; // 最多轮询30次
  private activeKnowledgeBaseId: string | null = null; // 记录当前活动的知识库ID

  // 设置当前活动的知识库ID
  setActiveKnowledgeBase(kbId: string | null): void {
    this.activeKnowledgeBaseId = kbId;
  }

  // 获取当前活动的知识库ID
  getActiveKnowledgeBase(): string | null {
    return this.activeKnowledgeBaseId;
  }

  // 启动文档状态轮询，只更新指定知识库的文档
  startDocumentStatusPolling(kbId: string, callback: (documents: Document[]) => void): void {
    console.log(`开始轮询知识库 ${kbId} 的文档状态`);
    
    // 先清除已有的轮询
    this.stopPolling(kbId);
    
    // 创建新的轮询
    const interval = setInterval(async () => {
      try {
        // 如果当前有活动知识库，且轮询的知识库与活动知识库不一致，则停止轮询
        if (this.activeKnowledgeBaseId !== null && this.activeKnowledgeBaseId !== kbId) {
          console.log(`知识库 ${kbId} 不是当前活动知识库，停止轮询`);
          this.stopPolling(kbId);
          return;
        }
        
        // 获取最新文档状态，使用强制刷新参数
        const documents = await knowledgeBaseService.getDocuments(kbId, true);
        
        // 调用回调函数传递最新文档
        callback(documents);
        
        // 检查是否还有文档在处理中
        const hasProcessingDocs = documents.some(doc => 
          doc.status === "PROCESSING" || doc.status === "FORWARDING"
        );
        
        // 如果没有处理中的文档，停止轮询
        if (!hasProcessingDocs) {
          console.log('所有文档处理完成，停止轮询');
          this.stopPolling(kbId);
          
          // 触发知识库列表更新
          this.triggerKnowledgeBaseListUpdate(true);
        }
      } catch (error) {
        console.error(`轮询知识库 ${kbId} 文档状态出错:`, error);
      }
    }, this.docStatusPollingInterval);
    
    // 保存轮询标识
    this.pollingIntervals.set(kbId, interval);
  }
  
  // 轮询检查新知识库是否创建成功，并且至少有一个文档
  waitForKnowledgeBaseCreation(kbName: string, onSuccess: (found: boolean) => void): void {
    let count = 0;
    
    const checkForKnowledgeBase = async () => {
      try {
        // 使用轻量级API查询知识库是否存在，不获取详细统计信息
        const exists = await knowledgeBaseService.checkKnowledgeBaseExists(kbName);
        
        if (exists) {
          // 知识库存在，检查是否有文档
          try {
            const documents = await knowledgeBaseService.getDocuments(kbName, true);
            
            if (documents && documents.length > 0) {
              console.log(`知识库 ${kbName} 创建成功，文档数量: ${documents.length}`);
              
              // 知识库创建成功且有文档后，获取完整信息（带统计数据）
              this.triggerKnowledgeBaseListUpdate(true);
              
              // 调用成功回调
              onSuccess(true);
              return;
            } else {
              console.log(`知识库 ${kbName} 已创建但尚无文档，继续等待...`);
            }
          } catch (docError) {
            // 文档获取失败，可能是文档索引尚未创建完成
            console.log(`知识库 ${kbName} 已创建但获取文档失败，继续等待...`);
          }
        } else {
          console.log(`知识库 ${kbName} 尚未创建，继续等待...`);
        }
        
        // 增加计数
        count++;
        
        // 如果未达到最大尝试次数，继续轮询
        if (count < this.maxKnowledgeBasePolls) {
          setTimeout(checkForKnowledgeBase, this.knowledgeBasePollingInterval);
        } else {
          console.error(`知识库 ${kbName} 创建检查超时，已尝试 ${count} 次`);
          onSuccess(false);
        }
      } catch (error) {
        console.error(`检查知识库 ${kbName} 是否创建失败:`, error);
        
        // 出错后继续尝试，除非达到最大次数
        if (count < this.maxKnowledgeBasePolls) {
          setTimeout(checkForKnowledgeBase, this.knowledgeBasePollingInterval);
          count++;
        } else {
          console.error(`检查知识库 ${kbName} 是否创建失败，已尝试 ${count} 次`);
          onSuccess(false);
        }
      }
    };
    
    // 开始轮询
    checkForKnowledgeBase();
  }
  
  // 停止特定知识库的轮询
  stopPolling(kbId: string): void {
    const interval = this.pollingIntervals.get(kbId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(kbId);
      console.log(`停止知识库 ${kbId} 的轮询`);
    }
  }
  
  // 停止所有轮询
  stopAllPolling(): void {
    this.pollingIntervals.forEach((interval, kbId) => {
      clearInterval(interval);
      console.log(`停止知识库 ${kbId} 的轮询`);
    });
    this.pollingIntervals.clear();
  }
  
  // 触发知识库列表更新（可选择是否强制刷新）
  triggerKnowledgeBaseListUpdate(forceRefresh: boolean = false): void {
    // 清除缓存
    localStorage.removeItem('preloaded_kb_data');
    
    // 触发自定义事件，通知更新知识库列表
    window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
      detail: { forceRefresh }
    }));
  }
  
  // 触发文档列表更新 - 只更新指定知识库的文档
  triggerDocumentsUpdate(kbId: string, documents: Document[]): void {
    // 如果当前有活动知识库，且更新的知识库与活动知识库不一致，则忽略此次更新
    if (this.activeKnowledgeBaseId !== null && this.activeKnowledgeBaseId !== kbId) {
      console.log(`知识库 ${kbId} 不是当前活动知识库，忽略文档更新`);
      return;
    }
    
    // 使用自定义事件更新文档，并确保包含知识库ID
    window.dispatchEvent(new CustomEvent('documentsUpdated', {
      detail: { 
        kbId,
        documents
      }
    }));
  }
}

// 导出单例实例
const knowledgeBasePollingService = new KnowledgeBasePollingService();
export default knowledgeBasePollingService;