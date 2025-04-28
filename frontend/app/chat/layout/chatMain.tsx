import { useRef, useEffect, useState } from "react"
import { ScrollArea } from "@/components/ui/scrollArea"
import { ChatMessage } from "@/app/chat/internal/chatMessage"
import { ChatInput } from "@/app/chat/layout/chatInput"
import { ChatMessageType } from "@/types/chat"
import { FilePreview } from "@/app/chat/layout/chatInput"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

interface ChatMainProps {
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
}


export function ChatMain({
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
  onOpinionChange
}: ChatMainProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showTopFade, setShowTopFade] = useState(false)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const previousMessagesLengthRef = useRef<number>(0)

  // 检查是否在底部附近
  const checkIfNearBottom = (scrollAreaElement: Element): boolean => {
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaElement as HTMLElement;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    // 如果距离底部小于50px，认为用户已滚动到底部
    return distanceToBottom < 50;
  };

  // 监听滚动事件
  useEffect(() => {
    const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    
    if (!scrollAreaElement) return;
    
    const handleScroll = () => {
      const nearBottom = checkIfNearBottom(scrollAreaElement);
      setIsNearBottom(nearBottom);
      
      if (nearBottom) {
        // 用户已滚动到底部附近，恢复自动滚动
        setUserScrolled(false);
        setShowScrollButton(false);
      } else {
        // 用户不在底部，暂停自动滚动
        setUserScrolled(true);
        // 只要不在底部就显示按钮，不再设置额外阈值
        setShowScrollButton(true);
      }

      // 显示顶部渐变效果
      if ((scrollAreaElement as HTMLElement).scrollTop > 10) {
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

  // 滚动到底部的函数
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

  // 当消息数组改变时检查并滚动
  useEffect(() => {
    const currentMessagesLength = messages.length;
    const messagesChanged = currentMessagesLength !== previousMessagesLengthRef.current;
    const hasNewMessages = currentMessagesLength > previousMessagesLengthRef.current;
    
    // 保存当前消息数量用于下次比较
    previousMessagesLengthRef.current = currentMessagesLength;
    
    const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollAreaElement) return;
    
    // 新消息到达或内容流式加载时的自动滚动条件
    if (messagesChanged) {
      // 新消息到达时，如果用户在底部或加载中，自动滚动
      if (hasNewMessages && (isNearBottom || isLoading || !userScrolled)) {
        scrollToBottom();
      }
    } else if (isStreaming && isNearBottom) {
      // 在流式传输中且用户在底部时，始终自动滚动
      scrollToBottom();
    }
  }, [messages, isStreaming, isNearBottom, userScrolled, isLoading]);

  // 在加载状态变化时强制滚动到底部
  useEffect(() => {
    if (isLoading || isStreaming) {
      const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollAreaElement && checkIfNearBottom(scrollAreaElement)) {
        scrollToBottom();
      }
    }
  }, [isLoading, isStreaming]);

  // 确保组件初次挂载时滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 300); // 延迟300ms确保DOM已完全渲染
    }
  }, []); // 空依赖数组确保只在组件挂载时执行一次

  // 当消息内容更新时(特别是流式传输过程中)，检查是否需要滚动
  useEffect(() => {
    if (isStreaming && isNearBottom && !userScrolled) {
      scrollToBottom();
    }
  });

  // 添加处理点赞/点踩的函数
  const handleOpinionChange = async (messageId: number, opinion: 'Y' | 'N' | null) => {
    if (onOpinionChange) {
      // 直接调用父组件传递的处理函数
      onOpinionChange(messageId, opinion);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <ScrollArea className="flex-1 px-4 pt-4" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto">
          {messages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              onSelectMessage={onSelectMessage}
              isSelected={message.id === selectedMessageId}
              searchResultsCount={message.searchResults?.length || 0}
              imagesCount={message.images?.length || 0}
              onImageClick={onImageClick}
              onOpinionChange={(message_id, opinion_flag) => {
                console.log('[ChatMain] onOpinionChange 传递到 ChatMessage, :', message_id, 'opinion:', opinion_flag);
                handleOpinionChange(message_id, opinion_flag);
              }}
            />
          ))}
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
    </div>
  )
} 