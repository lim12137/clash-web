"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";

import { ROLE_ASSISTANT } from "@/const/agentConfig";
import { USER_ROLES } from "@/const/modelConfig";
import { useConfig } from "@/hooks/useConfig";
import { useAuth } from "@/hooks/useAuth";
import { conversationService } from "@/services/conversationService";
import { useConversationManagement } from "@/hooks/chat/useConversationManagement";
import { useMessageManagement } from "@/hooks/chat/useMessageManagement";
import { useAttachmentHandlers } from "@/hooks/chat/useAttachmentHandlers";
import { useChatUIState } from "@/hooks/chat/useChatUIState";

import { ChatSidebar } from "../components/chatLeftSidebar";
import { ChatHeader } from "../components/chatHeader";
import { ChatRightPanel } from "../components/chatRightPanel";
import { ChatStreamMain } from "../streaming/chatStreamMain";

import {
  preprocessAttachments,
  createPreprocessingMessage,
  updatePreprocessingStep,
  handlePreprocessingError,
} from "@/app/chat/internal/chatPreprocess";
import { loadAttachmentUrls } from "@/app/chat/internal/chatAttachment";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ConversationListItem, ApiConversationDetail } from "@/types/chat";
import { ChatMessageType } from "@/types/chat";
import { handleStreamResponse } from "@/app/chat/streaming/chatStreamHandler";
import {
  extractUserMsgFromResponse,
  extractAssistantMsgFromResponse,
} from "./extractMsgFromHistoryResponse";

import { X } from "lucide-react";
import log from "@/lib/logger";

const stepIdCounter = { current: 0 };

