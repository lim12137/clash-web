// Knowledge Base Polling Service - Encapsulates polling logic, separates business logic from components

import { Document, NON_TERMINAL_STATUSES, KnowledgeBase } from '@/types/knowledgeBase';
import knowledgeBaseService from './knowledgeBaseService';

class KnowledgeBasePollingService {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private docStatusPollingInterval: number = 5000; // 5 seconds
  private knowledgeBasePollingInterval: number = 1000; // 1 second
  private maxKnowledgeBasePolls: number = 60; // Maximum 60 polling attempts
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
    
    // Define the polling logic function
    const pollDocuments = async () => {
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
        
        // Get latest document status
        const documents = await knowledgeBaseService.getAllFiles(kbId);
        
        // Call callback function with latest documents first to ensure UI updates immediately
        callback(documents);
        
        // Check if any documents are in processing
        const hasProcessingDocs = documents.some(doc => 
          NON_TERMINAL_STATUSES.includes(doc.status)
        );
        
        // If there are processing documents, continue polling
        if (hasProcessingDocs) {
          console.log('Documents processing, continue polling');
          // Continue polling, don't stop
          return;
        }
        
        // All documents processed, stopping polling
        console.log('All documents processed, stopping polling');
        for (const doc of documents) {
          console.log("================================================")
          console.log(`Document Name: ${doc.name}`);
          console.log(`Document Status: ${doc.status}`);
          console.log(`Document Size: ${doc.size}`);
          console.log("================================================")
        }
        this.stopPolling(kbId);
        
        // Trigger knowledge base list update
        this.triggerKnowledgeBaseListUpdate(true);
      } catch (error) {
        console.error(`Error polling knowledge base ${kbId} document status:`, error);
      }
    };
    
    // Execute the first poll immediately to sync with knowledge base polling
    pollDocuments();
    
    // Create recurring polling
    const interval = setInterval(pollDocuments, this.docStatusPollingInterval);
    
    // Save polling identifier
    this.pollingIntervals.set(kbId, interval);
  }
  
  /**
   * Poll to check if knowledge base is ready (exists and stats updated).
   * @param kbName Knowledge base name
   * @param originalDocumentCount The document count before upload (for incremental upload)
   * @param expectedIncrement The number of new files uploaded
   */
  pollForKnowledgeBaseReady(
    kbName: string,
    originalDocumentCount: number = 0,
    expectedIncrement: number = 0
  ): Promise<KnowledgeBase> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const checkForStats = async () => {
        try {
          const kbs = await knowledgeBaseService.getKnowledgeBasesInfo(true) as KnowledgeBase[];
          const kb = kbs.find(k => k.name === kbName);

          // Check if KB exists and its stats are populated
          if (kb) {
            // If expectedIncrement > 0, check if documentCount increased as expected
            if (
              expectedIncrement > 0 &&
              kb.documentCount >= (originalDocumentCount + expectedIncrement)
            ) {
              console.log(
                `Knowledge base ${kbName} documentCount increased as expected: ${kb.documentCount} (was ${originalDocumentCount}, expected increment ${expectedIncrement})`
              );
              this.triggerKnowledgeBaseListUpdate(true);
              resolve(kb);
              return;
            }
            // Fallback: for new KB or no increment specified, use old logic
            if (expectedIncrement === 0 && (kb.documentCount > 0 || kb.chunkCount > 0)) {
              console.log(`Knowledge base ${kbName} is ready and stats are populated.`);
              this.triggerKnowledgeBaseListUpdate(true);
              resolve(kb);
              return;
            }
          }

          count++;
          if (count < this.maxKnowledgeBasePolls) {
            console.log(`Knowledge base ${kbName} not ready yet, continue waiting...`);
            setTimeout(checkForStats, this.knowledgeBasePollingInterval);
          } else {
            console.error(`Knowledge base ${kbName} readiness check timed out.`);
            reject(new Error(`Timed out waiting for stats for knowledge base ${kbName}.`));
          }
        } catch (error) {
          console.error(`Failed to get stats for knowledge base ${kbName}:`, error);
          count++;
          if (count < this.maxKnowledgeBasePolls) {
            setTimeout(checkForStats, this.knowledgeBasePollingInterval);
          } else {
            reject(new Error(`Failed to get stats for knowledge base ${kbName} after multiple attempts.`));
          }
        }
      };
      checkForStats();
    });
  }

  // Simplified method for new knowledge base creation workflow
  async handleNewKnowledgeBaseCreation(kbName: string, originalDocumentCount: number = 0, expectedIncrement: number = 0, callback: (kb: KnowledgeBase) => void) {
    try {
      // Start document polling immediately - no need to wait for KB existence
      this.startDocumentStatusPolling(kbName, (documents) => {
        this.triggerDocumentsUpdate(kbName, documents);
      });
      
      // Wait for the knowledge base to be ready (exist and have stats)
      const populatedKB = await this.pollForKnowledgeBaseReady(kbName, originalDocumentCount, expectedIncrement);
      
      // Call success callback with populated knowledge base
      callback(populatedKB);
      
    } catch (error) {
      console.error(`Failed to handle new knowledge base creation for ${kbName}:`, error);
      throw error;
    }
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