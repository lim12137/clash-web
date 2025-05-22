// Knowledge Base Polling Service - Encapsulates polling logic, separates business logic from components

import { Document } from '@/types/knowledgeBase';
import knowledgeBaseService from './knowledgeBaseService';

class KnowledgeBasePollingService {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private docStatusPollingInterval: number = 5000; // 5 seconds
  private knowledgeBasePollingInterval: number = 1000; // 1 second
  private maxKnowledgeBasePolls: number = 30; // Maximum 30 polling attempts
  private activeKnowledgeBaseId: string | null = null; // Record current active knowledge base ID

  // Set current active knowledge base ID
  setActiveKnowledgeBase(kbId: string | null): void {
    this.activeKnowledgeBaseId = kbId;
  }

  // Get current active knowledge base ID
  getActiveKnowledgeBase(): string | null {
    return this.activeKnowledgeBaseId;
  }

  // Start document status polling, only update documents for specified knowledge base
  startDocumentStatusPolling(kbId: string, callback: (documents: Document[]) => void): void {
    console.log(`Start polling documents status for knowledge base ${kbId}`);
    
    // Clear existing polling first
    this.stopPolling(kbId);
    
    // Initialize polling counter
    let pollCount = 0;
    const maxPollCount = 60; // Maximum 60 polling attempts (5 minutes)
    
    // Create new polling
    const interval = setInterval(async () => {
      try {
        // Increment polling counter
        pollCount++;
        
        // If there is an active knowledge base and polling knowledge base doesn't match active one, stop polling
        if (this.activeKnowledgeBaseId !== null && this.activeKnowledgeBaseId !== kbId) {
          this.stopPolling(kbId);
          return;
        }
        
        // If exceeded maximum polling count, stop polling
        if (pollCount > maxPollCount) {
          this.stopPolling(kbId);
          return;
        }
        
        // Get latest document status, use force refresh parameter
        const documents = await knowledgeBaseService.getDocuments(kbId, true);
        
        // Call callback function with latest documents first to ensure UI updates immediately
        callback(documents);
        
        // Check if any documents are in processing
        const hasProcessingDocs = documents.some(doc => 
          doc.status === "PROCESSING" || doc.status === "FORWARDING" || doc.status === "WAITING"
        );
        
        // Check if any documents have zero size (any status)
        const hasZeroSizeDocs = documents.some(doc => doc.size === 0);
        
        // If there are processing documents or zero size documents, continue polling
        if (hasProcessingDocs || hasZeroSizeDocs) {
          console.log('Documents processing or information incomplete, continue polling');
          
          // If found COMPLETED status but size is 0, check again after short delay
          const hasIncompleteCompletedDocs = documents.some(doc => 
            doc.status === "COMPLETED" && doc.size === 0
          );
          
          if (hasIncompleteCompletedDocs) {
            console.log('Found completed but incomplete documents, checking again in 1 second');
            setTimeout(async () => {
              try {
                const updatedDocs = await knowledgeBaseService.getDocuments(kbId, true);
                callback(updatedDocs);
              } catch (error) {
                console.error('Failed to get updated document information:', error);
              }
            }, 1000);
          }
          
          // Continue polling, don't stop
          return;
        }
        
        // 如果所有文档处理完成且信息完整，停止轮询
        console.log('所有文档处理完成且信息完整，停止轮询');
        this.stopPolling(kbId);
        
        // Trigger knowledge base list update
        this.triggerKnowledgeBaseListUpdate(true);
      } catch (error) {
        console.error(`Error polling knowledge base ${kbId} document status:`, error);
      }
    }, this.docStatusPollingInterval);
    
    // Save polling identifier
    this.pollingIntervals.set(kbId, interval);
  }
  
  // Poll to check if new knowledge base is created successfully and has at least one document
  waitForKnowledgeBaseCreation(kbName: string, onSuccess: (found: boolean) => void): void {
    let count = 0;
    
    const checkForKnowledgeBase = async () => {
      try {
        // Use lightweight API to check if knowledge base exists, without getting detailed statistics
        const exists = await knowledgeBaseService.checkKnowledgeBaseExists(kbName);
        
        if (exists) {
          // Knowledge base exists, check if it has documents
          try {
            const documents = await knowledgeBaseService.getDocuments(kbName, true);
            
            if (documents && documents.length > 0) {
              // After knowledge base is created successfully and has documents, get complete info (with statistics)
              this.triggerKnowledgeBaseListUpdate(true);
              
              // Call success callback
              onSuccess(true);
              return;
            } else {
              console.log(`Knowledge base ${kbName} created but no documents yet, continue waiting...`);
            }
          } catch (docError) {
            // Document fetch failed, possibly document index not created yet
            console.log(`Knowledge base ${kbName} created but failed to get documents, continue waiting...`);
          }
        } else {
          console.log(`Knowledge base ${kbName} not created yet, continue waiting...`);
        }
        
        // Increment counter
        count++;
        
        // If not reached maximum attempts, continue polling
        if (count < this.maxKnowledgeBasePolls) {
          setTimeout(checkForKnowledgeBase, this.knowledgeBasePollingInterval);
        } else {
          console.error(`Knowledge base ${kbName} creation check timed out, attempted ${count} times`);
          onSuccess(false);
        }
      } catch (error) {
        console.error(`Failed to check if knowledge base ${kbName} is created:`, error);
        
        // Continue trying after error unless maximum attempts reached
        if (count < this.maxKnowledgeBasePolls) {
          setTimeout(checkForKnowledgeBase, this.knowledgeBasePollingInterval);
          count++;
        } else {
          console.error(`Failed to check if knowledge base ${kbName} is created, attempted ${count} times`);
          onSuccess(false);
        }
      }
    };
    
    // Start polling
    checkForKnowledgeBase();
  }
  
  // Stop polling for specific knowledge base
  stopPolling(kbId: string): void {
    const interval = this.pollingIntervals.get(kbId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(kbId);
    }
  }
  
  // Stop all polling
  stopAllPolling(): void {
    this.pollingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
  }
  
  // Trigger knowledge base list update (optionally force refresh)
  triggerKnowledgeBaseListUpdate(forceRefresh: boolean = false): void {
    // Trigger custom event to notify knowledge base list update
    window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
      detail: { forceRefresh }
    }));
  }
  
  // Trigger document list update - only update documents for specified knowledge base
  triggerDocumentsUpdate(kbId: string, documents: Document[]): void {
    // If there is an active knowledge base and update knowledge base doesn't match active one, ignore this update
    if (this.activeKnowledgeBaseId !== null && this.activeKnowledgeBaseId !== kbId) {
      console.log(`Knowledge base ${kbId} is not current active knowledge base, ignoring document update`);
      return;
    }
    
    // Use custom event to update documents, ensure knowledge base ID is included
    window.dispatchEvent(new CustomEvent('documentsUpdated', {
      detail: { 
        kbId,
        documents
      }
    }));
  }
}

// Export singleton instance
const knowledgeBasePollingService = new KnowledgeBasePollingService();
export default knowledgeBasePollingService;