export function ChatInterface() {
  const router = useRouter();
  const { user } = useAuth(); // Get user information
  const [input, setInput] = useState("");
  
  // Use message management hook
  const messageManagement = useMessageManagement();
  
  // Use conversation management hook
  const conversationManagement = useConversationManagement();
  
  // Use UI state management hook
  const uiState = useChatUIState();
  
  const { t } = useTranslation("common");
  const { appConfig } = useConfig();

  // Use attachment handlers hook
  const attachmentHandlers = useAttachmentHandlers();

  // Place the declaration of currentMessages after the definition of selectedConversationId
  // If a historical conversation is being loaded and there are no cached messages, return an empty array to avoid displaying error content
  const currentMessages = conversationManagement.selectedConversationId
    ? messageManagement.getMessages(conversationManagement.selectedConversationId)
    : [];

  // Monitor changes in currentMessages
  // Calculate if the current conversation is streaming
  const isCurrentConversationStreaming =
    conversationManagement.conversationId && conversationManagement.conversationId !== -1
      ? uiState.streamingConversations.has(conversationManagement.conversationId)
      : false;


  useEffect(() => {
    if (!conversationManagement.initialized.current) {
      conversationManagement.initialized.current = true;

      // Get conversation history list, but don't auto-select the latest conversation
      conversationManagement.fetchConversationList()
        .then((dialogData) => {
          // Create new conversation by default regardless of history
          handleNewConversation();
        })
        .catch((err) => {
          log.error(t("chatInterface.errorFetchingConversationList"), err);
          // Create new conversation even if getting conversation list fails
          handleNewConversation();
        });
    }
  }, [appConfig]); // Add appConfig as dependency


  const handleSend = async () => {
    if (!input.trim() && attachmentHandlers.attachments.length === 0) return; // Allow sending attachments only, without text content

    // Flag to track if we should reset button states in finally block
    let shouldResetButtonStates = true;

    // If in new conversation state, switch to conversation state after sending message
    if (conversationManagement.isNewConversation) {
      conversationManagement.setIsNewConversation(false);
    }

    // Ensure right sidebar doesn't auto-expand when sending new message
    uiState.setSelectedMessageId(undefined);
    uiState.setShowRightPanel(false);

    // Handle user message content
    const userMessageId = uuidv4();
    const userMessageContent = input.trim();

    // Get current conversation ID
    let currentConversationId = conversationManagement.conversationId;

    // Ensure ref reflects the current conversation state
    if (currentConversationId && currentConversationId !== -1) {
      conversationManagement.currentSelectedConversationRef.current = currentConversationId;
    }

    // Prepare attachment information
    // Handle file upload
    let uploadedFileUrls: Record<string, string> = {};
    let objectNames: Record<string, string> = {}; // Add object name mapping

    if (attachmentHandlers.attachments.length > 0) {
      // Show loading state
      uiState.setIsLoading(true);

      // Use attachment handlers to upload attachments
      const uploadResult = await attachmentHandlers.uploadAttachmentsToStorage();
      uploadedFileUrls = uploadResult.uploadedFileUrls;
      objectNames = uploadResult.objectNames; // Get object name mapping
    }

    // Use attachment handlers to create message attachments
    const messageAttachments = attachmentHandlers.createMessageAttachmentsFromCurrent(
      uploadedFileUrls
    );

    // Create user message object
    const userMessage: ChatMessageType = {
      id: userMessageId,
      role: USER_ROLES.USER,
      content: userMessageContent,
      timestamp: new Date(),
      attachments:
        messageAttachments.length > 0 ? messageAttachments : undefined,
    };

    // Clear input box and attachments
    setInput("");
    attachmentHandlers.clearAttachments();

    // Create initial AI reply message
    const assistantMessageId = uuidv4();
    const initialAssistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: ROLE_ASSISTANT,
      content: "",
      timestamp: new Date(),
      isComplete: false,
      steps: [],
    };

    // Send message and scroll to bottom
    uiState.setShouldScrollToBottom(true);

    uiState.setIsLoading(true);
    uiState.setIsStreaming(true); // Set streaming state to true

    // Create independent AbortController for current conversation
    const currentController = new AbortController();

    try {
      // Check if need to create new conversation
      if (!currentConversationId || currentConversationId === -1) {
        // If no session ID or ID is -1, create new conversation first
        try {
          const createData = await conversationService.create(
            t("chatInterface.newConversation")
          );
          currentConversationId = createData.conversation_id;

          // Update current session state
          conversationManagement.setConversationId(currentConversationId);
          conversationManagement.setSelectedConversationId(currentConversationId);
          // Update ref to track current selected conversation
          conversationManagement.currentSelectedConversationRef.current = currentConversationId;
          conversationManagement.setConversationTitle(
            createData.conversation_title || t("chatInterface.newConversation")
          );

          // After creating new conversation, add it to streaming list
          uiState.setStreamingConversations((prev) => {
            const newSet = new Set(prev).add(currentConversationId);

            return newSet;
          });

          // Refresh conversation list
          try {
            const dialogList = await conversationManagement.fetchConversationList();
            const newDialog = dialogList.find(
              (dialog) => dialog.conversation_id === currentConversationId
            );
            if (newDialog) {
              conversationManagement.setSelectedConversationId(currentConversationId);
            }
          } catch (error) {
            log.error(
              t("chatInterface.refreshDialogListFailedButContinue"),
              error
            );
          }
        } catch (error) {
          log.error(
            t("chatInterface.createDialogFailedButContinue"),
            error
          );
          // Reset button states when conversation creation fails
          uiState.setIsLoading(false);
          uiState.setIsStreaming(false);
          return;
        }
      }

      // Ensure valid conversation ID before registering controller and streaming state
      if (currentConversationId && currentConversationId !== -1) {
        uiState.conversationControllersRef.current.set(
          currentConversationId,
          currentController
        );
        uiState.setStreamingConversations((prev) => {
          const newSet = new Set(prev);
          newSet.add(currentConversationId);
          return newSet;
        });
      }

      // Now add messages after conversation is created/confirmed
      // 1. When sending user message, complete ChatMessageType fields
      messageManagement.addMessage(currentConversationId, {
        ...userMessage,
        id: userMessage.id || uuidv4(),
        timestamp: userMessage.timestamp || new Date(),
        isComplete: userMessage.isComplete ?? true,
        steps: userMessage.steps || [],
        attachments: userMessage.attachments || [],
        images: userMessage.images || [],
      });

      // 2. When adding AI reply message, complete ChatMessageType fields
      messageManagement.addMessage(currentConversationId, {
        ...initialAssistantMessage,
        id: initialAssistantMessage.id || uuidv4(),
        timestamp: initialAssistantMessage.timestamp || new Date(),
        isComplete: initialAssistantMessage.isComplete ?? false,
        steps: initialAssistantMessage.steps || [],
        attachments: initialAssistantMessage.attachments || [],
        images: initialAssistantMessage.images || [],
      });

      // If there are attachment files, preprocess first
      let finalQuery = userMessage.content;
      // Declare a variable to save file description information
      let fileDescriptionsMap: Record<string, string> = {};

      if (attachmentHandlers.attachments.length > 0) {
        // Attachment preprocessing step, as independent step in assistant steps
        const preprocessingMessage = createPreprocessingMessage(t);
        messageManagement.addMessage(currentConversationId, preprocessingMessage);

        // Buffer for truncation messages with deduplication
        const truncationBuffer: any[] = [];
        const processedTruncationIds = new Set<string>(); // Track processed truncation messages to avoid duplicates

        // Use extracted preprocessing function to process attachments
        const result = await preprocessAttachments(
          userMessage.content,
          attachmentHandlers.attachments,
          currentController.signal,
          (jsonData) => {
            uiState.updateLastMessageInConversation(currentConversationId, (lastMsg) => {
              return updatePreprocessingStep(
                lastMsg,
                jsonData,
                t,
                truncationBuffer,
                processedTruncationIds
              );
            });
          },
          t,
          currentConversationId
        );

        // Handle preprocessing result
        if (!result.success) {
          // Reset button states immediately when preprocessing fails
          uiState.setIsLoading(false);
          uiState.setIsStreaming(false);
            
          // Remove from streaming conversations (both new and existing conversations)
          if (currentConversationId) {
            uiState.setStreamingConversations((prev) => {
              const newSet = new Set(prev);
              newSet.delete(currentConversationId);
              return newSet;
            });
          }
          
          uiState.updateLastMessageInConversation(currentConversationId, (lastMsg) => {
            return handlePreprocessingError(lastMsg, result.error || "", t);
          });
          shouldResetButtonStates = false; // Don't reset again in finally block
          return;
        }

        finalQuery = result.finalQuery;
        fileDescriptionsMap = result.fileDescriptions || {};
      }

      // Send request to backend API, add signal parameter
      const runAgentParams: any = {
        query: finalQuery, // Use preprocessed query or original query
        conversation_id: currentConversationId,
        is_set: uiState.isSwitchedConversation || currentMessages.length <= 1,
        history: currentMessages
          .filter((msg) => msg.id !== userMessage.id)
          .map((msg) => ({
            role: msg.role,
            content:
              msg.role === ROLE_ASSISTANT
                ? msg.finalAnswer?.trim() || msg.content || ""
                : msg.content || "",
          })),
        minio_files:
          messageAttachments.length > 0
            ? messageAttachments.map((attachment: any) => {
                // Get file description
                let description = "";
                if (attachment.name in fileDescriptionsMap) {
                  description = fileDescriptionsMap[attachment.name];
                }

                return {
                  object_name: objectNames[attachment.name] || "",
                  name: attachment.name,
                  type: attachment.type,
                  size: attachment.size,
                  url: uploadedFileUrls[attachment.name] || attachment.url,
                  description: description,
                };
              })
            : undefined, // Use complete attachment object structure
      };

      // Only add agent_id if it's not null
      if (uiState.selectedAgentId !== null) {
        runAgentParams.agent_id = uiState.selectedAgentId;
      }

      const reader = await conversationService.runAgent(
        runAgentParams,
        currentController.signal
      );

      if (!reader) throw new Error("Response body is null");

      // Create dynamic setCurrentSessionMessages in handleSend function
      // setCurrentSessionMessages factory function
      const setCurrentSessionMessagesFactory =
        (
          targetConversationId: number
        ): React.Dispatch<React.SetStateAction<ChatMessageType[]>> =>
        (valueOrUpdater) => {
          const currentMessages = messageManagement.getMessages(targetConversationId);
          let nextArr: ChatMessageType[];
          if (typeof valueOrUpdater === "function") {
            nextArr = (
              valueOrUpdater as (prev: ChatMessageType[]) => ChatMessageType[]
            )(currentMessages);
          } else {
            nextArr = valueOrUpdater;
          }
          // Update messages using message management
          messageManagement.setMessages(targetConversationId, nextArr);
        };

      // Create resetTimeout function for current conversation
      const resetTimeout = () => {
        const timeout = uiState.conversationTimeoutsRef.current.get(
          currentConversationId
        );
        if (timeout) {
          clearTimeout(timeout);
        }
        const newTimeout = setTimeout(async () => {
          const controller = uiState.conversationControllersRef.current.get(
            currentConversationId
          );
          if (controller && !controller.signal.aborted) {
            try {
              controller.abort(t("chatInterface.requestTimeout"));

              uiState.updateLastMessageInConversation(currentConversationId, (lastMsg) => {
                if (lastMsg.role === ROLE_ASSISTANT) {
                  lastMsg.error = t("chatInterface.requestTimeoutRetry");
                  lastMsg.isComplete = true;
                  lastMsg.thinking = undefined;
                }
                return lastMsg;
              });

              if (currentConversationId && currentConversationId !== -1) {
                try {
                  await conversationService.stop(currentConversationId);
                } catch (error) {
                  log.error(
                    t("chatInterface.stopTimeoutRequestFailed"),
                    error
                  );
                }
              }
            } catch (error) {
              log.error(t("chatInterface.errorCancelingRequest"), error);
            }
          }
          uiState.conversationTimeoutsRef.current.delete(currentConversationId);
        }, 120000);
        uiState.conversationTimeoutsRef.current.set(currentConversationId, newTimeout);
      };

      // Before processing streaming response, set an initial timeout first
      resetTimeout();

      // Call streaming processing function to handle response
      // Compatible with both function and direct assignment
      await handleStreamResponse(
        reader,
        setCurrentSessionMessagesFactory(currentConversationId),
        resetTimeout,
        stepIdCounter,
        uiState.setIsSwitchedConversation,
        conversationManagement.isNewConversation,
        conversationManagement.setConversationTitle,
        conversationManagement.fetchConversationList,
        currentConversationId,
        conversationService,
        false, // isDebug: false for normal chat mode
        t
      );

      // Reset all related states
      uiState.setIsLoading(false);
      uiState.setIsStreaming(false);

      // Clean up controller and timeout for current conversation
      uiState.conversationControllersRef.current.delete(currentConversationId);
      const timeout = uiState.conversationTimeoutsRef.current.get(
        currentConversationId
      );
      if (timeout) {
        clearTimeout(timeout);
        uiState.conversationTimeoutsRef.current.delete(currentConversationId);
      }

      // Remove from streaming list (only when conversationId is not -1)
      if (currentConversationId !== -1) {
        uiState.setStreamingConversations((prev) => {
          const newSet = new Set(prev);
          newSet.delete(currentConversationId);
          return newSet;
        });

        // When conversation is completed, only add to completed conversation list when user is not in current conversation interface
        // Use ref to get the actual conversation the user is in
        const currentUserConversation = uiState.currentSelectedConversationRef.current;
        if (currentUserConversation !== currentConversationId) {
          uiState.setCompletedConversations((prev) => {
            const newSet = new Set(prev);
            newSet.add(currentConversationId);
            return newSet;
          });
        }
      }

      // Note: Save operation is already implemented in agent run API, no need to save again in frontend
    } catch (error) {
      // If user actively canceled, don't show error message
      const err = error as Error;
      if (err.name === "AbortError") {
        uiState.updateLastMessageInConversation(currentConversationId, (lastMsg) => {
          if (lastMsg.role === ROLE_ASSISTANT) {
            lastMsg.content = t("chatInterface.conversationStopped");
            lastMsg.isComplete = true;
            lastMsg.thinking = undefined; // Explicitly clear thinking state
          }
          return lastMsg;
        });
      } else {
        log.error(t("chatInterface.errorLabel"), error);
        // Show user-friendly error message instead of technical error details
        const errorMessage = t("chatInterface.errorProcessingRequest");
        uiState.updateLastMessageInConversation(currentConversationId, (lastMsg) => {
          if (lastMsg.role === ROLE_ASSISTANT) {
            lastMsg.content = errorMessage;
            lastMsg.isComplete = true;
            lastMsg.error = errorMessage;
            lastMsg.thinking = undefined; // Explicitly clear thinking state
          }
          return lastMsg;
        });
      }

      uiState.setIsLoading(false);
      uiState.setIsStreaming(false);

      // Clean up controller and timeout for current conversation
      uiState.conversationControllersRef.current.delete(currentConversationId);
      const timeout = uiState.conversationTimeoutsRef.current.get(
        currentConversationId
      );
      if (timeout) {
        clearTimeout(timeout);
        uiState.conversationTimeoutsRef.current.delete(currentConversationId);
      }

      // Remove from streaming list (only when conversationId is not -1)
      if (currentConversationId !== -1) {
        uiState.setStreamingConversations((prev) => {
          const newSet = new Set(prev);
          newSet.delete(currentConversationId);
          return newSet;
        });

        // When conversation is completed, only add to completed conversation list when user is not in current conversation interface
        // Use ref to get the actual conversation the user is in
        const currentUserConversation = uiState.currentSelectedConversationRef.current;
        if (currentUserConversation !== currentConversationId) {
          uiState.setCompletedConversations((prev) => {
            const newSet = new Set(prev);
            newSet.add(currentConversationId);
            return newSet;
          });
        }
      }
    } finally {
      // Only reset button states if we should (not when preprocessing fails)
      if (shouldResetButtonStates) {
        uiState.setIsLoading(false);
        uiState.setIsStreaming(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = async () => {
    // When creating new conversation, keep all existing SSE connections active
    // Do not cancel any conversation requests, let them continue running in the background

    // Record current running conversation
    if (uiState.streamingConversations.size > 0) {
      // Keep existing SSE connections active
    }

    // Reset all states
    setInput("");
    uiState.setIsLoading(false);
    uiState.setIsSwitchedConversation(false);
    
    // Use conversation management hook
    conversationManagement.handleNewConversation();
    uiState.setIsLoadingHistoricalConversation(false); // Ensure not loading historical conversation

    // Reset streaming state
    uiState.setIsStreaming(false);

    // Reset selected message and right panel state
    uiState.setSelectedMessageId(undefined);
    uiState.setShowRightPanel(false);

    // Reset attachment state
    attachmentHandlers.clearAttachments();

    // Clear URL parameters
    const url = new URL(window.location.href);
    if (url.searchParams.has("q")) {
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url.toString());
    }

    // Wait for all state updates to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Ensure new conversation scrolls to bottom
    uiState.setShouldScrollToBottom(true);
  };


  // When switching conversation, automatically load messages
  const handleDialogClick = async (dialog: ConversationListItem) => {
    // When switching conversation, keep all SSE connections active
    // Do not cancel any conversation requests, let them continue running in the background

    // Use conversation management hook
    conversationManagement.handleConversationSelect(dialog);
    uiState.setSelectedMessageId(undefined);
    uiState.setShowRightPanel(false);

    // When user views conversation, clear completed state
    uiState.setCompletedConversations((prev) => {
      const newSet = new Set(prev);
      newSet.delete(dialog.conversation_id);
      return newSet;
    });

    // Check if there are cached messages
    const hasCachedMessages =
      messageManagement.hasMessages(dialog.conversation_id);
    const isCurrentActive = dialog.conversation_id === conversationManagement.conversationId;

    // Log: click conversation
    // If there are cached messages, ensure not to show loading state
    if (hasCachedMessages) {
      const cachedMessages = messageManagement.getMessages(dialog.conversation_id);
      // If cache is empty array, force reload historical messages
      if (cachedMessages && cachedMessages.length === 0) {
        uiState.setIsLoadingHistoricalConversation(true);
        uiState.setIsLoading(true);

        try {
          // Create new AbortController for current request
          const controller = new AbortController();

          // Set timeout timer - 120 seconds
          uiState.timeoutRef.current = setTimeout(() => {
            if (controller && !controller.signal.aborted) {
              try {
                controller.abort(t("chatInterface.requestTimeout"));
              } catch (error) {
                log.error(t("chatInterface.errorCancelingRequest"), error);
              }
            }
            uiState.timeoutRef.current = null;
          }, 120000);

          // Save current controller reference
          uiState.abortControllerRef.current = controller;

          // Use controller.signal to make request with timeout
          const data = await conversationService.getDetail(
            dialog.conversation_id,
            controller.signal
          );

          // Clear timeout timer after request completes
          if (uiState.timeoutRef.current) {
            clearTimeout(uiState.timeoutRef.current);
            uiState.timeoutRef.current = null;
          }

          // Don't process result if request was canceled
          if (controller.signal.aborted) {
            return;
          }

          if (data.code === 0 && data.data && data.data.length > 0) {
            const conversationData = data.data[0] as ApiConversationDetail;
            const dialogMessages = conversationData.message || [];

            // Immediately process messages, do not use setTimeout
            const formattedMessages: ChatMessageType[] = [];

            // Optimized processing logic: process messages by role one by one, maintain original order
            dialogMessages.forEach((dialog_msg, index) => {
              if (dialog_msg.role === USER_ROLES.USER) {
                const formattedUserMsg: ChatMessageType =
                  extractUserMsgFromResponse(
                    dialog_msg,
                    index,
                    conversationData.create_time
                  );
                formattedMessages.push(formattedUserMsg);
              } else if (dialog_msg.role === ROLE_ASSISTANT) {
                const formattedAssistantMsg: ChatMessageType =
                  extractAssistantMsgFromResponse(
                    dialog_msg,
                    index,
                    conversationData.create_time,
                    t
                  );
                formattedMessages.push(formattedAssistantMsg);
              }
            });

            // Update message array
            messageManagement.setMessages(dialog.conversation_id, formattedMessages);

            // Clear any previous error for this conversation
            conversationManagement.clearConversationLoadError(dialog.conversation_id);

            // Asynchronously load all attachment URLs
            loadAttachmentUrls(formattedMessages, dialog.conversation_id, messageManagement, t);

            // Trigger scroll to bottom
            uiState.setShouldScrollToBottom(true);

            // Reset shouldScrollToBottom after a delay to ensure scrolling completes.
            setTimeout(() => {
              uiState.setShouldScrollToBottom(false);
            }, 1000);

            // Refresh history list
            conversationManagement.fetchConversationList().catch((err) => {
              log.error(
                t("chatInterface.refreshDialogListFailedButContinue"),
                err
              );
            });
          } else {
            // No longer empty cache, only prompt no history messages
            conversationManagement.setConversationLoadErrorForId(
              dialog.conversation_id,
              t("chatStreamMain.noHistory") || "该会话无历史消息"
            );
          }
        } catch (error) {
          log.error(
            t("chatInterface.errorFetchingConversationDetailsError"),
            error
          );
          // if error, don't set empty array, keep existing state to avoid showing new conversation interface
          // Instead, we can show an error message or retry mechanism

          conversationManagement.setConversationLoadErrorForId(dialog.conversation_id, "Failed to load conversation");
        } finally {
          // ensure loading state is cleared
          uiState.setIsLoading(false);
          uiState.setIsLoadingHistoricalConversation(false);
        }
      } else {
        // Cache has content, display normally
        uiState.setIsLoadingHistoricalConversation(false);
        uiState.setIsLoading(false); // Ensure isLoading state is also reset

        // For cases where there are cached messages, also trigger scrolling to the bottom.
        uiState.setShouldScrollToBottom(true);
        setTimeout(() => {
          uiState.setShouldScrollToBottom(false);
        }, 1000);
      }
    }

    // If there are no cached messages and not current active conversation, load historical messages
    if (!hasCachedMessages && !isCurrentActive) {
      // Set loading historical conversation state
      uiState.setIsLoadingHistoricalConversation(true);
      uiState.setIsLoading(true);

      try {
        // Create new AbortController for current request
        const controller = new AbortController();

        // Set timeout timer - 120 seconds
        uiState.timeoutRef.current = setTimeout(() => {
          if (controller && !controller.signal.aborted) {
            try {
              controller.abort(t("chatInterface.requestTimeout"));
            } catch (error) {
              log.error(t("chatInterface.errorCancelingRequest"), error);
            }
          }
          uiState.timeoutRef.current = null;
        }, 120000);

        // Save current controller reference
        uiState.abortControllerRef.current = controller;

        // Use controller.signal to make request with timeout
        const data = await conversationService.getDetail(
          dialog.conversation_id,
          controller.signal
        );

        // Clear timeout timer after request completes
        if (uiState.timeoutRef.current) {
          clearTimeout(uiState.timeoutRef.current);
          uiState.timeoutRef.current = null;
        }

        // Don't process result if request was canceled
        if (controller.signal.aborted) {
          return;
        }

        if (data.code === 0 && data.data && data.data.length > 0) {
          const conversationData = data.data[0] as ApiConversationDetail;
          const dialogMessages = conversationData.message || [];

          // Immediately process messages, do not use setTimeout
          const formattedMessages: ChatMessageType[] = [];

          // Optimized processing logic: process messages by role one by one, maintain original order
          dialogMessages.forEach((dialog_msg, index) => {
            if (dialog_msg.role === USER_ROLES.USER) {
              const formattedUserMsg: ChatMessageType =
                extractUserMsgFromResponse(
                  dialog_msg,
                  index,
                  conversationData.create_time
                );
              formattedMessages.push(formattedUserMsg);
            } else if (dialog_msg.role === ROLE_ASSISTANT) {
              const formattedAssistantMsg: ChatMessageType =
                extractAssistantMsgFromResponse(
                  dialog_msg,
                  index,
                  conversationData.create_time,
                  t
                );
              formattedMessages.push(formattedAssistantMsg);
            }
          });

          // Update message array
          messageManagement.setMessages(dialog.conversation_id, formattedMessages);

          // Clear any previous error for this conversation
          conversationManagement.clearConversationLoadError(dialog.conversation_id);

          // Asynchronously load all attachment URLs
          loadAttachmentUrls(formattedMessages, dialog.conversation_id, messageManagement, t);

          // Trigger scroll to bottom
          uiState.setShouldScrollToBottom(true);

          // Reset shouldScrollToBottom after a delay to ensure scrolling completes.
          setTimeout(() => {
            uiState.setShouldScrollToBottom(false);
          }, 1000);

          // Refresh history list
          conversationManagement.fetchConversationList().catch((err) => {
            log.error(
              t("chatInterface.refreshDialogListFailedButContinue"),
              err
            );
          });
        } else {
          // No longer empty cache, only prompt no history messages
          conversationManagement.setConversationLoadErrorForId(
            dialog.conversation_id,
            t("chatStreamMain.noHistory") || "该会话无历史消息"
          );
        }
      } catch (error) {
        log.error(
          t("chatInterface.errorFetchingConversationDetailsError"),
          error
        );
        // if error, don't set empty array, keep existing state to avoid showing new conversation interface
        // Instead, we can show an error message or retry mechanism

        conversationManagement.setConversationLoadErrorForId(dialog.conversation_id, "Failed to load conversation");
      } finally {
        // ensure loading state is cleared
        uiState.setIsLoading(false);
        uiState.setIsLoadingHistoricalConversation(false);
      }
    }
  };


  // Left sidebar conversation title update
  const handleConversationRename = async (dialogId: number, title: string) => {
    try {
      await conversationService.rename(dialogId, title);
      await conversationManagement.fetchConversationList();

      if (conversationManagement.selectedConversationId === dialogId) {
        conversationManagement.setConversationTitle(title);
      }
    } catch (error) {
      log.error(t("chatInterface.renameFailed"), error);
    }
  };

  // Left sidebar conversation deletion
  const handleConversationDeleteClick = async (dialogId: number) => {
    try {
      // If deleting the currently active conversation, stop conversation first
      if (
        conversationManagement.selectedConversationId === dialogId &&
        uiState.isStreaming &&
        conversationManagement.conversationId === dialogId
      ) {
        // Cancel current ongoing request first
        if (uiState.abortControllerRef.current) {
          try {
            uiState.abortControllerRef.current.abort(
              t("chatInterface.deleteConversation")
            );
          } catch (error) {
            log.error(t("chatInterface.errorCancelingRequest"), error);
          }
          uiState.abortControllerRef.current = null;
        }

        // Clear timeout timer
        if (uiState.timeoutRef.current) {
          clearTimeout(uiState.timeoutRef.current);
          uiState.timeoutRef.current = null;
        }

        uiState.setIsStreaming(false);
        uiState.setIsLoading(false);

        try {
          await conversationService.stop(dialogId);
        } catch (error) {
          log.error(
            t("chatInterface.stopConversationToDeleteFailed"),
            error
          );
          // Continue deleting even if stopping fails
        }
      }

      await conversationService.delete(dialogId);
      await conversationManagement.fetchConversationList();

      if (conversationManagement.selectedConversationId === dialogId) {
        conversationManagement.setSelectedConversationId(null);
        // Update ref to track current selected conversation
        conversationManagement.currentSelectedConversationRef.current = null;
        conversationManagement.setConversationTitle(t("chatInterface.newConversation"));
        handleNewConversation();
      }
    } catch (error) {
      log.error(t("chatInterface.deleteFailed"), error);
    }
  };

  // Handle image click preview - now handled by attachmentHandlers

  // Add conversation stop handling function
  const handleStop = async () => {
    // Stop agent_run of current conversation
    const currentController =
      uiState.conversationControllersRef.current.get(conversationManagement.conversationId);
    if (currentController) {
      try {
        currentController.abort(t("chatInterface.userManuallyStopped"));
      } catch (error) {
        log.error(t("chatInterface.errorCancelingRequest"), error);
      }
      uiState.conversationControllersRef.current.delete(conversationManagement.conversationId);
    }

    // Clear timeout timer for current conversation
    const currentTimeout = uiState.conversationTimeoutsRef.current.get(conversationManagement.conversationId);
    if (currentTimeout) {
      clearTimeout(currentTimeout);
      uiState.conversationTimeoutsRef.current.delete(conversationManagement.conversationId);
    }

    // Immediately update frontend state
    uiState.setIsStreaming(false);
    uiState.setIsLoading(false);

    // If no valid conversation ID, just reset frontend state
    if (!conversationManagement.conversationId || conversationManagement.conversationId === -1) {
      return;
    }

    try {
      // Call backend stop API - this will stop both agent run and preprocess tasks
      await conversationService.stop(conversationManagement.conversationId);

      // Manually update messages, clear thinking state
      uiState.updateLastMessageInConversation(conversationManagement.conversationId, (lastMsg) => {
        if (lastMsg.role === ROLE_ASSISTANT) {
          lastMsg.isComplete = true;
          lastMsg.thinking = undefined; // Explicitly clear thinking state

          // If this was a preprocess step, mark it as stopped
          if (lastMsg.steps && lastMsg.steps.length > 0) {
            const preprocessStep = lastMsg.steps.find(
              (step) => step.title === t("chatInterface.filePreprocessing")
            );
            if (preprocessStep) {
              const stoppedMessage =
                (t("chatInterface.filePreprocessingStopped") as string) ||
                "File preprocessing stopped";
              preprocessStep.content = stoppedMessage;
              if (
                preprocessStep.contents &&
                preprocessStep.contents.length > 0
              ) {
                preprocessStep.contents[0].content = stoppedMessage;
              }
            }
          }
        }
        return lastMsg;
      });

      // remove from streaming list
      uiState.setStreamingConversations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(conversationManagement.conversationId);
        return newSet;
      });

      // when conversation is stopped, only add to completed conversations list when user is not in current conversation interface
      const currentUserConversation = uiState.currentSelectedConversationRef.current;
      if (currentUserConversation !== conversationManagement.conversationId) {
        uiState.setCompletedConversations((prev) => {
          const newSet = new Set(prev);
          newSet.add(conversationManagement.conversationId);
          return newSet;
        });
      }
    } catch (error) {
      log.error(t("chatInterface.stopConversationFailed"), error);

      // Optionally show error message
      uiState.updateLastMessageInConversation(conversationManagement.conversationId, (lastMsg) => {
        if (lastMsg.role === ROLE_ASSISTANT) {
          lastMsg.isComplete = true;
          lastMsg.thinking = undefined; // Explicitly clear thinking state
          lastMsg.error = t(
            "chatInterface.stopConversationFailedButFrontendStopped"
          );
        }
        return lastMsg;
      });
    }
  };

  // Top title rename function
  const handleTitleRename = async (newTitle: string) => {
    if (conversationManagement.selectedConversationId && newTitle !== conversationManagement.conversationTitle) {
      try {
        await conversationManagement.updateConversationTitle(conversationManagement.selectedConversationId, newTitle);
      } catch (error) {
        log.error(t("chatInterface.renameFailed"), error);
      }
    }
  };


  return (
    <>
      <div className="flex h-screen">
        <ChatSidebar
          conversationList={conversationManagement.conversationList}
          selectedConversationId={conversationManagement.selectedConversationId}
          openDropdownId={uiState.openDropdownId}
          streamingConversations={uiState.streamingConversations}
          completedConversations={uiState.completedConversations}
          onNewConversation={handleNewConversation}
          onDialogClick={handleDialogClick}
          onRename={handleConversationRename}
          onDelete={handleConversationDeleteClick}
          onSettingsClick={() => {
            localStorage.setItem(
              "show_page",
              user?.role === "admin" ? "1" : "2"
            );
            router.push("/setup");
          }}
          onDropdownOpenChange={(open: boolean, id: string | null) =>
            uiState.setOpenDropdownId(open ? id : null)
          }
          onToggleSidebar={uiState.toggleSidebar}
          expanded={uiState.sidebarOpen}
          userEmail={user?.email}
          userAvatarUrl={user?.avatar_url}
          userRole={user?.role}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col">
              <ChatHeader
                title={conversationManagement.conversationTitle}
                onRename={handleTitleRename}
              />

              <ChatStreamMain
                messages={currentMessages}
                input={input}
                isLoading={uiState.isLoading}
                isStreaming={isCurrentConversationStreaming}
                isLoadingHistoricalConversation={
                  uiState.isLoadingHistoricalConversation
                }
                conversationLoadError={
                  conversationManagement.conversationLoadError[conversationManagement.selectedConversationId || 0]
                }
                onInputChange={(value: string) => setInput(value)}
                onSend={handleSend}
                onStop={handleStop}
                onKeyDown={handleKeyDown}
                onSelectMessage={uiState.handleMessageSelect}
                selectedMessageId={uiState.selectedMessageId}
                onImageClick={attachmentHandlers.handleImageClick}
                attachments={attachmentHandlers.attachments}
                onAttachmentsChange={attachmentHandlers.handleAttachmentsChange}
                onFileUpload={attachmentHandlers.handleFileUpload}
                onImageUpload={attachmentHandlers.handleImageUpload}
                onOpinionChange={uiState.handleOpinionChange}
                currentConversationId={conversationManagement.conversationId}
                shouldScrollToBottom={uiState.shouldScrollToBottom}
                selectedAgentId={uiState.selectedAgentId}
                onAgentSelect={uiState.setSelectedAgentId}
              />
            </div>

            <ChatRightPanel
              messages={currentMessages}
              onImageError={uiState.handleImageErrorWrapper}
              maxInitialImages={14}
              isVisible={uiState.showRightPanel}
              toggleRightPanel={uiState.toggleRightPanel}
              selectedMessageId={uiState.selectedMessageId}
            />
          </div>
        </div>
      </div>
      <TooltipProvider>
        <Tooltip open={false}>
          <TooltipTrigger asChild>
            <div className="fixed inset-0 pointer-events-none" />
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="center"
            className="absolute bottom-24 left-1/2 transform -translate-x-1/2"
          >
            {t("chatInterface.stopGenerating")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Image preview */}
      {attachmentHandlers.viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={attachmentHandlers.closeImageViewer}
        >
          <div
            className="relative max-w-[90%] max-h-[90%]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={attachmentHandlers.viewingImage}
              alt={t("chatInterface.imagePreview")}
              className="max-w-full max-h-[90vh] object-contain"
              onError={() => {
                uiState.handleImageErrorWrapper(attachmentHandlers.viewingImage!);
              }}
            />
            <button
              onClick={attachmentHandlers.closeImageViewer}
              className="absolute -top-4 -right-4 bg-white p-1 rounded-full shadow-md hover:bg-white transition-colors"
              title={t("chatInterface.close")}
            >
              <X
                size={16}
                className="text-gray-600 hover:text-red-500 transition-colors"
              />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
