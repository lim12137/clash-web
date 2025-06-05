"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { useConfig } from "@/hooks/useConfig"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { conversationService } from '@/services/conversationService';
import { storageService } from '@/services/storageService';

// 在文件顶部添加导入
import { ChatSidebar } from "@/app/chat/layout/chatLeftSidebar"
import { FilePreview } from "@/app/chat/layout/chatInput"
import { ChatHeader } from "@/app/chat/layout/chatHeader"
import { ChatRightPanel } from "@/app/chat/layout/chatRightPanel"
import { ChatStreamMain } from "@/app/chat/streaming/chatStreamMain"

// 导入预处理工具函数
import {
  preprocessAttachments,
  createThinkingStep,
  handleFileUpload as preProcessHandleFileUpload,
  handleImageUpload as preProcessHandleImageUpload,
  uploadAttachments,
  createMessageAttachments,
  cleanupAttachmentUrls
} from "@/app/chat/internal/chatPreprocess"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// 替换为只导入需要的类型
import { ConversationListItem, ApiConversationDetail } from '@/types/chat'
import { ChatMessageType, AgentStep } from '@/types/chat'


// 导入流式处理函数
import { handleStreamResponse } from "@/app/chat/streaming/chatStreamHandler"
import { extractUserMsgFromResponse, extractAssistantMsgFromResponse } from "./extractMsgFromHistoryResponse"

import { X } from "lucide-react"

const stepIdCounter = {current: 0};

