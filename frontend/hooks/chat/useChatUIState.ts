import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useConversationManagement } from "./useConversationManagement";
import { useMessageManagement } from "./useMessageManagement";
import { useAttachmentHandlers } from "./useAttachmentHandlers";
import { handleImageError } from "@/app/chat/internal/chatAttachment";
import { ChatMessageType } from "@/types/chat";
import log from "@/lib/logger";

/**
 * Hook for managing chat UI state and interactions
 */
export const useChatUIState = () => {
  const { t } = useTranslation("common");
  const conversationManagement = useConversationManagement();
  const messageManagement = useMessageManagement();
  const attachmentHandlers = useAttachmentHandlers();

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | undefined>();
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Streaming and loading states
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistoricalConversation, setIsLoadingHistoricalConversation] = useState(false);
  const [isSwitchedConversation, setIsSwitchedConversation] = useState(false);
  const [streamingConversations, setStreamingConversations] = useState<Set<number>>(new Set());
  const [completedConversations, setCompletedConversations] = useState<Set<number>>(new Set());

  // Refs for controllers and timeouts
  const conversationControllersRef = useRef<Map<number, AbortController>>(new Map());
  const conversationTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSelectedConversationRef = useRef<number | null>(null);

  // Helper function to update last message in a conversation
  const updateLastMessageInConversation = useCallback((
    conversationId: number,
    updater: (lastMsg: ChatMessageType) => ChatMessageType
  ) => {
    const messages = messageManagement.getMessages(conversationId);
    if (messages.length === 0) return;
    
    const lastMsg = messages[messages.length - 1];
    const updatedMsg = updater(lastMsg);
    messageManagement.updateMessage(conversationId, lastMsg.id, updatedMsg);
  }, [messageManagement]);

  // UI Toggle Functions
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [sidebarOpen]);

  const toggleRightPanel = useCallback(() => {
    setShowRightPanel(!showRightPanel);
  }, [showRightPanel]);

  // Reset scroll to bottom state
  useEffect(() => {
    if (shouldScrollToBottom) {
      const timer = setTimeout(() => {
        setShouldScrollToBottom(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [shouldScrollToBottom]);

  // Reset right panel when conversation changes
  useEffect(() => {
    setSelectedMessageId(undefined);
    setShowRightPanel(false);
  }, [conversationManagement.conversationId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort(t("chatInterface.componentUnmount"));
        } catch (error) {
          log.error(t("chatInterface.errorCancelingRequest"), error);
        }
        abortControllerRef.current = null;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [t]);

  // Message selection handler
  const handleMessageSelect = useCallback((messageId: string) => {
    if (messageId !== selectedMessageId) {
      setSelectedMessageId(messageId);
      setShowRightPanel(true);
    } else {
      toggleRightPanel();
    }
  }, [selectedMessageId, toggleRightPanel]);

  // Image error handler wrapper
  const handleImageErrorWrapper = useCallback((imageUrl: string) => {
    handleImageError(imageUrl, messageManagement, conversationManagement.conversationId, t);
  }, [messageManagement, conversationManagement.conversationId, t]);

  // Opinion change handler
  const handleOpinionChange = useCallback(async (
    messageId: number,
    opinion: "Y" | "N" | null
  ) => {
    try {
      const { conversationService } = await import("@/services/conversationService");
      await conversationService.updateOpinion({
        message_id: messageId,
        opinion,
      });
      messageManagement.updateMessageGlobally(messageId.toString(), {
        opinion_flag: opinion || undefined,
      });
    } catch (error) {
      log.error(t("chatInterface.updateOpinionFailed"), error);
    }
  }, [messageManagement, t]);

  // Conversation list update handler
  const handleConversationListUpdate = useCallback(() => {
    conversationManagement.fetchConversationList().catch((err) => {
      log.error(t("chatInterface.failedToUpdateConversationList"), err);
    });
  }, [conversationManagement, t]);

  // Event listener for conversation list updates
  useEffect(() => {
    window.addEventListener("conversationListUpdated", handleConversationListUpdate);
    return () => {
      window.removeEventListener("conversationListUpdated", handleConversationListUpdate);
    };
  }, [handleConversationListUpdate]);

  return {
    // UI State
    sidebarOpen,
    showRightPanel,
    selectedMessageId,
    shouldScrollToBottom,
    selectedAgentId,
    openDropdownId,
    
    // Streaming and loading states
    isStreaming,
    isLoading,
    isLoadingHistoricalConversation,
    isSwitchedConversation,
    streamingConversations,
    completedConversations,
    
    // Refs
    conversationControllersRef,
    conversationTimeoutsRef,
    abortControllerRef,
    timeoutRef,
    currentSelectedConversationRef,
    
    // Setters
    setShowRightPanel,
    setSelectedMessageId,
    setShouldScrollToBottom,
    setSelectedAgentId,
    setOpenDropdownId,
    setIsStreaming,
    setIsLoading,
    setIsLoadingHistoricalConversation,
    setIsSwitchedConversation,
    setStreamingConversations,
    setCompletedConversations,
    
    // Functions
    toggleSidebar,
    toggleRightPanel,
    handleMessageSelect,
    handleImageErrorWrapper,
    handleOpinionChange,
    updateLastMessageInConversation,
  };
};
