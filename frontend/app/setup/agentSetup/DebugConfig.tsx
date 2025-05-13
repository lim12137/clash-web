"use client"

import { useState, useRef } from 'react'
import { Typography, Input, Button } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { conversationService } from '@/services/conversationService'
import { handleStreamResponse } from '@/app/chat/streaming/chatStreamHandler'
import { ChatMessageType, TaskMessageType } from '@/types/chat'
import { ChatStreamFinalMessage } from '@/app/chat/streaming/chatStreamFinalMessage'
import { TaskWindow } from '@/app/chat/streaming/taskWindow'

const { Text } = Typography

// Agent调试组件Props接口
interface AgentDebuggingProps {
  question: string;
  answer: string;
  onAskQuestion: (question: string) => void;
  isStreaming: boolean;
  messages: ChatMessageType[];
  taskMessages: TaskMessageType[];
  conversationGroups: Map<string, TaskMessageType[]>;
}

// 主组件Props接口
interface DebugConfigProps {
  testQuestion: string;
  setTestQuestion: (question: string) => void;
  testAnswer: string;
  setTestAnswer: (answer: string) => void;
}

// 用于生成唯一ID的计数器
const stepIdCounter = { current: 0 };

/**
 * Agent调试组件
 */
function AgentDebugging({ 
  question, 
  answer, 
  onAskQuestion,
  isStreaming,
  messages,
  taskMessages,
  conversationGroups
}: AgentDebuggingProps) {
  const [inputQuestion, setInputQuestion] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const handleSend = async () => {
    if (!inputQuestion.trim()) return;
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    
    try {
      // 调用父组件的处理函数
      await onAskQuestion(inputQuestion);
      setInputQuestion("");
    } catch (error) {
      console.error("发送问题失败:", error);
    } finally {
      abortControllerRef.current = null;
    }
  }
  
  // 处理消息的步骤内容
  const processMessageSteps = (message: ChatMessageType): TaskMessageType[] => {
    if (!message.steps || message.steps.length === 0) return [];
    
    const taskMsgs: TaskMessageType[] = [];
    message.steps.forEach(step => {
      // 处理 step.contents
      if (step.contents && step.contents.length > 0) {
        step.contents.forEach(content => {
          taskMsgs.push({
            id: content.id,
            role: "assistant",
            content: content.content,
            timestamp: new Date(),
            type: content.type
          });
        });
      }
      
      // 处理 step.thinking
      if (step.thinking && step.thinking.content) {
        taskMsgs.push({
          id: `thinking-${step.id}`,
          role: "assistant",
          content: step.thinking.content,
          timestamp: new Date(),
          type: "model_output_thinking"
        });
      }
      
      // 处理 step.code
      if (step.code && step.code.content) {
        taskMsgs.push({
          id: `code-${step.id}`,
          role: "assistant",
          content: step.code.content,
          timestamp: new Date(),
          type: "model_output_code"
        });
      }
      
      // 处理 step.output
      if (step.output && step.output.content) {
        taskMsgs.push({
          id: `output-${step.id}`,
          role: "assistant",
          content: step.output.content,
          timestamp: new Date(),
          type: "tool"
        });
      }
    });
    
    return taskMsgs;
  };
  
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex flex-col gap-4 flex-grow overflow-hidden">
        {/* 消息展示区域 */}
        <div className="flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar">
          {messages.map((message, index) => {
            // 处理当前消息的任务内容
            const currentTaskMessages = message.role === "assistant" ? processMessageSteps(message) : [];
            
            return (
              <div key={message.id || index} className="flex flex-col gap-2">
                {/* 用户消息 */}
                {message.role === "user" && (
                  <ChatStreamFinalMessage
                    message={message}
                    onSelectMessage={() => {}}
                    isSelected={false}
                    searchResultsCount={message.searchResults?.length || 0}
                    imagesCount={message.images?.length || 0}
                    onImageClick={() => {}}
                    onOpinionChange={() => {}}
                    hideButtons={true}
                  />
                )}
                
                {/* 助手消息的任务窗口 */}
                {message.role === "assistant" && currentTaskMessages.length > 0 && (
                  <TaskWindow
                    messages={currentTaskMessages}
                    isStreaming={isStreaming && index === messages.length - 1}
                  />
                )}
                
                {/* 助手消息的最终回答 */}
                {message.role === "assistant" && (
                  <ChatStreamFinalMessage
                    message={message}
                    onSelectMessage={() => {}}
                    isSelected={false}
                    searchResultsCount={message.searchResults?.length || 0}
                    imagesCount={message.images?.length || 0}
                    onImageClick={() => {}}
                    onOpinionChange={() => {}}
                    hideButtons={true}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        <Input
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="输入测试问题..."
          onPressEnter={handleSend}
          disabled={isStreaming}
        />
        <button
          onClick={handleSend}
          disabled={isStreaming}
          className={`min-w-[56px] px-4 py-1.5 rounded-md flex items-center justify-center text-sm ${
            isStreaming 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          } whitespace-nowrap`}
          style={{ border: "none" }}
        >
          {isStreaming ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  )
}

/**
 * 调试配置主组件
 */
export default function DebugConfig({
  testQuestion,
  setTestQuestion,
  testAnswer,
  setTestAnswer
}: DebugConfigProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [taskMessages, setTaskMessages] = useState<TaskMessageType[]>([]);
  const [conversationGroups] = useState<Map<string, TaskMessageType[]>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 重置超时计时器
  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsStreaming(false);
    }, 30000); // 30秒超时
  };

  // 处理测试问题
  const handleTestQuestion = async (question: string) => {
    setTestQuestion(question);
    setIsStreaming(true);
    
    // 添加用户消息
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date()
    };
    
    // 添加助手消息（初始状态）
    const assistantMessage: ChatMessageType = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isComplete: false
    };
    
    setMessages([userMessage, assistantMessage]);
    
    try {
      // 调用 agent_run
      const reader = await conversationService.runAgent({
        query: question,
        conversation_id: -1, // 调试模式不需要保存对话
        is_set: true,
        history: []
      });

      if (!reader) throw new Error("Response body is null");

      // 处理流式响应
      await handleStreamResponse(
        reader,
        setMessages,
        resetTimeout,
        stepIdCounter,
        () => {}, // setIsSwitchedConversation - 调试模式不需要
        false, // isNewConversation - 调试模式不需要
        () => {}, // setConversationTitle - 调试模式不需要
        async () => {}, // fetchConversationList - 调试模式不需要
        -1, // currentConversationId - 调试模式不需要
        conversationService
      );

      // 更新最终答案
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        setTestAnswer(lastMessage.finalAnswer || lastMessage.content || "");
      }
    } catch (error) {
      console.error("处理流式响应时出错:", error);
      const errorMessage = error instanceof Error ? error.message : "处理请求时发生错误";
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content = errorMessage;
          lastMsg.isComplete = true;
          lastMsg.error = errorMessage;
        }
        return newMessages;
      });
      
      setTestAnswer(errorMessage);
    } finally {
      setIsStreaming(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  return (
    <div className="w-full h-full bg-white">
      <AgentDebugging 
        question={testQuestion} 
        answer={testAnswer} 
        onAskQuestion={handleTestQuestion}
        isStreaming={isStreaming}
        messages={messages}
        taskMessages={taskMessages}
        conversationGroups={conversationGroups}
      />
    </div>
  )
} 