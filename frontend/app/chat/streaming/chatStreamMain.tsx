import { useRef, useEffect, useState } from "react"
import { ScrollArea } from "@/components/ui/scrollArea"
import { ChatInput } from "@/app/chat/layout/chatInput"
import { ChatMessageType } from "@/types/chat"
import { FilePreview } from "@/app/chat/layout/chatInput"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { ChatStreamFinalMessage } from "./chatStreamFinalMessage"
import { TaskWindow } from "./taskWindow"
import { conversationService } from '@/services/conversationService'

// 定义新的消息处理结构
interface ProcessedMessages {
  finalMessages: ChatMessageType[];  // 用户消息和最终回答
  taskMessages: any[];  // 任务消息，用于任务窗口
  // 添加对话组映射
  conversationGroups: Map<string, any[]>; // 用户消息ID -> 相关任务消息
}

interface ChatStreamMainProps {
  messages: ChatMessageType[]
  input: string
  isLoading: boolean
  isStreaming?: boolean
  onInputChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSelectMessage?: (messageId: string) => void
  selectedMessageId?: string
  onImageClick?: (image: string) => void
  attachments?: FilePreview[]
  onAttachmentsChange?: (attachments: FilePreview[]) => void
  onFileUpload?: (file: File) => void
  onImageUpload?: (file: File) => void
  onOpinionChange?: (messageId: number, opinion: 'Y' | 'N' | null) => void
  isNewConversation?: boolean
  currentConversationId?: number
  setConversationTitle?: (title: string) => void
  fetchConversationList?: () => Promise<any>
}

