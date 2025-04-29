"use client"

import { useState, useEffect, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Copy,  Terminal, Volume2, ChevronRight, Code, AlertCircle, Bot, Loader2, SquareCheckBig, SquareChartGantt } from "lucide-react"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { MarkdownRenderer } from '@/components/ui/markdownRenderer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RiRobot2Line } from "react-icons/ri"
import { useConfig } from "@/hooks/useConfig"
import { API_ENDPOINTS } from '@/services/api'
import { ChatMessageType } from '@/types/chat'
import { ChatAttachment, AttachmentItem } from '@/app/chat/internal/chatAttachment'
import { FaRegThumbsDown, FaRegThumbsUp } from "react-icons/fa"

interface MessageProps {
  message: ChatMessageType
  isHistoryView?: boolean // 添加这个标志来区分历史视图
  onSelectMessage?: (messageId: string) => void // 添加消息选择回调
  isSelected?: boolean // 添加是否被选中的标志
  searchResultsCount?: number
  imagesCount?: number
  onImageClick?: (imageUrl: string) => void // 添加图片点击回调
  onOpinionChange?: (messageId: number, opinion: 'Y' | 'N' | null) => void
}

export function ChatMessage({ 
  message, 
  onSelectMessage,
  isSelected = false,
  searchResultsCount = 0,
  imagesCount = 0,
  onImageClick,
  onOpinionChange,
}: MessageProps) {
  const { getAppAvatarUrl } = useConfig();
  const avatarUrl = getAppAvatarUrl(20); // 消息头像大小为 20px
  
  // 提取steps以避免undefined错误
  const messageSteps = message?.steps || [];
  const hasSteps = messageSteps.length > 0;

  const previousIsCompleteRef = useRef(message.isComplete)
  
  // 添加按钮状态
  const [copied, setCopied] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  
  // 添加语音播报所需的引用
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ttsWebsocketRef = useRef<WebSocket | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  // 添加音频可用性状态
  const [audioAvailable, setAudioAvailable] = useState(false)
  
  // 在组件顶部添加状态管理
  const [expandedStepIds, setExpandedStepIds] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    if (messageSteps) {
      messageSteps.forEach(step => {
        // 默认折叠所有步骤
        initialState[step.id] = false;
      });
    }
    return initialState;
  });

  const [expandedContentIds, setExpandedContentIds] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    if (messageSteps) {
      messageSteps.forEach(step => {
        if (step.contents) {
          step.contents.forEach(content => {
            // 默认折叠所有内容
            initialState[content.id] = false;
          });
        }
      });
    }
    return initialState;
  });

  // 点赞/点踩按钮状态
  const [localOpinion, setLocalOpinion] = useState<string | null>(message.opinion_flag ?? null);

  useEffect(() => {
    setLocalOpinion(message.opinion_flag ?? null);
  }, [message.opinion_flag]);

  // 修改处理消息内容解析的 effect
  useEffect(() => {
    if (message.role === "assistant") {
      let stepsToSet = messageSteps || [];
      
      // 更新展开状态
      const newStepState = { ...expandedStepIds };
      const newContentState = { ...expandedContentIds };
      
      stepsToSet.forEach(step => {
        // 默认折叠所有步骤
        newStepState[step.id] = false;
        
        if (step.contents) {
          step.contents.forEach(content => {
            // 默认折叠所有内容
            newContentState[content.id] = false;
          });
        }
      });
      
      setExpandedStepIds(newStepState);
      setExpandedContentIds(newContentState);
    }
  }, [message.content, message.role, messageSteps]);

  // 修改处理消息完成状态的 effect
  useEffect(() => {
    if (message.isComplete && !previousIsCompleteRef.current) {
      const timer = setTimeout(() => {
        // 当消息完成时，关闭所有展开的内容
        setExpandedContentIds(prev => {
          const newState = { ...prev };
          Object.keys(newState).forEach(key => {
            newState[key] = false;
          });
          return newState;
        });
        
        setExpandedStepIds(prev => {
          const newState = { ...prev };
          Object.keys(newState).forEach(key => {
            newState[key] = false;
          });
          return newState;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
    previousIsCompleteRef.current = message.isComplete;
  }, [message.isComplete]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      // 关闭WebSocket连接
      if (ttsWebsocketRef.current && ttsWebsocketRef.current.readyState !== WebSocket.CLOSED) {
        ttsWebsocketRef.current.close();
        ttsWebsocketRef.current = null;
      }
      
      // 停止音频播放
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      }
      
      // 清除音频块
      audioChunksRef.current = [];
    };
  }, []);

  // 添加处理按钮点击事件的函数
  const handleCopyContent = () => {
    if (message.finalAnswer) {
      navigator.clipboard.writeText(message.finalAnswer)
        .then(() => {
          setCopied(true)
          // 2秒后重置状态
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(err => {
          console.error("复制失败:", err)
        })
    }
  }

  const handleThumbsUp = () => {
    console.log('[ChatMessage] 点赞按钮被点击', message.message_id, localOpinion);
    const newOpinion = localOpinion === 'Y' ? null : 'Y';
    setLocalOpinion(newOpinion);
    if (onOpinionChange && message.message_id) {
      onOpinionChange(message.message_id, newOpinion as 'Y' | 'N' | null);
    }
  };

  const handleThumbsDown = () => {
    console.log('[ChatMessage] 点踩按钮被点击', message.message_id, localOpinion);
    const newOpinion = localOpinion === 'N' ? null : 'N';
    setLocalOpinion(newOpinion);
    if (onOpinionChange && message.message_id) {
      onOpinionChange(message.message_id, newOpinion as 'Y' | 'N' | null);
    }
  };

  // 清除Markdown特殊字符，只保留中英文和标点符号
  const cleanMarkdownForTTS = (text: string): string => {
    if (!text) return "";
    
    // 移除代码块
    text = text.replace(/```[\s\S]*?```/g, "");
    
    // 移除内联代码
    text = text.replace(/`([^`]+)`/g, "$1");
    
    // 移除链接，保留链接文本
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    
    // 移除图片
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");
    
    // 移除标题符号 (#)，但保留文本
    text = text.replace(/^#{1,6}\s+(.+)$/gm, "$1");
    
    // 移除粗体和斜体标记，但保留文本
    text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
    text = text.replace(/(\*|_)(.*?)\1/g, "$2");
    
    // 移除列表标记，但保留文本
    text = text.replace(/^[\*\-+]\s+/gm, "");
    text = text.replace(/^\d+\.\s+/gm, "");
    
    // 移除引用符号，但保留文本
    text = text.replace(/^>\s+/gm, "");
    
    // 移除HTML标签
    text = text.replace(/<[^>]*>/g, "");
    
    // 替换连续的换行符为单个句号加空格，以便更好地区分段落
    text = text.replace(/\n{2,}/g, "。 ");
    
    // 保留单个换行符为空格
    text = text.replace(/\n/g, " ");
    
    // 移除多余空格
    text = text.replace(/\s{2,}/g, " ");
    
    return text.trim();
  };

  const handleVoicePlayback = () => {
    // 如果已经有可用的音频，直接播放
    if (audioAvailable && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        console.error("无法播放音频:", error);
      });
      setIsPlaying(true);
      return;
    }
    
    setIsPlaying(true);
    setIsConverting(true); // 设置为转换状态
    
    // 获取需要转换的文本内容
    const rawText = message.finalAnswer || message.content;
    
    // 清除Markdown特殊字符
    const textToSpeech = cleanMarkdownForTTS(rawText);
    
    if (!textToSpeech) {
      console.error("没有可朗读的内容");
      setIsPlaying(false);
      setIsConverting(false); // 重置转换状态
      return;
    }
    
    // 清空之前的音频块
    audioChunksRef.current = [];
    
    // 关闭现有WebSocket连接(如果有的话)
    if (ttsWebsocketRef.current && ttsWebsocketRef.current.readyState !== WebSocket.CLOSED) {
      ttsWebsocketRef.current.close();
      ttsWebsocketRef.current = null;
    }
    
    try {
      // 创建新的WebSocket连接
      ttsWebsocketRef.current = new WebSocket(`ws://${location.host}${API_ENDPOINTS.tts.ws}`);
      
      ttsWebsocketRef.current.onopen = function() {
        // 发送处理后的文本到服务器
        ttsWebsocketRef.current?.send(JSON.stringify({
          text: textToSpeech
        }));
      };
      
      ttsWebsocketRef.current.onmessage = function(event) {
        // 处理二进制音频数据
        if (event.data instanceof Blob) {
          audioChunksRef.current.push(event.data);
        } 
        // 处理JSON消息
        else {
          try {
            const data = JSON.parse(event.data);
            
            // 处理完成消息
            if (data.status === 'completed') {
              // 合并音频块并播放
              const audioBlob = new Blob(audioChunksRef.current, {type: 'audio/mp3'});
              const audioUrl = URL.createObjectURL(audioBlob);
              
              // 创建临时音频元素进行播放
              if (!audioRef.current) {
                audioRef.current = new Audio();
              }
              
              audioRef.current.src = audioUrl;
              audioRef.current.onended = () => {
                setIsPlaying(false);
                // 不要重置音频可用性
              };
              
              audioRef.current.onerror = (error) => {
                console.error("音频播放错误:", error);
                setIsPlaying(false);
                setIsConverting(false);
                setAudioAvailable(false);
              };
              
              // 播放音频
              audioRef.current.play().catch(error => {
                console.error("无法播放音频:", error);
                setIsPlaying(false);
                setIsConverting(false);
                setAudioAvailable(false);
              });
              
              // 音频转换完成，设置为可用状态
              setIsConverting(false);
              setAudioAvailable(true);
            }
            // 处理错误消息
            else if (data.error) {
              console.error('TTS服务错误:', data.error);
              setIsPlaying(false);
              setIsConverting(false);
              setAudioAvailable(false);
            }
          } catch (e) {
            console.error('解析消息错误:', e);
            setIsPlaying(false);
            setIsConverting(false);
            setAudioAvailable(false);
          }
        }
      };
      
      ttsWebsocketRef.current.onclose = function() {
        if (audioChunksRef.current.length === 0) {
          // 如果没有收到音频数据，重置播放状态
          setIsPlaying(false);
          setIsConverting(false);
          setAudioAvailable(false);
        }
      };
      
      ttsWebsocketRef.current.onerror = function(error) {
        console.error('TTS WebSocket错误:', error);
        setIsPlaying(false);
        setIsConverting(false);
        setAudioAvailable(false);
      };
      
    } catch (error) {
      console.error('TTS错误:', error);
      setIsPlaying(false);
      setIsConverting(false);
      setAudioAvailable(false);
    }
  }

  // 修改停止播放函数
  const handleStopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    
    // 仅在转换阶段关闭WebSocket连接
    if (isConverting && ttsWebsocketRef.current && ttsWebsocketRef.current.readyState !== WebSocket.CLOSED) {
      ttsWebsocketRef.current.close();
      ttsWebsocketRef.current = null;
      setIsConverting(false);
      setAudioAvailable(false);
    }
  }
  
  // 添加重新播放函数
  const handleReplayAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        console.error("无法重新播放音频:", error);
      });
    }
  }

  // 在组件内添加这些调试代码
  useEffect(() => {
    // 移除步骤数据的不必要日志
  }, [messageSteps]);

  // 修改消息选择处理函数
  const handleMessageSelect = () => {
    if (message.id && onSelectMessage) {
      // 移除所有消息选择的日志
      onSelectMessage(message.id);
    }
  };

  // 风格嵌入在组件内
  return (
    <div className={`flex gap-2 mb-6 ${message.role === "user" ? 'flex-row-reverse' : ''}`}>
      {/* 头像部分 - 只为AI助手显示头像 */}
      {message.role === "assistant" && (
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/10">
            <img src={avatarUrl} alt="应用图标" className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      {/* 消息内容部分 */}
      <div className={`${
        message.role === "user" 
          ? 'flex items-end flex-col w-full' 
          : 'flex-1 max-w-[calc(100%-60px)]'
        }`}>
        {/* 用户消息部分 */}
        {message.role === "user" && (
          <>
            {/* 附件部分 - 放在文本上方，多个附件可以并排显示 */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 w-full flex justify-end">
                <div className="max-w-[80%]">
                  <ChatAttachment 
                    attachments={message.attachments as AttachmentItem[]} 
                    onImageClick={onImageClick}
                    className="justify-end" // 靠右对齐
                  />
                </div>
              </div>
            )}
            
            {/* 文本内容 */}
            {message.content && (
              <div className="rounded-lg border bg-blue-50 border-blue-100 user-message-container py-0.7 px-3 ml-auto text-sm">
                <MarkdownRenderer 
                  content={message.content} 
                  className="user-message-content" 
                />
              </div>
            )}
          </>
        )}
        
        {/* 助手消息部分 */}
        {message.role === "assistant" && (
          <>
            {/* 附件部分 - 放在文本上方，多个附件可以并排显示 */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 w-full">
                <div className="max-w-[80%]">
                  <ChatAttachment 
                    attachments={message.attachments as AttachmentItem[]} 
                    onImageClick={onImageClick}
                  />
                </div>
              </div>
            )}
            
            {/* 文本内容 */}
            {message.content && (
              <div className="rounded-lg border mr-auto bg-white border-gray-200 w-full p-3 text-sm">
                <MarkdownRenderer content={message.content} />
              </div>
            )}
            
            {/* 渲染消息内容 */}
            <div className="prose dark:prose-invert">
              {/* 不再需要渲染minio_files */}
            </div>

            {/* 思考中状态和步骤区域 */}
            {message && message.role === "assistant" && (
              <>
                {/* 思考中状态 */}
                {!hasSteps && !message.isComplete && (
                  <div className="flex items-center space-x-2 text-muted-foreground min-h-[32px] py-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {message.thinking && message.thinking.length > 0 ? (
                      <span className="text-sm leading-tight">{message.thinking[0].content}</span>
                    ) : (
                      <span className="text-sm leading-tight">正在思考中...</span>
                    )}
                  </div>
                )}

                {/* 步骤区域 */}
                {hasSteps && (
                  <div className="space-y-2 mt-0 ml-[0px] w-full">
                    {messageSteps.map((step, index) => (
                      <div key={step.id} className="border border-gray-200 rounded-lg shadow-sm">
                        <Collapsible
                          open={expandedStepIds[step.id] ?? true}
                          onOpenChange={(open) => {
                            setExpandedStepIds(prev => ({
                              ...prev,
                              [step.id]: open
                            }));
                          }}
                        >
                          <CollapsibleTrigger className="flex items-center justify-between w-full py-0.7 px-2 font-medium bg-gray-100 border-b border-gray-200 text-xs group">
                            <div className="flex items-center">
                              <ChevronRight className="h-3.5 w-3.5 mr-2 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              <SquareChartGantt className="h-4 w-4 mr-2 text-blue-500" />
                              <span className="text-left">
                                <MarkdownRenderer content={step.title || `步骤 ${index + 1}`} />
                              </span>
                            </div>
                            
                            {/* 带样式包装的原始 HTML */}
                            {step.metrics && (
                              <div className="bg-gray-50 px-2 py-0.5 rounded-full" dangerouslySetInnerHTML={{ __html: step.metrics }} />
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="p-3 space-y-2">
                            {step.contents && step.contents.length > 0 && step.contents.map((content) => (
                              <div key={content.id} className="border border-gray-100 rounded-md shadow-xs mb-2">
                                <Collapsible 
                                  open={content.type === "model_output" || content.type === "parsing" 
                                    ? (expandedContentIds[content.id] ?? true) 
                                    : (expandedContentIds[content.id] ?? false)}
                                  onOpenChange={(open) => {
                                    setExpandedContentIds(prev => ({
                                      ...prev,
                                      [content.id]: open
                                    }));
                                  }}
                                >
                                  <CollapsibleTrigger className="flex items-center w-full p-1.5 text-xs font-medium bg-gray-50 border-b border-gray-100 group">
                                    <ChevronRight className="h-3 w-3 mr-2 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                    {content.type === "parsing" && <Code className="h-3.5 w-3.5 mr-2 text-blue-500" />}
                                    {content.type === "error" && <AlertCircle className="h-3.5 w-3.5 mr-2 text-red-500" />}
                                    {content.type === "agent_run" && <Bot className="h-3.5 w-3.5 mr-2 text-yellow-500" />}
                                    {content.type === "executing" && index + 1 === messageSteps.length && <Loader2 className="h-3.5 w-3.5 mr-2 text-blue-500 animate-spin" />}
                                    {content.type === "generating_code" && <Loader2 className="h-3.5 w-3.5 mr-2 text-purple-500 animate-spin" />}
                                    <span>
                                      {content.type === "model_output" && "模型输出"}
                                      {content.type === "parsing" && "代码解析"}
                                      {content.type === "execution" && "执行结果"}
                                      {content.type === "error" && "错误信息"}
                                      {content.type === "agent_run" && "代理运行"}
                                      {content.type === "executing" && "正在执行代码..."}
                                      {content.type === "generating_code" && "代码生成中..."}
                                    </span>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className={`p-2 text-xs ${content.type === "error" ? "bg-red-50" : ""} ${content.type === "executing" ? "bg-blue-50" : ""} ${content.type === "generating_code" ? "bg-purple-50" : ""}`}>
                                    {content.type === "executing" ? (
                                      <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-4 w-4 mr-2 text-blue-500 animate-spin" />
                                        <span className="text-blue-600">正在执行代码...</span>
                                      </div>
                                    ) : content.type === "generating_code" ? (
                                      <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-4 w-4 mr-2 text-purple-500 animate-spin" />
                                        <span className="text-purple-600">代码生成中...</span>
                                      </div>
                                    ) : (
                                      <MarkdownRenderer content={content.content} className={content.type === "error" ? "text-red-600" : ""} />
                                    )}
                                  </CollapsibleContent>
                                </Collapsible>
                              </div>
                            ))}
                            
                            {/* 兼容旧版结构的 Collapsible 组件 */}
                            {step.thinking?.content && (
                              <Collapsible
                                open={expandedContentIds[`${step.id}-thinking`] ?? false}
                                onOpenChange={(open) => {
                                  setExpandedContentIds(prev => ({
                                    ...prev,
                                    [`${step.id}-thinking`]: open
                                  }));
                                }}
                              >
                                <CollapsibleTrigger className="flex items-center w-full p-1.5 text-xs font-medium bg-gray-50 border-b border-gray-100 group">
                                  <ChevronRight className="h-3 w-3 mr-2 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                  <SquareChartGantt className="h-4 w-4 mr-2 text-blue-500" />
                                  <span>思考过程</span>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="p-2 text-xs">
                                  <MarkdownRenderer content={step.thinking.content} />
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            {step.code?.content && (
                              <Collapsible
                                open={expandedContentIds[`${step.id}-code`] ?? false}
                                onOpenChange={(open) => {
                                  setExpandedContentIds(prev => ({
                                    ...prev,
                                    [`${step.id}-code`]: open
                                  }));
                                }}
                              >
                                <CollapsibleTrigger className="flex items-center w-full p-1.5 text-xs font-medium bg-gray-50 border-b border-gray-100 group">
                                  <ChevronRight className="h-3 w-3 mr-2 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                  <Code className="h-3.5 w-3.5 mr-2 text-blue-500" />
                                  <span>代码</span>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="p-2 text-xs">
                                  <MarkdownRenderer content={step.code.content} />
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            {step.output?.content && (
                              <Collapsible
                                open={expandedContentIds[`${step.id}-output`] ?? false}
                                onOpenChange={(open) => {
                                  setExpandedContentIds(prev => ({
                                    ...prev,
                                    [`${step.id}-output`]: open
                                  }));
                                }}
                              >
                                <CollapsibleTrigger className="flex items-center w-full p-1.5 text-xs font-medium bg-gray-50 border-b border-gray-100 group">
                                  <ChevronRight className="h-3 w-3 mr-2 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                  <Terminal className="h-3.5 w-3.5 mr-2 text-yellow-500" />
                                  <span>执行结果</span>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="p-2 text-xs">
                                  <MarkdownRenderer content={step.output.content} />
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    ))}
                  </div>
                )}

                {/* 最终回答 */}
                {message.finalAnswer && (
                  <div className="mt-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center w-full py-0.7 px-2 font-medium bg-gray-100 border-b border-gray-200 group">
                      <SquareCheckBig className="h-4 w-4 mr-2 text-purple-500" />
                      <MarkdownRenderer content="**最终回答**" />
                    </div>
                    <div className="px-3 pb-3">
                      <MarkdownRenderer 
                        content={message.finalAnswer} 
                        searchResults={message.searchResults}
                      />
                      
                      {/* 按钮组 - 不再检查 isHistoryView */}
                       <div className="flex items-center justify-between mt-3">
                        {/* 添加溯源按钮 - 放在底部左下角，只有当有内容时才显示 */}
                        {((message.searchResults && message.searchResults.length > 0) || (message.images && message.images.length > 0)) && (
                          <div className="flex items-center text-xs text-gray-500">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`flex items-center gap-1 p-1 pl-3 hover:bg-gray-100 rounded transition-all duration-200 border border-gray-200 ${
                                isSelected ? 'bg-gray-100' : ''
                              }`}
                              onClick={handleMessageSelect}
                            >
                              <span>
                                {`${searchResultsCount ? `${searchResultsCount}条来源` : ""}${searchResultsCount && imagesCount ? "，" : ""}${imagesCount ? `${imagesCount}张图片` : ""}`}
                              </span>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2 mt-3 justify-end">
                          <TooltipProvider>
                            {/* 状态指示文本 */}
                            {(isPlaying || isConverting) && (
                              <span className={`mr-2 text-xs font-medium ${
                                isConverting ? "text-yellow-600" : "text-purple-600"
                              }`}>
                                {isConverting ? "正在转换语音..." : "正在播放..."}
                              </span>
                            )}

                            {/* 复制按钮 */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={`h-8 w-8 rounded-full bg-white hover:bg-gray-100 transition-all duration-200 shadow-sm ${
                                    copied ? "bg-green-100 text-green-600 border-green-200 opacity-100" : ""
                                  }`}
                                  onClick={handleCopyContent}
                                  disabled={copied}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{copied ? "已复制" : "复制内容"}</p>
                              </TooltipContent>
                            </Tooltip>

                            {/* 点赞按钮 */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={localOpinion === 'Y' ? "secondary" : "outline"}
                                  size="icon"
                                  className={`h-8 w-8 rounded-full ${localOpinion === 'Y' ? 'bg-green-100 text-green-600 border-green-200' : 'bg-white hover:bg-gray-100'} transition-all duration-200 shadow-sm`}
                                  onClick={handleThumbsUp}
                                >
                                  <FaRegThumbsUp className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="center" className="flex items-center">
                                <p>{localOpinion === 'Y' ? "取消点赞" : "点赞"}</p>
                              </TooltipContent>
                            </Tooltip>

                            {/* 点踩按钮 */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={localOpinion === 'N' ? "secondary" : "outline"}
                                  size="icon"
                                  className={`h-8 w-8 rounded-full ${localOpinion === 'N' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-white hover:bg-gray-100'} transition-all duration-200 shadow-sm`}
                                  onClick={handleThumbsDown}
                                >
                                  <FaRegThumbsDown className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="center" className="flex items-center">
                                <p>{localOpinion === 'N' ? "取消点踩" : "点踩"}</p>
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={`h-8 w-8 rounded-full bg-white hover:bg-gray-100 transition-all duration-200 shadow-sm ${
                                    isPlaying && isConverting ? "bg-yellow-100 text-yellow-600 border-yellow-200 animate-pulse opacity-100" :
                                    isPlaying ? "bg-purple-100 text-purple-600 border-purple-200 animate-pulse opacity-100" : ""
                                  }`}
                                  onClick={handleVoicePlayback}
                                  disabled={isPlaying}
                                >
                                  <Volume2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{isPlaying && isConverting ? "正在转换语音..." : isPlaying ? "正在播放..." : "语音播报"}</p>
                              </TooltipContent>
                            </Tooltip>

                            {/* 添加停止播放按钮 - 仅在播放时显示 */}
                            {isPlaying && !isConverting && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full bg-red-50 hover:bg-red-100 border-red-200 text-red-600 transition-all duration-200 shadow-sm"
                                    onClick={handleStopPlayback}
                                  >
                                    <span className="h-3 w-3 block bg-red-600 rounded-sm"></span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>停止播放</p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {/* 添加重新播放按钮 - 仅在播放时显示 */}
                            {isPlaying && !isConverting && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 rounded-full bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600 transition-all duration-200 shadow-sm"
                                    onClick={handleReplayAudio}
                                  >
                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1">
                                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                    </svg>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>重新播放</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                          </div>
                        </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}