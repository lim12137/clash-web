"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { useConfig } from "@/hooks/useConfig"
import { conversationService } from '@/services/conversationService';
import { storageService } from '@/services/storageService';
import { useAuth } from "@/hooks/useAuth"
import { useTranslation } from 'react-i18next';

import { ChatSidebar } from "@/app/chat/layout/chatLeftSidebar"
import { FilePreview } from "@/app/chat/layout/chatInput"
import { ChatHeader } from "@/app/chat/layout/chatHeader"
import { ChatRightPanel } from "@/app/chat/layout/chatRightPanel"
import { ChatStreamMain } from "@/app/chat/streaming/chatStreamMain"

import {
  preprocessAttachments,
  handleFileUpload as preProcessHandleFileUpload,
  handleImageUpload as preProcessHandleImageUpload,
  uploadAttachments,
  createMessageAttachments,
  cleanupAttachmentUrls
} from "@/app/chat/internal/chatPreprocess"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { ConversationListItem, ApiConversationDetail } from '@/types/chat'
import { ChatMessageType, AgentStep } from '@/types/chat'
import { handleStreamResponse } from "@/app/chat/streaming/chatStreamHandler"
import { extractUserMsgFromResponse, extractAssistantMsgFromResponse } from "./extractMsgFromHistoryResponse"

import { X } from "lucide-react"

const stepIdCounter = {current: 0};