export function ChatStreamMain({
  messages,
  input,
  isLoading,
  isStreaming = false,
  onInputChange,
  onSend,
  onStop,
  onKeyDown,
  onSelectMessage,
  selectedMessageId,
  onImageClick,
  attachments,
  onAttachmentsChange,
  onFileUpload,
  onImageUpload,
  onOpinionChange,
  isNewConversation,
  currentConversationId,
  setConversationTitle,
  fetchConversationList
}: ChatStreamMainProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showTopFade, setShowTopFade] = useState(false)
  const [processedMessages, setProcessedMessages] = useState<ProcessedMessages>({
    finalMessages: [],
    taskMessages: [],
    conversationGroups: new Map()
  })
  const lastUserMessageIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 处理消息分类
  useEffect(() => {
    const finalMsgs: ChatMessageType[] = [];
    const taskMsgs: any[] = [];
    const conversationGroups = new Map<string, any[]>();
    
    // 先预处理，找出所有的用户消息ID并初始化任务组
    messages.forEach(message => {
      if (message.role === "user" && message.id) {
        conversationGroups.set(message.id, []);
      }
    });
    
    let currentUserMsgId: string | null = null;
    let lastUserMsgId: string | null = null;
    
    // 处理所有消息，区分用户消息、最终回答和任务消息
    messages.forEach(message => {
      // 用户消息直接加入最终消息数组
      if (message.role === "user") {
        finalMsgs.push(message);
        // 记录用户消息ID，用于关联后续任务
        if (message.id) {
          lastUserMsgId = currentUserMsgId; // 保存上一个用户消息ID
          currentUserMsgId = message.id;
          
          // 保存最新的用户消息ID到ref中
          lastUserMessageIdRef.current = message.id;
        }
      } 
      // 助手消息需要进一步处理
      else if (message.role === "assistant") {
        // 如果有最终回答，加入最终消息数组
        if (message.finalAnswer) {
          finalMsgs.push(message);
          // 不要在这里重置currentUserMsgId，需要继续使用它来关联任务
        }
        
        // 处理所有步骤和内容作为任务消息
        if (message.steps && message.steps.length > 0) {
          message.steps.forEach(step => {
            // 处理step.contents（如果存在）
            if (step.contents && step.contents.length > 0) {
              step.contents.forEach((content: any) => {
                const taskMsg = {
                  type: content.type,
                  content: content.content,
                  id: content.id,
                  assistantId: message.id,
                  relatedUserMsgId: currentUserMsgId
                };
                taskMsgs.push(taskMsg);
                
                // 如果有关联的用户消息，添加到对应的任务组
                if (currentUserMsgId && conversationGroups.has(currentUserMsgId)) {
                  const tasks = conversationGroups.get(currentUserMsgId) || [];
                  tasks.push(taskMsg);
                  conversationGroups.set(currentUserMsgId, tasks);
                }
              });
            }
            
            // 处理step.thinking（如果存在）
            if (step.thinking && step.thinking.content) {
              const taskMsg = {
                type: "model_output_thinking",
                content: step.thinking.content,
                id: `thinking-${step.id}`,
                assistantId: message.id,
                relatedUserMsgId: currentUserMsgId
              };
              taskMsgs.push(taskMsg);
              
              // 如果有关联的用户消息，添加到对应的任务组
              if (currentUserMsgId && conversationGroups.has(currentUserMsgId)) {
                const tasks = conversationGroups.get(currentUserMsgId) || [];
                tasks.push(taskMsg);
                conversationGroups.set(currentUserMsgId, tasks);
              }
            }
            
            // 处理step.code（如果存在）
            if (step.code && step.code.content) {
              const taskMsg = {
                type: "model_output_code",
                content: step.code.content,
                id: `code-${step.id}`,
                assistantId: message.id,
                relatedUserMsgId: currentUserMsgId
              };
              taskMsgs.push(taskMsg);
              
              // 如果有关联的用户消息，添加到对应的任务组
              if (currentUserMsgId && conversationGroups.has(currentUserMsgId)) {
                const tasks = conversationGroups.get(currentUserMsgId) || [];
                tasks.push(taskMsg);
                conversationGroups.set(currentUserMsgId, tasks);
              }
            }
            
            // 处理step.output（如果存在）
            if (step.output && step.output.content) {
              const taskMsg = {
                type: "tool",
                content: step.output.content,
                id: `output-${step.id}`,
                assistantId: message.id,
                relatedUserMsgId: currentUserMsgId
              };
              taskMsgs.push(taskMsg);
              
              // 如果有关联的用户消息，添加到对应的任务组
              if (currentUserMsgId && conversationGroups.has(currentUserMsgId)) {
                const tasks = conversationGroups.get(currentUserMsgId) || [];
                tasks.push(taskMsg);
                conversationGroups.set(currentUserMsgId, tasks);
              }
            }
          });
        }
        
        // 处理thinking状态（如果存在）
        if (message.thinking && message.thinking.length > 0) {
          message.thinking.forEach((thinking, index) => {
            const taskMsg = {
              type: "model_output_thinking",
              content: thinking.content,
              id: `thinking-${message.id}-${index}`,
              assistantId: message.id,
              relatedUserMsgId: currentUserMsgId
            };
            taskMsgs.push(taskMsg);
            
            // 如果有关联的用户消息，添加到对应的任务组
            if (currentUserMsgId && conversationGroups.has(currentUserMsgId)) {
              const tasks = conversationGroups.get(currentUserMsgId) || [];
              tasks.push(taskMsg);
              conversationGroups.set(currentUserMsgId, tasks);
            }
          });
        }
      }
    });
    
    // 检查并删除空的任务组
    for (const [key, value] of conversationGroups.entries()) {
      if (value.length === 0) {
        conversationGroups.delete(key);
      }
    }
    
    setProcessedMessages({
      finalMessages: finalMsgs,
      taskMessages: taskMsgs,
      conversationGroups: conversationGroups
    });
  }, [messages]);
  
  // 监听滚动事件
  useEffect(() => {
    const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    
    if (!scrollAreaElement) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaElement as HTMLElement;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      
      // 显示/隐藏回到底部按钮
      if (distanceToBottom > 100) {
        setShowScrollButton(true);
      } else {
        setShowScrollButton(false);
      }

      // 显示顶部渐变效果
      if (scrollTop > 10) {
        setShowTopFade(true);
      } else {
        setShowTopFade(false);
      }
    };
    
    // 添加滚动事件监听
    scrollAreaElement.addEventListener('scroll', handleScroll);
    
    // 初始化时执行一次检查
    handleScroll();
    
    return () => {
      scrollAreaElement.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 滚动到底部函数
  const scrollToBottom = (smooth = false) => {
    const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollAreaElement) return;
    
    // 使用setTimeout确保在DOM更新后滚动
    setTimeout(() => {
      if (scrollAreaElement) {
        if (smooth) {
          scrollAreaElement.scrollTo({
            top: (scrollAreaElement as HTMLElement).scrollHeight,
            behavior: 'smooth'
          });
        } else {
          (scrollAreaElement as HTMLElement).scrollTop = (scrollAreaElement as HTMLElement).scrollHeight;
        }
      }
    }, 0);
  };

  // 处理点赞/点踩
  const handleOpinionChange = async (messageId: number, opinion: 'Y' | 'N' | null) => {
    if (onOpinionChange) {
      onOpinionChange(messageId, opinion);
    }
  };

  // 在消息更新时滚动到底部（如果用户已经在底部）
  useEffect(() => {
    if (processedMessages.finalMessages.length > 0) {
      scrollToBottom();
    }
  }, [processedMessages.finalMessages.length, processedMessages.conversationGroups.size]);

  // 在任务消息更新时也滚动到底部
  useEffect(() => {
    const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollAreaElement) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaElement as HTMLElement;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    
    // 如果用户已经在底部附近或者正在流式输出，则自动滚动
    if (distanceToBottom < 100 || isStreaming) {
      scrollToBottom();
    }
  }, [processedMessages.taskMessages.length, isStreaming]);

  // 检查当前是否正在进行流式响应
  const isInStreamingConversation = () => {
    // 检查最后一条消息是否是用户消息
    if (processedMessages.finalMessages.length === 0) return false;
    
    const lastMessage = processedMessages.finalMessages[processedMessages.finalMessages.length - 1];
    const isLastMessageFromUser = lastMessage.role === "user";
    
    // 如果是流式响应状态且最后一条是用户消息，则正在进行流式响应
    return isStreaming && isLastMessageFromUser;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* 主要消息区域 */}
      <ScrollArea className="flex-1 px-4 pt-4" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto">
          {processedMessages.finalMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
              <div className="w-full max-w-3xl">
                <ChatInput
                  input={input}
                  isLoading={isLoading}
                  isStreaming={isStreaming}
                  isInitialMode={true}
                  onInputChange={onInputChange}
                  onSend={onSend}
                  onStop={onStop}
                  onKeyDown={onKeyDown}
                  attachments={attachments}
                  onAttachmentsChange={onAttachmentsChange}
                  onFileUpload={onFileUpload}
                  onImageUpload={onImageUpload}
                />
              </div>
            </div>
          ) : (
            <>
              {processedMessages.finalMessages.map((message, index) => (
                <div key={message.id || index}>
                  <ChatStreamFinalMessage
                    message={message}
                    onSelectMessage={onSelectMessage}
                    isSelected={message.id === selectedMessageId}
                    searchResultsCount={message.searchResults?.length || 0}
                    imagesCount={message.images?.length || 0}
                    onImageClick={onImageClick}
                    onOpinionChange={onOpinionChange}
                  />
                  {message.role === "user" && processedMessages.conversationGroups.has(message.id!) && (
                    <TaskWindow
                      messages={processedMessages.conversationGroups.get(message.id!) || []}
                      isStreaming={isStreaming && lastUserMessageIdRef.current === message.id}
                    />
                  )}
                </div>
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 顶部渐变虚化效果 */}
      {showTopFade && (
        <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-10 bg-gradient-to-b from-background to-transparent"></div>
      )}

      {/* 滚动到底部按钮 */}
      {showScrollButton && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-[130px] left-1/2 transform -translate-x-1/2 z-20 rounded-full shadow-md bg-background hover:bg-background/90 border border-border h-8 w-8"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Scroll button clicked');
            scrollToBottom(true);
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}

      {/* 非初始模式下的输入框 */}
      {processedMessages.finalMessages.length > 0 && (
        <ChatInput
          input={input}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onInputChange={onInputChange}
          onSend={onSend}
          onStop={onStop}
          onKeyDown={onKeyDown}
          attachments={attachments}
          onAttachmentsChange={onAttachmentsChange}
          onFileUpload={onFileUpload}
          onImageUpload={onImageUpload}
        />
      )}
    </div>
  )
} 