export function ChatInterface() {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [isSwitchedConversation, setIsSwitchedConversation] = useState(false) // 添加跟踪对话切换的状态
  const [isLoading, setIsLoading] = useState(false)
  const initialized = useRef(false)
  const [appName, setAppName] = useState("新应用")
  const [conversationTitle, setConversationTitle] = useState("新对话")
  const [conversationId, setConversationId] = useState<number>(0)
  const [conversationList, setConversationList] = useState<ConversationListItem[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const { appConfig } = useConfig() // 移到顶层调用

  const [viewingImage, setViewingImage] = useState<string | null>(null)

  // 添加附件状态管理
  const [attachments, setAttachments] = useState<FilePreview[]>([]);
  const [fileUrls, setFileUrls] = useState<{[id: string]: string}>({});

  const [isStreaming, setIsStreaming] = useState(false) // 添加流式传输状态
  const abortControllerRef = useRef<AbortController | null>(null) // 添加 AbortController 引用
  const timeoutRef = useRef<NodeJS.Timeout | null>(null) // 添加超时引用

  // 添加侧边栏状态控制
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 在现有状态变量下添加一个新的状态
  const [isNewConversation, setIsNewConversation] = useState(true)

  // 确保右侧边栏默认是关闭状态
  const [showRightPanel, setShowRightPanel] = useState(false)

  const [selectedMessageId, setSelectedMessageId] = useState<string | undefined>();

  // 添加附件清理函数 - 在组件卸载时清理URL
  useEffect(() => {
    return () => {
      // 使用预处理函数清理URL
      cleanupAttachmentUrls(attachments, fileUrls);
    };
  }, [attachments, fileUrls]);

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    return preProcessHandleFileUpload(file, setFileUrls);
  };

  // 处理图片上传
  const handleImageUpload = (file: File) => {
    preProcessHandleImageUpload(file);
  };
  
  // 添加附件管理函数
  const handleAttachmentsChange = (newAttachments: FilePreview[]) => {
    setAttachments(newAttachments);
  };

  // 定义切换侧边栏的函数
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  // 处理右侧面板切换 - 保持简单明了
  const toggleRightPanel = () => {
    setShowRightPanel(!showRightPanel);
  };

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true

      if (appConfig.appName) {
        setAppName(appConfig.appName)
      }

      // 获取历史对话列表，但不自动选择最新的对话
      fetchConversationList()
        .then((dialogData) => {
          // 无论是否有历史对话，都默认创建新对话
          handleNewConversation()
        })
        .catch((err) => {
          console.error("初始化时获取对话列表失败:", err)
          // 如果获取对话列表失败，也创建新对话
          handleNewConversation()
        })
    }
  }, [appConfig]) // 添加 appConfig 作为依赖项

  // 添加一个useEffect来监听conversationId的变化，确保对话切换时右侧边栏始终关闭
  useEffect(() => {
    // 确保无论何时对话ID变化，右侧边栏都重置为关闭状态
    setSelectedMessageId(undefined);
    setShowRightPanel(false);
  }, [conversationId]);

  // 组件卸载时清除所有定时器和请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort('组件卸载');
        } catch (error) {
          console.log('取消请求时出错', error);
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
    if ((!input.trim()) && attachments.length === 0) return // 允许只发送附件，没有文本内容

    // 如果是新对话状态，发送消息后切换到对话状态
    if (isNewConversation) {
      setIsNewConversation(false);
    }

    // 确保发送新消息时不自动展开右侧边栏
    setSelectedMessageId(undefined)
    setShowRightPanel(false)

    // 处理用户消息的内容
    const userMessageId = uuidv4();
    const userMessageContent = input.trim();
    
    // 准备附件信息
    // 处理文件上传
    let uploadedFileUrls: Record<string, string> = {};
    let objectNames: Record<string, string> = {}; // 添加对象名称映射
    let uploadError: string | undefined;
    
    if (attachments.length > 0) {
      // 显示加载状态
      setIsLoading(true);
      
      // 使用预处理函数上传附件
      const uploadResult = await uploadAttachments(attachments);
      uploadedFileUrls = uploadResult.uploadedFileUrls;
      objectNames = uploadResult.objectNames; // 获取对象名称映射
      uploadError = uploadResult.error;
    }

    // 使用预处理函数创建消息附件
    const messageAttachments = createMessageAttachments(attachments, uploadedFileUrls, fileUrls);

    // 创建用户消息对象
    const userMessage: ChatMessageType = {
      id: userMessageId,
      role: "user",
      content: userMessageContent,
      timestamp: new Date(),
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined
    };

    // 先添加用户消息到聊天记录
    setMessages(prevMessages => [...prevMessages, userMessage])

    // 清空输入框和附件
    setInput("")
    setAttachments([])

    // 创建初始的AI回复消息
    const assistantMessageId = uuidv4()
    const initialAssistantMessage: ChatMessageType = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isComplete: false,
      steps: []
    }

    // 添加初始的AI回复消息（会显示加载状态）
    setMessages(prevMessages => [...prevMessages, initialAssistantMessage])

    setIsLoading(true)
    setIsStreaming(true) // 设置流式传输状态为 true

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()

    // 设置超时定时器 - 120秒
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
            // 使用后端接口停止对话
            if (conversationId && conversationId !== -1) {
              try {
                await conversationService.stop(conversationId);
              } catch (error) {
                console.error('停止超时请求失败:', error);
              }
            }
            
            abortControllerRef.current.abort('请求超时');
            console.log('请求超过120秒已自动取消');
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMsg = newMessages[newMessages.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.error = "请求超时，请重试";
                lastMsg.isComplete = true;
                lastMsg.thinking = undefined; // 明确清除thinking状态
              }
              return newMessages;
            });
            setIsLoading(false);
            setIsStreaming(false);
          } catch (error) {
            console.log('取消请求时出错', error);
          }
        }
        timeoutRef.current = null;
      }, 120000); // 120秒超时
    }

    resetTimeout(); // 初始化超时计时器

    try {
      // 检查是否需要创建新对话
      let currentConversationId = conversationId;
      if (!currentConversationId || currentConversationId === -1) {
        // 如果没有会话ID或ID为-1，先创建新对话
        try {
          const createData = await conversationService.create();
          currentConversationId = createData.conversation_id;

          // 更新当前会话状态
          setConversationId(currentConversationId);
          setSelectedConversationId(currentConversationId);
          setConversationTitle(createData.conversation_title || "新对话");

          // 刷新对话列表
          try {
            const dialogList = await fetchConversationList();
            const newDialog = dialogList.find(dialog => dialog.conversation_id === currentConversationId);
            if (newDialog) {
              setSelectedConversationId(currentConversationId);
            }
          } catch (error) {
            console.error("刷新对话列表失败，但继续发送消息:", error);
          }
        } catch (error) {
          console.error("创建新对话失败，但仍会尝试发送消息:", error);
        }
      }

      // 如果有附件文件，先进行预处理
      let finalQuery = userMessage.content;
      let currentStep: AgentStep | null = null;
      // 声明一个变量保存文件描述信息
      let fileDescriptionsMap: Record<string, string> = {};

      if (attachments.length > 0) {
        // 附件预处理步骤，作为 assistant steps 的独立步骤
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            if (!lastMsg.steps) lastMsg.steps = [];
            let step = lastMsg.steps.find(s => s.title === '文件预处理');
            if (!step) {
              step = {
                id: `preprocess-${Date.now()}`,
                title: '文件预处理',
                content: '',
                expanded: true,
                metrics: '',
                thinking: { content: '', expanded: false },
                code: { content: '', expanded: false },
                output: { content: '', expanded: false },
                contents: [{
                  id: `preprocess-content-${Date.now()}`,
                  type: 'agent_new_run',
                  content: '正在解析文件…',
                  expanded: false,
                  timestamp: Date.now()
                }]
              };
              lastMsg.steps.push(step);
            } else if (step.contents && step.contents.length > 0) {
              // 如果已存在，重置内容为初始提示
              step.contents[0].content = '正在解析文件…';
              step.contents[0].timestamp = Date.now();
            }
          }
          return newMessages;
        });

        // 使用提取的预处理函数处理附件
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
                // 找到最新的预处理 step
                let step = lastMsg.steps.find(s => s.title === '文件预处理');
                if (!step) {
                  step = {
                    id: `preprocess-${Date.now()}`,
                    title: '文件预处理',
                    content: '',
                    expanded: true,
                    metrics: '',
                    thinking: { content: '', expanded: false },
                    code: { content: '', expanded: false },
                    output: { content: '', expanded: false },
                    contents: [{
                      id: `preprocess-content-${Date.now()}`,
                      type: 'agent_new_run',
                      content: '正在解析文件…',
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
                    stepContent = `解析文件 ${jsonData.filename} 失败: ${jsonData.message}`;
                    break;
                  case "file_processed":
                    stepContent = `文件 ${jsonData.filename} 已解析完成`;
                    break;
                  case "complete":
                    stepContent = "文件解析完成";
                    break;
                  default:
                    stepContent = jsonData.message || '';
                }
                // 只更新第一个内容，不新增
                if (step && step.contents && step.contents.length > 0) {
                  step.contents[0].content = stepContent;
                  step.contents[0].timestamp = Date.now();
                }
              }
              return newMessages;
            });
          }
        );

        // 处理预处理结果
        if (!result.success) {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              lastMsg.error = `文件处理失败: ${result.error}`;
              lastMsg.isComplete = true;
            }
            return newMessages;
          });
          return;
        }

        finalQuery = result.finalQuery;
        fileDescriptionsMap = result.fileDescriptions || {};
      }

      // 发送请求到后端API，添加 signal 参数
      const reader = await conversationService.runAgent({
        query: finalQuery, // 使用预处理后的查询或原始查询
        conversation_id: currentConversationId,
        is_set: isSwitchedConversation || messages.length <= 1,
        history: messages.filter(msg => msg.id !== userMessage.id).map(msg => ({
          role: msg.role,
          content: msg.role === "assistant"
            ? (msg.finalAnswer?.trim() || msg.content || "")
            : (msg.content || "")
        })),
        minio_files: messageAttachments.length > 0 ? messageAttachments.map(attachment => {
          // 获取文件描述
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
        }) : undefined // 使用完整的附件对象结构
      }, abortControllerRef.current.signal);

      if (!reader) throw new Error("Response body is null")

      // 调用流式处理函数处理响应
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
        conversationService
      );

      // 重置所有相关状态
      setIsLoading(false);
      setIsStreaming(false);
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // 注意：保存操作已经在agent run接口中实现，不需要在前端再次保存
    } catch (error) {
      // 如果是用户主动取消，不显示错误信息
      const err = error as Error;
      if (err.name === 'AbortError') {
        console.log('用户取消了请求');
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = "对话已停止";
            lastMsg.isComplete = true;
            lastMsg.thinking = undefined; // 明确清除thinking状态
          }
          return newMessages;
        });
      } else {
        console.error("Error:", error)
        const errorMessage = error instanceof Error ? error.message : "处理请求时发生错误"
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = errorMessage;
            lastMsg.isComplete = true;
            lastMsg.error = errorMessage;
            lastMsg.thinking = undefined; // 明确清除thinking状态
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
    // 如果当前正在进行对话，先停止当前对话
    if (isStreaming && conversationId && conversationId !== -1) {
      try {
        console.log('创建新对话前停止当前对话:', conversationId);
        await conversationService.stop(conversationId);
      } catch (error) {
        console.error('停止当前对话失败:', error);
        // 即使停止失败，也继续创建新对话
      }
    }

    // 先取消当前正在进行的请求
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort('切换到新对话');
      } catch (error) {
        console.log('取消请求时出错', error);
      }
      abortControllerRef.current = null;
    }

    // 清除超时定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 重置所有状态
    setInput("");
    setIsLoading(false);
    setConversationId(-1);
    setIsSwitchedConversation(false);
    setConversationTitle("新对话");
    setSelectedConversationId(null);
    setIsNewConversation(true); // 确保设置为新对话状态

    // 重置消息和步骤
    setMessages([]);

    // 重置流式传输状态
    setIsStreaming(false);

    // 重置选中的消息和右侧面板状态
    setSelectedMessageId(undefined);
    setShowRightPanel(false);

    // 重置附件状态
    setAttachments([]);
    setFileUrls({});

    // 清除URL参数
    const url = new URL(window.location.href);
    if (url.searchParams.has("q")) {
      url.searchParams.delete("q");
      window.history.replaceState({}, "", url.toString());
    }

    // 等待所有状态更新完成
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const fetchConversationList = async () => {
    try {
      const dialogHistory = await conversationService.getList();
            // 按创建时间排序，最新的在前面
      dialogHistory.sort((a, b) => b.create_time - a.create_time);
      setConversationList(dialogHistory);
      return dialogHistory;
    } catch (error) {
      console.error("获取对话列表出错:", error);
      throw error;
    }
  };

  // 用户点击左侧边栏组件，切换到对应的对话，触发函数，加载历史对话
  const handleDialogClick = async (dialog: ConversationListItem) => {
    // 如果当前正在进行对话，先停止当前对话
    if (isStreaming && conversationId && conversationId !== -1) {
      try {
        console.log('切换对话前停止当前对话:', conversationId);
        await conversationService.stop(conversationId);
        setIsStreaming(false);
        setIsLoading(false);
      } catch (error) {
        console.error('停止当前对话失败:', error);
        // 即使停止失败，也继续切换对话
        setIsStreaming(false);
        setIsLoading(false);
      }
    }

    // 设置状态
    setConversationId(dialog.conversation_id)
    setConversationTitle(dialog.conversation_title)
    setSelectedConversationId(dialog.conversation_id)
    setIsSwitchedConversation(true)

    // 重置选中的消息ID，确保右侧面板的状态正确
    setSelectedMessageId(undefined)
    // 确保右侧面板默认关闭
    setShowRightPanel(false)

    try {
      // 创建新的AbortController用于当前请求
      const controller = new AbortController();

      // 取消前一个超时定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 设置超时定时器 - 120秒
      timeoutRef.current = setTimeout(() => {
        if (controller && !controller.signal.aborted) {
          try {
            controller.abort('请求超时');
            console.log('请求超过120秒已自动取消');
          } catch (error) {
            console.error('取消请求时出错', error);
          }
        }
        timeoutRef.current = null;
      }, 120000);

      // 保存当前controller引用
      abortControllerRef.current = controller;

      // 使用controller.signal发起带超时的请求
      const data = await conversationService.getDetail(dialog.conversation_id, controller.signal);

      // 请求完成后清除超时定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 如果请求已被取消，不处理结果
      if (controller.signal.aborted) {
        return;
      }

      if (data.code === 0 && data.data && data.data.length > 0) {
        const conversationData = data.data[0] as ApiConversationDetail;
        const dialogMessages = conversationData.message || [];

        setTimeout(() => {
          const formattedMessages: ChatMessageType[] = [];

          // 优化处理逻辑：根据消息角色逐条处理，维持原始顺序
          dialogMessages.forEach((dialog_msg, index) => {
            if (dialog_msg.role === "user") {
              const formattedUserMsg: ChatMessageType = extractUserMsgFromResponse(dialog_msg, index, conversationData.create_time)
              formattedMessages.push(formattedUserMsg);
            } else if (dialog_msg.role === "assistant") {
              const formattedAssistantMsg: ChatMessageType = extractAssistantMsgFromResponse(dialog_msg, index, conversationData.create_time)
              formattedMessages.push(formattedAssistantMsg);
            }
          });

          // 更新消息数组
          setMessages(formattedMessages);

          // 异步加载所有附件的URL
          loadAttachmentUrls(formattedMessages);

          // 确保滚动到底部 - 使用短延时等待DOM更新完成
          setTimeout(() => {
            const chatMain = document.querySelector('[data-radix-scroll-area-viewport]');
            if (chatMain) {
              chatMain.scrollTop = chatMain.scrollHeight;
            }
          }, 500);

          // 刷新历史记录列表
          fetchConversationList().catch(err => {
            console.error("刷新对话列表失败:", err);
          });
        }, 0);
      } else {
        console.error("获取对话详情失败:", data.message)
      }
    } catch (error) {
      console.error("获取对话详情错误:", error)
    }
  }

  // 添加异步加载附件URL的函数
  const loadAttachmentUrls = async (messages: ChatMessageType[]) => {
    // 创建一个副本以避免直接修改参数
    const updatedMessages = [...messages];
    let hasUpdates = false;

    // 对每个消息处理其附件
    for (const message of updatedMessages) {
      if (message.attachments && message.attachments.length > 0) {
        // 对每个附件获取URL
        for (const attachment of message.attachments) {
          if (attachment.object_name && !attachment.url) {
            try {
              // 获取文件URL
              const url = await storageService.getFileUrl(attachment.object_name);
              // 更新附件信息
              attachment.url = url;
              hasUpdates = true;
            } catch (error) {
              console.error(`获取附件URL失败: ${attachment.object_name}`, error);
            }
          }
        }
      }
    }

    // 如果有更新，设置新的消息数组
    if (hasUpdates) {
      setMessages(updatedMessages);
    }
  };

  // 左边栏历史对话标题更新
  const handleConversationRename = async (dialogId: number, title: string) => {
    try {
      await conversationService.rename(dialogId, title);
      await fetchConversationList();

      if (selectedConversationId === dialogId) {
        setConversationTitle(title);
      }
    } catch (error) {
      console.error("重命名失败:", error);
    }
  };

  // 左边栏历史对话删除
  const handleConversationDeleteClick = async (dialogId: number) => {
    try {
      // 如果删除的是当前正在进行对话的会话，先停止对话
      if (selectedConversationId === dialogId && isStreaming && conversationId === dialogId) {
        try {
          console.log('删除对话前停止当前对话:', dialogId);
          await conversationService.stop(dialogId);
          setIsStreaming(false);
          setIsLoading(false);
        } catch (error) {
          console.error('停止要删除的对话失败:', error);
          // 即使停止失败，也继续删除
          setIsStreaming(false);
          setIsLoading(false);
        }
      }

      await conversationService.delete(dialogId);
      await fetchConversationList();

      if (selectedConversationId === dialogId) {
        setSelectedConversationId(null);
        setConversationTitle("新对话");
        handleNewConversation();
      }
    } catch (error) {
      console.error("删除失败:", error);
    }
  };

  // 添加图片错误处理函数
  const handleImageError = (imageUrl: string) => {
    console.error("图片加载失败:", imageUrl);

    // 从消息中移除无法加载的图片
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];

      if (lastMsg && lastMsg.role === "assistant" && lastMsg.images) {
        // 过滤掉加载失败的图片
        lastMsg.images = lastMsg.images.filter(url => url !== imageUrl);
      }

      return newMessages;
    });
  };

  // 处理图片点击预览
  const handleImageClick = (imageUrl: string) => {
    setViewingImage(imageUrl);
  };

  // 添加停止对话的处理函数
  const handleStop = async () => {
    // 如果没有有效的对话ID，就只是重置前端状态
    if (!conversationId || conversationId === -1) {
      setIsStreaming(false);
      setIsLoading(false);
      return;
    }

    try {
      // 调用后端停止接口
      await conversationService.stop(conversationId);
      
      // 成功停止后更新前端状态
      setIsStreaming(false);
      setIsLoading(false);

      // 手动更新消息，清除thinking状态
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.isComplete = true;
          lastMsg.thinking = undefined; // 明确清除thinking状态
        }
        return newMessages;
      });
    } catch (error) {
      console.error('停止对话失败:', error);
      // 即使停止失败，也重置前端状态
      setIsStreaming(false);
      setIsLoading(false);
      
      // 可以选择显示错误信息
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.isComplete = true;
          lastMsg.thinking = undefined; // 明确清除thinking状态
          lastMsg.error = "停止对话失败，但前端已停止显示";
        }
        return newMessages;
      });
    }

    // 清除超时定时器（如果还在使用的话）
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 清理 AbortController 引用
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
  };

  // 顶部标题重命名函数
  const handleTitleRename = async (newTitle: string) => {
    if (selectedConversationId && newTitle !== conversationTitle) {
      try {
        await conversationService.rename(selectedConversationId, newTitle);
        await fetchConversationList();
        setConversationTitle(newTitle);
      } catch (error) {
        console.error("重命名失败:", error);
      }
    }
  };

  // 处理消息选择
  const handleMessageSelect = (messageId: string) => {
    if (messageId !== selectedMessageId) {
      // 如果点击的是新消息，设置为选中状态并打开右侧面板
      setSelectedMessageId(messageId);
      // 自动打开右侧面板
      setShowRightPanel(true);
    } else {
      // 如果点击的是已选中消息，则切换面板状态
      toggleRightPanel();
    }
  };

  // 点赞/点踩处理
  const handleOpinionChange = async (messageId: number, opinion: 'Y' | 'N' | null) => {
    try {
      await conversationService.updateOpinion({ message_id: messageId, opinion });
      setMessages((prev) => prev.map(msg =>
        msg.message_id === messageId ? { ...msg, opinion_flag: opinion as string | undefined } : msg
      ));
    } catch (error) {
      console.error('更新点赞/点踩失败:', error);
    }
  };

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
            localStorage.setItem('show_page', '1');
            router.push("/setup");
          }}
          onDropdownOpenChange={(open, id) => setOpenDropdownId(open ? id : null)}
          onToggleSidebar={toggleSidebar}
          expanded={sidebarOpen}
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
              />

              {/* Footer */}
              <div className="flex-shrink-0 mt-auto">
                <div className="text-center text-sm py-1" style={{ color: 'rgb(163, 163, 163)', position: 'sticky', bottom: 0, backgroundColor: 'white', width: '100%' }}>
                  内容由 AI 生成，请仔细甄别
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
            停止生成
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
              alt="图片预览"
              className="max-w-full max-h-[90vh] object-contain"
              onError={() => {
                handleImageError(viewingImage);
              }}
            />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-4 -right-4 bg-white p-1 rounded-full shadow-md hover:bg-white transition-colors"
            >
              <X size={16} className="text-gray-600 hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
