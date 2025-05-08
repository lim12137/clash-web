import { useMemo } from 'react';
import { ChatMessageType, TaskMessageType } from '@/types/chat';

interface MessageGroup {
  message: TaskMessageType;
  cards: TaskMessageType[];
}

export interface ChatTaskMessageResult {
  visibleMessages: TaskMessageType[];
  groupedMessages: MessageGroup[];
  hasMessages: boolean;
  hasVisibleMessages: boolean;
}

export function useChatTaskMessage(messages: ChatMessageType[]): ChatTaskMessageResult {
  // 过滤可见消息
  const visibleMessages = useMemo(() => 
    messages.filter(message => 
      (message as TaskMessageType).type !== "final_answer" && 
      (message as TaskMessageType).type !== "execution"
    ) as TaskMessageType[],
    [messages]
  );

  // 将消息分组
  const groupedMessages = useMemo(() => {
    const groups: MessageGroup[] = [];
    let cardMessages: TaskMessageType[] = [];
    
    visibleMessages.forEach(message => {
      if (message.type === "card") {
        // 收集卡片消息
        cardMessages.push(message);
      } else {
        // 如果之前有非卡片消息，将其与卡片一起推入分组
        if (groups.length > 0) {
          const lastGroup = groups[groups.length - 1];
          lastGroup.cards = [...cardMessages];
          cardMessages = []; // 重置卡片收集器
        }
        
        // 添加新的非卡片消息
        groups.push({
          message,
          cards: []
        });
      }
    });
    
    // 处理循环结束后剩余的卡片
    if (cardMessages.length > 0) {
      if (groups.length > 0) {
        // 如果有其他消息，将卡片附加到最后一个消息
        const lastGroup = groups[groups.length - 1];
        lastGroup.cards = [...cardMessages];
      } else {
        // 如果只有卡片消息，创建一个虚拟消息组
        groups.push({
          message: {
            id: `virtual-${Date.now()}`,
            role: "assistant",
            type: "virtual",
            content: "",
            timestamp: new Date()
          } as TaskMessageType,
          cards: cardMessages
        });
      }
    }

    return groups;
  }, [visibleMessages]);

  return {
    visibleMessages,
    groupedMessages,
    hasMessages: messages.length > 0,
    hasVisibleMessages: visibleMessages.length > 0
  };
} 