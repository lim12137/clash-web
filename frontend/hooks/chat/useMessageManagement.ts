import { useState, useCallback } from 'react';
import { ChatMessageType } from '@/types/chat';
import log from '@/lib/logger';

/**
 * Hook for managing chat messages across conversations
 * Handles message state, CRUD operations, and conversation-specific message management
 */
export function useMessageManagement() {
  // Messages state: conversationId -> messages array
  const [sessionMessages, setSessionMessages] = useState<{
    [conversationId: number]: ChatMessageType[];
  }>({});

  /**
   * Get messages for a specific conversation
   */
  const getMessages = useCallback((conversationId: number): ChatMessageType[] => {
    return sessionMessages[conversationId] || [];
  }, [sessionMessages]);

  /**
   * Add a new message to a conversation
   */
  const addMessage = useCallback((
    conversationId: number, 
    message: ChatMessageType
  ) => {
    setSessionMessages((prev) => ({
      ...prev,
      [conversationId]: [
        ...(prev[conversationId] || []),
        message
      ]
    }));
  }, []);


  /**
   * Update a specific message in a conversation
   */
  const updateMessage = useCallback((
    conversationId: number,
    messageId: string,
    updates: Partial<ChatMessageType>
  ) => {
    setSessionMessages((prev) => {
      const newMessages = { ...prev };
      const messages = newMessages[conversationId];
      
      if (!messages) {
        log.warn(`No messages found for conversation ${conversationId}`);
        return prev;
      }

      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) {
        log.warn(`Message ${messageId} not found in conversation ${conversationId}`);
        return prev;
      }

      newMessages[conversationId] = [...messages];
      newMessages[conversationId][messageIndex] = {
        ...messages[messageIndex],
        ...updates
      };

      return newMessages;
    });
  }, []);




  /**
   * Set messages for a conversation (replace all messages)
   */
  const setMessages = useCallback((
    conversationId: number,
    messages: ChatMessageType[]
  ) => {
    setSessionMessages((prev) => ({
      ...prev,
      [conversationId]: messages
    }));
  }, []);


  /**
   * Update a specific message across all conversations (for global updates)
   */
  const updateMessageGlobally = useCallback((
    messageId: string,
    updates: Partial<ChatMessageType>
  ) => {
    setSessionMessages((prev) => {
      const newMessages = { ...prev };
      
      Object.keys(newMessages).forEach((conversationId) => {
        const messages = newMessages[parseInt(conversationId)];
        if (messages) {
          const messageIndex = messages.findIndex(msg => msg.id === messageId);
          if (messageIndex !== -1) {
            newMessages[parseInt(conversationId)] = [...messages];
            newMessages[parseInt(conversationId)][messageIndex] = {
              ...messages[messageIndex],
              ...updates
            };
          }
        }
      });

      return newMessages;
    });
  }, []);

  /**
   * Check if a conversation has messages
   */
  const hasMessages = useCallback((conversationId: number): boolean => {
    const messages = sessionMessages[conversationId];
    return messages && messages.length > 0;
  }, [sessionMessages]);


  return {
    // State
    sessionMessages,
    
    // Getters
    getMessages,
    hasMessages,
    
    // Setters
    addMessage,
    updateMessage,
    updateMessageGlobally,
    setMessages,
  };
}