export function ChatInterface() {
  const router = useRouter()
  const { user } = useAuth() // 获取用户信息
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [isSwitchedConversation, setIsSwitchedConversation] = useState(false) // Add conversation switching tracking state
  const [isLoading, setIsLoading] = useState(false)
  const initialized = useRef(false)
  const { t } = useTranslation('common');
  const [appName, setAppName] = useState(t("chatInterface.newApp"))
  const [conversationTitle, setConversationTitle] = useState(t("chatInterface.newConversation"))
  const [conversationId, setConversationId] = useState<number>(0)
  const [conversationList, setConversationList] = useState<ConversationListItem[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const { appConfig } = useConfig()

  const [viewingImage, setViewingImage] = useState<string | null>(null)

  // Add attachment state management
  const [attachments, setAttachments] = useState<FilePreview[]>([]);
  const [fileUrls, setFileUrls] = useState<{[id: string]: string}>({});

  const [isStreaming, setIsStreaming] = useState(false) // Add streaming state
  const abortControllerRef = useRef<AbortController | null>(null) // Add AbortController reference
  const timeoutRef = useRef<NodeJS.Timeout | null>(null) // Add timeout reference

  // Add sidebar state control
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Add a new state for new conversation status
  const [isNewConversation, setIsNewConversation] = useState(true)

  // Ensure right sidebar is closed by default
  const [showRightPanel, setShowRightPanel] = useState(false)

  const [selectedMessageId, setSelectedMessageId] = useState<string | undefined>();

  // Add force scroll to bottom state control
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);

  // Reset scroll to bottom state
  useEffect(() => {
    if (shouldScrollToBottom) {
      // Give enough time for scrolling to complete, then reset state
      const timer = setTimeout(() => {
        setShouldScrollToBottom(false);
      }, 1200); // Slightly longer than the last scroll delay in ChatStreamMain
      
      return () => clearTimeout(timer);
    }
  }, [shouldScrollToBottom]);

  // Add attachment cleanup function - cleanup URLs when component unmounts
  useEffect(() => {
    return () => {
      // Use preprocessing function to cleanup URLs
      cleanupAttachmentUrls(attachments, fileUrls);
    };
  }, [attachments, fileUrls]);

  // Handle file upload
  const handleFileUpload = (file: File) => {
    return preProcessHandleFileUpload(file, setFileUrls);
  };

  // Handle image upload
  const handleImageUpload = (file: File) => {
    preProcessHandleImageUpload(file);
  };
  
  // Add attachment management function
  const handleAttachmentsChange = (newAttachments: FilePreview[]) => {
    setAttachments(newAttachments);
  };

  // Define sidebar toggle function
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  // Handle right panel toggle - keep it simple and clear
  const toggleRightPanel = () => {
    setShowRightPanel(!showRightPanel);
  };

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true

      if (appConfig.appName) {
        setAppName(appConfig.appName)
      }

      // Get conversation history list, but don't auto-select the latest conversation
      fetchConversationList()
        .then((dialogData) => {
          // Create new conversation by default regardless of history
          handleNewConversation()
        })
        .catch((err) => {
          console.error(t("chatInterface.errorFetchingConversationList"), err)
          // Create new conversation even if getting conversation list fails
          handleNewConversation()
        })
    }
  }, [appConfig]) // Add appConfig as dependency

  // Add useEffect to listen for conversationId changes, ensure right sidebar is always closed when conversation switches
  useEffect(() => {
    // Ensure right sidebar is reset to closed state whenever conversation ID changes
    setSelectedMessageId(undefined);
    setShowRightPanel(false);
  }, [conversationId]);

  // Clear all timers and requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort(t("chatInterface.componentUnmount"));
        } catch (error) {
          console.log(t("chatInterface.errorCancelingRequest"), error);
        }
        abortControllerRef.current = null;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

   const handleSend = async () => {
    if ((!input.trim()) && attachments.length === 0) return // Allow sending attachments only, without text content

    // If in new conversation state, switch to conversation state after sending message
    if (isNewConversation) {
      setIsNewConversation(false);
    }

    // Ensure right sidebar doesn't auto-expand when sending new message
    setSelectedMessageId(undefined)
    setShowRightPanel(false)

    // Handle user message content
    const userMessageId = uuidv4();
    const userMessageContent = input.trim();
    
    // Prepare attachment information
    // Handle file upload
    let uploadedFileUrls: Record<string, string> = {};
    let objectNames: Record<string, string> = {}; // Add object name mapping
    let uploadError: string | undefined;
    
    if (attachments.length > 0) {
      // Show loading state
      setIsLoading(true);
      
      // Use preprocessing function to upload attachments
      const uploadResult = await uploadAttachments(attachments);
      uploadedFileUrls = uploadResult.uploadedFileUrls;
      objectNames = uploadResult.objectNames; // Get object name mapping
      uploadError = uploadResult.error;
    }

    // Use preprocessing function to create message attachments
    const messageAttachments = createMessageAttachments(attachments, uploadedFileUrls, fileUrls);

    // Create user message object
    const userMessage: ChatMessageType = {
      id: userMessageId,
      role: "user",
      content: userMessageContent,
      timestamp: new Date(),
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined
    };

    // Add user message to chat history first
    setMessages(prevMessages => [...prevMessages, userMessage])

    // Clear input box and attachments
    setInput("")
    setAttachments([])

    // Create initial AI reply message
    const assistantMessageId = uuidv4()
    const initialAssistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isComplete: false,
      steps: []
    }

    // Add initial AI reply message (will show loading state)
    setMessages(prevMessages => [...prevMessages, initialAssistantMessage])

    // 发送消息后自动滚动到底部
    setShouldScrollToBottom(true);

    setIsLoading(true)
    setIsStreaming(true) // Set streaming state to true

    // Create new AbortController
    abortControllerRef.current = new AbortController()

    // Set timeout timer - 120 seconds
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const resetTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(async () => {
        if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
          try {
            // Stop agent_run immediately
            abortControllerRef.current.abort(t("chatInterface.requestTimeout"));
            console.log(t('chatInterface.requestTimeoutMessage'));
            
            // Update frontend state immediately
            setIsLoading(false);
            setIsStreaming(false);
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.error = t("chatInterface.requestTimeoutRetry");
                lastMsg.isComplete = true;
                lastMsg.thinking = undefined; // Explicitly clear thinking state
              }
              return newMessages;
            });

            // Use backend API to stop conversation
            if (conversationId && conversationId !== -1) {
              try {
                await conversationService.stop(conversationId);
              } catch (error) {
                console.error(t("chatInterface.stopTimeoutRequestFailed"), error);
              }
            }
          } catch (error) {
            console.log(t("chatInterface.errorCancelingRequest"), error);
          }
        }
        timeoutRef.current = null;
      }, 120000); // 120 second timeout
    }

    resetTimeout(); // Initialize timeout timer

    try {
      // Check if need to create new conversation
      let currentConversationId = conversationId;
      if (!currentConversationId || currentConversationId === -1) {
        // If no session ID or ID is -1, create new conversation first
        try {
          const createData = await conversationService.create();
          currentConversationId = createData.conversation_id;

          // Update current session state
          setConversationId(currentConversationId);
          setSelectedConversationId(currentConversationId);
          setConversationTitle(createData.conversation_title || t("chatInterface.newConversation"));

          // Refresh conversation list
          try {
            const dialogList = await fetchConversationList();
            const newDialog = dialogList.find(dialog => dialog.conversation_id === currentConversationId);
            if (newDialog) {
              setSelectedConversationId(currentConversationId);
            }
          } catch (error) {
            console.error(t("chatInterface.refreshDialogListFailedButContinue"), error);
          }
        } catch (error) {
          console.error(t("chatInterface.createDialogFailedButContinue"), error);
        }
      }

      // If there are attachment files, preprocess first
      let finalQuery = userMessage.content;
      let currentStep: AgentStep | null = null;
      // Declare a variable to save file description information
      let fileDescriptionsMap: Record<string, string> = {};

      if (attachments.length > 0) {
        // Attachment preprocessing step, as independent step in assistant steps
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            if (!lastMsg.steps) lastMsg.steps = [];
            let step = lastMsg.steps.find(s => s.title === t("chatInterface.filePreprocessing"));
            if (!step) {
              step = {
                id: `preprocess-${Date.now()}`,
                title: t("chatInterface.filePreprocessing"),
                content: '',
                expanded: true,
                metrics: '',
                thinking: { content: '', expanded: false },
                code: { content: '', expanded: false },
                output: { content: '', expanded: false },
                contents: [{
                  id: `preprocess-content-${Date.now()}`,
                  type: 'agent_new_run',
                  content: t("chatInterface.parsingFile"),
                  expanded: false,
                  timestamp: Date.now()
                }]
              };
              lastMsg.steps.push(step);
            } else if (step.contents && step.contents.length > 0) {
              // If already exists, reset content to initial prompt
              step.contents[0].content = t("chatInterface.parsingFile");
              step.contents[0].timestamp = Date.now();
            }
          }
          return newMessages;
        });

        // Use extracted preprocessing function to process attachments
        const result = await preprocessAttachments(
          userMessage.content,
          attachments,
          abortControllerRef.current.signal,
          (jsonData) => {
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                if (!lastMsg.steps) lastMsg.steps = [];
                // Find the latest preprocessing step
                let step = lastMsg.steps.find(s => s.title === t("chatInterface.filePreprocessing"));
                if (!step) {
                  step = {
                    id: `preprocess-${Date.now()}`,
                    title: t("chatInterface.filePreprocessing"),
                    content: '',
                    expanded: true,
                    metrics: '',
                    thinking: { content: '', expanded: false },
                    code: { content: '', expanded: false },
                    output: { content: '', expanded: false },
                    contents: [{
                      id: `preprocess-content-${Date.now()}`,
                      type: 'agent_new_run',
                      content: t("chatInterface.parsingFile"),
                      expanded: false,
                      timestamp: Date.now()
                    }]
                  };
                  lastMsg.steps.push(step);
                }
                let stepContent = '';
                switch (jsonData.type) {
                  case "progress":
                    stepContent = jsonData.message;
                    break;
                  case "error":
                    stepContent = t("chatInterface.parseFileFailed", { filename: jsonData.filename, message: jsonData.message });
                    break;
                  case "file_processed":
                    stepContent = t("chatInterface.fileParsed", { filename: jsonData.filename });
                    break;
                  case "complete":
                    stepContent = t("chatInterface.fileParsingComplete");
                    break;
                  default:
                    stepContent = jsonData.message || '';
                }
                // Only update the first content, don't add new ones
                if (step && step.contents && step.contents.length > 0) {
                  step.contents[0].content = stepContent;
                  step.contents[0].timestamp = Date.now();
                }
              }
              return newMessages;
            });
          }
        );

        // Handle preprocessing result
        if (!result.success) {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              lastMsg.error = t("chatInterface.fileProcessingFailed", { error: result.error });
              lastMsg.isComplete = true;
            }
            return newMessages;
          });
          return;
        }

        finalQuery = result.finalQuery;
        fileDescriptionsMap = result.fileDescriptions || {};
      }

      // Send request to backend API, add signal parameter
      const reader = await conversationService.runAgent({
        query: finalQuery, // Use preprocessed query or original query
        conversation_id: currentConversationId,
        is_set: isSwitchedConversation || messages.length <= 1,
        history: messages.filter(msg => msg.id !== userMessage.id).map(msg => ({
          role: msg.role,
          content: msg.role === "assistant"
            ? (msg.finalAnswer?.trim() || msg.content || "")
            : (msg.content || "")
        })),
        minio_files: messageAttachments.length > 0 ? messageAttachments.map(attachment => {
          // Get file description
          let description = "";
          if (attachment.name in fileDescriptionsMap) {
            description = fileDescriptionsMap[attachment.name];
          }
          
          return {
            object_name: objectNames[attachment.name] || '',
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            url: uploadedFileUrls[attachment.name] || attachment.url,
            description: description
          };
        }) : undefined // Use complete attachment object structure
      }, abortControllerRef.current.signal);

      if (!reader) throw new Error("Response body is null")

      // Call streaming processing function to handle response
      await handleStreamResponse(
        reader,
        setMessages,
        resetTimeout,
        stepIdCounter,
        setIsSwitchedConversation,
        isNewConversation,
        setConversationTitle,
        fetchConversationList,
        currentConversationId,
        conversationService,
        false, // isDebug: false for normal chat mode
        t
      );

      // Reset all related states
      setIsLoading(false);
      setIsStreaming(false);
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Note: Save operation is already implemented in agent run API, no need to save again in frontend
    } catch (error) {
      // If user actively canceled, don't show error message
      const err = error as Error;
      if (err.name === 'AbortError') {
        console.log(t("chatInterface.userCancelledRequest"));
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = t("chatInterface.conversationStopped");
            lastMsg.isComplete = true;
            lastMsg.thinking = undefined; // Explicitly clear thinking state
          }
          return newMessages;
        });
      } else {
        console.error(t("chatInterface.errorLabel"), error)
        const errorMessage = error instanceof Error ? error.message : t("chatInterface.errorProcessingRequest")
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = errorMessage;
            lastMsg.isComplete = true;
            lastMsg.error = errorMessage;
            lastMsg.thinking = undefined; // Explicitly clear thinking state
          }
          return newMessages;
        });
      }

      setIsLoading(false);
      setIsStreaming(false);
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = async () => {
    // Cancel current ongoing request first
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort(t("chatInterface.switchToNewConversation"));
      } catch (error) {
        console.log(t("chatInterface.errorCancelingRequest"), error);
      }
      abortControllerRef.current = null;
    }

    // Clear timeout timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If currently in conversation, stop current conversation
    if (isStreaming && conversationId && conversationId !== -1) {
      try {
        console.log(t("chatInterface.stoppingCurrentConversationBeforeCreatingNew"), conversationId);
        await conversationService.stop(conversationId);
      } catch (error) {
        console.error(t("chatInterface.stoppingCurrentConversationFailed"), error);
        // Continue creating new conversation even if stopping fails
      }
    }

    // Reset all states
    setInput("");
    setIsLoading(false);
    setConversationId(-1);
    setIsSwitchedConversation(false);
    setConversationTitle(t("chatInterface.newConversation"));
    setSelectedConversationId(null);
    setIsNewConversation(true); // Ensure set to new conversation state

    // Reset messages and steps
    setMessages([]);

    // Reset streaming state
    setIsStreaming(false);

    // Reset selected message and right panel state
    setSelectedMessageId(undefined);
    setShowRightPanel(false);

    // Reset attachment state
    setAttachments([]);
    setFileUrls({});

    // Clear URL parameters
    const url = new URL(window.location.href);
    if (url.searchParams.has("q")) {
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url.toString());
    }

    // Wait for all state updates to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    // 确保新对话时滚动到底部
    setShouldScrollToBottom(true);
  }

  const fetchConversationList = async () => {
    try {
      const dialogHistory = await conversationService.getList();
      // Sort by creation time, newest first
      dialogHistory.sort((a, b) => b.create_time - a.create_time);
      setConversationList(dialogHistory);
      return dialogHistory;
    } catch (error) {
      console.error(t("chatInterface.errorFetchingConversationList"), error);
      throw error;
    }
  };

  // When user clicks left sidebar component, switch to corresponding conversation, trigger function, load conversation history
  const handleDialogClick = async (dialog: ConversationListItem) => {
    // Cancel current ongoing request first
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort(t("chatInterface.switchConversation"));
      } catch (error) {
        console.log(t("chatInterface.errorCancelingRequest"), error);
      }
      abortControllerRef.current = null;
    }

    // Clear timeout timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If currently in conversation, stop current conversation first
    if (isStreaming && conversationId && conversationId !== -1) {
      try {
        console.log(t("chatInterface.stoppingCurrentConversationBeforeSwitching"), conversationId);
        await conversationService.stop(conversationId);
        setIsStreaming(false);
        setIsLoading(false);
      } catch (error) {
        console.error(t("chatInterface.stoppingCurrentConversationFailed"), error);
        // Continue switching conversation even if stopping fails
        setIsStreaming(false);
        setIsLoading(false);
      }
    }

    // Set states
    setConversationId(dialog.conversation_id)
    setConversationTitle(dialog.conversation_title)
    setSelectedConversationId(dialog.conversation_id)
    setIsSwitchedConversation(true)

    // Reset selected message ID, ensure right panel state is correct
    setSelectedMessageId(undefined)
    // Ensure right panel is closed by default
    setShowRightPanel(false)

    try {
      // Create new AbortController for current request
      const controller = new AbortController();

      // Set timeout timer - 120 seconds
      timeoutRef.current = setTimeout(() => {
        if (controller && !controller.signal.aborted) {
          try {
            controller.abort(t("chatInterface.requestTimeout"));
            console.log(t('chatInterface.requestTimeoutMessage'));
          } catch (error) {
            console.error(t("chatInterface.errorCancelingRequest"), error);
          }
        }
        timeoutRef.current = null;
      }, 120000);

      // Save current controller reference
      abortControllerRef.current = controller;

      // Use controller.signal to make request with timeout
      const data = await conversationService.getDetail(dialog.conversation_id, controller.signal);

      // Clear timeout timer after request completes
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Don't process result if request was canceled
      if (controller.signal.aborted) {
        return;
      }

      if (data.code === 0 && data.data && data.data.length > 0) {
        const conversationData = data.data[0] as ApiConversationDetail;
        const dialogMessages = conversationData.message || [];

        setTimeout(() => {
          const formattedMessages: ChatMessageType[] = [];

          // Optimized processing logic: process messages by role one by one, maintain original order
          dialogMessages.forEach((dialog_msg, index) => {
            if (dialog_msg.role === "user") {
              const formattedUserMsg: ChatMessageType = extractUserMsgFromResponse(dialog_msg, index, conversationData.create_time)
              formattedMessages.push(formattedUserMsg);
            } else if (dialog_msg.role === "assistant") {
              const formattedAssistantMsg: ChatMessageType = extractAssistantMsgFromResponse(dialog_msg, index, conversationData.create_time)
              formattedMessages.push(formattedAssistantMsg);
            }
          });

          // Update message array
          setMessages(formattedMessages);

          // Asynchronously load all attachment URLs
          loadAttachmentUrls(formattedMessages);

          // Trigger scroll to bottom
          setShouldScrollToBottom(true);

          // Refresh history list
          fetchConversationList().catch(err => {
            console.error(t("chatInterface.refreshDialogListFailedButContinue"), err);
          });
        }, 0);
      } else {
        console.error(t("chatInterface.errorFetchingConversationDetails"), data.message)
      }
    } catch (error) {
      console.error(t("chatInterface.errorFetchingConversationDetailsError"), error)
    }
  }

  // Add function to asynchronously load attachment URLs
  const loadAttachmentUrls = async (messages: ChatMessageType[]) => {
    // Create a copy to avoid directly modifying parameters
    const updatedMessages = [...messages];
    let hasUpdates = false;

    // Process attachments for each message
    for (const message of updatedMessages) {
      if (message.attachments && message.attachments.length > 0) {
        // Get URL for each attachment
        for (const attachment of message.attachments) {
          if (attachment.object_name && !attachment.url) {
            try {
              // Get file URL
              const url = await storageService.getFileUrl(attachment.object_name);
              // Update attachment info
              attachment.url = url;
              hasUpdates = true;
            } catch (error) {
              console.error(t("chatInterface.errorFetchingAttachmentUrl", { object_name: attachment.object_name }), error);
            }
          }
        }
      }
    }

    // If there are updates, set new message array
    if (hasUpdates) {
      setMessages(updatedMessages);
    }
  };

  // Left sidebar conversation title update
  const handleConversationRename = async (dialogId: number, title: string) => {
    try {
      await conversationService.rename(dialogId, title);
      await fetchConversationList();

      if (selectedConversationId === dialogId) {
        setConversationTitle(title);
      }
    } catch (error) {
      console.error(t("chatInterface.renameFailed"), error);
    }
  };

  // Left sidebar conversation deletion
  const handleConversationDeleteClick = async (dialogId: number) => {
    try {
      // If deleting the currently active conversation, stop conversation first
      if (selectedConversationId === dialogId && isStreaming && conversationId === dialogId) {
        // Cancel current ongoing request first
        if (abortControllerRef.current) {
          try {
            abortControllerRef.current.abort(t("chatInterface.deleteConversation"));
          } catch (error) {
            console.log(t("chatInterface.errorCancelingRequest"), error);
          }
          abortControllerRef.current = null;
        }

        // Clear timeout timer
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        setIsStreaming(false);
        setIsLoading(false);

        try {
          console.log(t("chatInterface.stoppingCurrentConversationBeforeDeleting"), dialogId);
          await conversationService.stop(dialogId);
        } catch (error) {
          console.error(t("chatInterface.stopConversationToDeleteFailed"), error);
          // Continue deleting even if stopping fails
        }
      }

      await conversationService.delete(dialogId);
      await fetchConversationList();

      if (selectedConversationId === dialogId) {
        setSelectedConversationId(null);
        setConversationTitle(t("chatInterface.newConversation"));
        handleNewConversation();
      }
    } catch (error) {
      console.error(t("chatInterface.deleteFailed"), error);
    }
  };

  // Add image error handling function
  const handleImageError = (imageUrl: string) => {
    console.error(t("chatInterface.imageLoadFailed"), imageUrl);

    // Remove failed images from messages
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];

      if (lastMsg && lastMsg.role === "assistant" && lastMsg.images) {
        // Filter out failed images
        lastMsg.images = lastMsg.images.filter(url => url !== imageUrl);
      }

      return newMessages;
    });
  };

  // Handle image click preview
  const handleImageClick = (imageUrl: string) => {
    setViewingImage(imageUrl);
  };

  // Add conversation stop handling function
  const handleStop = async () => {
    // stop agent_run immediately
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort(t("chatInterface.userManuallyStopped"));
      } catch (error) {
        console.log(t("chatInterface.errorCancelingRequest"), error);
      }
      abortControllerRef.current = null;
    }

    // Clear timeout timer (if still in use)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Immediately update frontend state
    setIsStreaming(false);
    setIsLoading(false);

    // If no valid conversation ID, just reset frontend state
    if (!conversationId || conversationId === -1) {
      return;
    }

    try {
      // Call backend stop API
      await conversationService.stop(conversationId);
      
      // Manually update messages, clear thinking state
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.isComplete = true;
          lastMsg.thinking = undefined; // Explicitly clear thinking state
        }
        return newMessages;
      });
    } catch (error) {
      console.error(t("chatInterface.stopConversationFailed"), error);
      
      // Optionally show error message
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.isComplete = true;
          lastMsg.thinking = undefined; // Explicitly clear thinking state
          lastMsg.error = t("chatInterface.stopConversationFailedButFrontendStopped");
        }
        return newMessages;
      });
    }
  };

  // Top title rename function
  const handleTitleRename = async (newTitle: string) => {
    if (selectedConversationId && newTitle !== conversationTitle) {
      try {
        await conversationService.rename(selectedConversationId, newTitle);
        await fetchConversationList();
        setConversationTitle(newTitle);
      } catch (error) {
        console.error(t("chatInterface.renameFailed"), error);
      }
    }
  };

  // Handle message selection
  const handleMessageSelect = (messageId: string) => {
    if (messageId !== selectedMessageId) {
      // If clicking on new message, set as selected and open right panel
      setSelectedMessageId(messageId);
      // Auto open right panel
      setShowRightPanel(true);
    } else {
      // If clicking on already selected message, toggle panel state
      toggleRightPanel();
    }
  };

  // Like/dislike handling
  const handleOpinionChange = async (messageId: number, opinion: 'Y' | 'N' | null) => {
    try {
      await conversationService.updateOpinion({ message_id: messageId, opinion });
      setMessages((prev) => prev.map(msg =>
        msg.message_id === messageId ? { ...msg, opinion_flag: opinion as string | undefined } : msg
      ));
    } catch (error) {
      console.error(t("chatInterface.updateOpinionFailed"), error);
    }
  };

  // Add event listener for conversation list updates
  useEffect(() => {
    const handleConversationListUpdate = () => {
      fetchConversationList().catch(err => {
        console.error(t("chatInterface.failedToUpdateConversationList"), err);
      });
    };

    window.addEventListener('conversationListUpdated', handleConversationListUpdate);

    return () => {
      window.removeEventListener('conversationListUpdated', handleConversationListUpdate);
    };
  }, []);

  return (
    <>
      <div className="flex h-screen">
        <ChatSidebar
          conversationList={conversationList}
          selectedConversationId={selectedConversationId}
          openDropdownId={openDropdownId}
          onNewConversation={handleNewConversation}
          onDialogClick={handleDialogClick}
          onRename={handleConversationRename}
          onDelete={handleConversationDeleteClick}
          onSettingsClick={() => {
            localStorage.setItem('show_page', user?.role === 'admin' ? '1' : '2');
            router.push("/setup");
          }}
          onDropdownOpenChange={(open, id) => setOpenDropdownId(open ? id : null)}
          onToggleSidebar={toggleSidebar}
          expanded={sidebarOpen}
          userEmail={user?.email}
          userAvatarUrl={user?.avatar_url}
          userRole={user?.role}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col">
              <ChatHeader
                title={conversationTitle}
                onShare={() => {
                  console.log("Share clicked")
                }}
                onRename={handleTitleRename}
              />

              <ChatStreamMain
                messages={messages}
                input={input}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onInputChange={(value) => setInput(value)}
                onSend={handleSend}
                onStop={handleStop}
                onKeyDown={handleKeyDown}
                onSelectMessage={handleMessageSelect}
                selectedMessageId={selectedMessageId}
                onImageClick={handleImageClick}
                attachments={attachments}
                onAttachmentsChange={handleAttachmentsChange}
                onFileUpload={handleFileUpload}
                onImageUpload={handleImageUpload}
                onOpinionChange={handleOpinionChange}
                currentConversationId={conversationId}
                shouldScrollToBottom={shouldScrollToBottom}
              />

              {/* Footer */}
              <div className="flex-shrink-0 mt-auto">
                <div className="text-center text-sm py-1" style={{ color: 'rgb(163, 163, 163)', position: 'sticky', bottom: 0, backgroundColor: 'white', width: '100%' }}>
                  {t("chatInterface.aiGeneratedContentWarning")}
                </div>
              </div>
            </div>

            <ChatRightPanel
              messages={messages}
              onImageError={handleImageError}
              maxInitialImages={14}
              isVisible={showRightPanel}
              toggleRightPanel={toggleRightPanel}
              selectedMessageId={selectedMessageId}
            />
          </div>
        </div>
      </div>
      <TooltipProvider>
        <Tooltip open={false}>
          <TooltipTrigger asChild>
            <div className="fixed inset-0 pointer-events-none" />
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="absolute bottom-24 left-1/2 transform -translate-x-1/2">
            {t("chatInterface.stopGenerating")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Image preview */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-[90%] max-h-[90%]" onClick={e => e.stopPropagation()}>
            <img
              src={viewingImage}
              alt={t("chatInterface.imagePreview")}
              className="max-w-full max-h-[90vh] object-contain"
              onError={() => {
                handleImageError(viewingImage);
              }}
            />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-4 -right-4 bg-white p-1 rounded-full shadow-md hover:bg-white transition-colors"
              title={t("chatInterface.close")}
            >
              <X size={16} className="text-gray-600 hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
