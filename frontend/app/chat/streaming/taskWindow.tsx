import { useRef, useEffect, useState, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scrollArea"
import { ChatMessageType, TaskMessageType } from "@/types/chat"
import { MarkdownRenderer } from '@/components/ui/markdownRenderer'
import { Globe, Search, Zap, Bot, Code, FileText, HelpCircle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useChatTaskMessage } from "@/hooks/useChatTaskMessage"

// 图标映射字典 - 将字符串映射到对应的图标组件
const iconMap: Record<string, React.ReactNode> = {
  "search": <Search size={16} className="mr-2" color="#4b5563" />,
  "bot": <Bot size={16} className="mr-2" color="#4b5563" />,
  "code": <Code size={16} className="mr-2" color="#4b5563" />,
  "file": <FileText size={16} className="mr-2" color="#4b5563" />,
  "globe": <Globe size={16} className="mr-2" color="#4b5563" />,
  "zap": <Zap size={16} className="mr-2" color="#4b5563" />,
  // 添加更多图标映射...
  "default": <HelpCircle size={16} className="mr-2" color="#4b5563" /> // 默认图标
};

// 定义卡片项的类型
interface CardItem {
  icon?: string;
  text: string;
  [key: string]: any; // 允许其他属性
}

// 定义消息处理器接口，提高可扩展性
interface MessageHandler {
  canHandle: (message: any) => boolean;
  render: (message: any) => React.ReactNode;
}

// 定义不同类型消息的处理器
const messageHandlers: MessageHandler[] = [
  // 处理中 类型处理器 - 思考中，代码生成中，代码执行中
  {
    canHandle: (message) => 
      message.type === "agent_new_run" || 
      message.type === "generating_code" ||
      message.type === "executing",
    render: (message) => (
        <div style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          fontSize: "0.875rem",
          lineHeight: 1.5,
          color: "#6b7280",
          fontWeight: 500,
          borderRadius: "0.25rem",
          paddingTop: "0.2rem"
        }}>
          <span>{message.content}</span>
        </div>
      )
  },
  
  // 添加search_content_placeholder类型处理器 - 用于历史记录
  {
    canHandle: (message) => message.type === "search_content_placeholder",
    render: (message) => {
      // 查找message上下文中的搜索结果
      const messageContainer = message._messageContainer;
      if (!messageContainer || !messageContainer.search || messageContainer.search.length === 0) {
        return null;
      }
      
      // 构建搜索结果展示内容
      const searchResults = messageContainer.search;
      
      // 处理网站信息用于显示
      const siteInfos = searchResults.map((result: any) => {
        const pageUrl = result.url || "";
        let domain = "未知来源";
        let displayName = "未知来源";
        let baseUrl = "";
        let faviconUrl = "";
        let useDefaultIcon = false;
        
        // 解析URL
        if (pageUrl) {
          try {
            const parsedUrl = new URL(pageUrl);
            baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
            domain = parsedUrl.hostname;
            
            // 处理域名，移除www前缀和com/cn等后缀
            displayName = domain
              .replace(/^www\./, '') // 移除www.前缀
              .replace(/\.(com|cn|org|net|io|gov|edu|co|info|biz|xyz)(\.[a-z]{2})?$/, ''); // 移除常见后缀
            
            // 如果处理后为空，则使用原域名
            if (!displayName) {
              displayName = domain;
            }
            
            faviconUrl = `${baseUrl}/favicon.ico`;
          } catch (e) {
            console.error("URL解析错误:", e);
            useDefaultIcon = true;
          }
        } else {
          useDefaultIcon = true;
        }
        
        return { domain, displayName, faviconUrl, url: pageUrl, useDefaultIcon };
      });
      
      // 渲染搜索结果信息条
      return (
        <div style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}>
          {/* 单行显示多个来源网站 */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "0.25rem"
          }}>
            {/* "正在阅读"标签 - 单独一行 */}
            <div style={{
              fontSize: "0.875rem",
              color: "#6b7280",
              fontWeight: 500,
              paddingTop: "0.15rem"
            }}>
              阅读检索结果
            </div>
            
            {/* 网站图标和域名列表 - 新的一行 */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem"
            }}>
              {siteInfos.map((site: any, index: number) => (
                <div 
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.25rem 0.5rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.25rem",
                    fontSize: "0.75rem",
                    color: "#4b5563",
                    border: "1px solid #e5e7eb",
                    cursor: "pointer", /* 添加指针样式表明可点击 */
                    transition: "background-color 0.2s" /* 添加过渡效果 */
                  }}
                  onClick={() => {
                    if (site.url) {
                      window.open(site.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f3f4f6"; /* 悬停时变色 */
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f9fafb"; /* 恢复原色 */
                  }}
                  title={`访问 ${site.domain}`} /* 使用完整域名作为提示文字 */
                >
                  {site.useDefaultIcon ? (
                    <Globe 
                      size={16} 
                      className="mr-2"
                      color="#6b7280"
                    />
                  ) : (
                    <img 
                      src={site.faviconUrl} 
                      alt={site.domain}
                      style={{
                        width: "16px",
                        height: "16px",
                        marginRight: "0.5rem",
                        borderRadius: "2px"
                      }}
                      onError={(e) => {
                        // 如果图标加载失败，替换为React组件
                        const imgElement = e.target as HTMLImageElement;
                        // 标记该元素，防止重复触发onError
                        imgElement.style.display = 'none';
                        // 获取父元素
                        const parent = imgElement.parentElement;
                        if (parent) {
                          // 创建一个占位符div，作为Globe组件的容器
                          const placeholder = document.createElement('div');
                          placeholder.style.marginRight = '0.5rem';
                          placeholder.style.display = 'inline-flex';
                          placeholder.style.alignItems = 'center';
                          placeholder.style.justifyContent = 'center';
                          placeholder.style.width = '16px';
                          placeholder.style.height = '16px';
                          // 插入到img前面
                          parent.insertBefore(placeholder, imgElement);
                          // 渲染Globe图标到该元素 (这里只能用原生方式近似实现)
                          placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
                        }
                      }}
                    />
                  )}
                  <span>{site.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  },
  
  // card 类型处理器 - 展示带图标的卡片
  {
    canHandle: (message) => message.type === "card",
    render: (message) => {
      let cardItems: CardItem[] = [];
      
      try {
        // 解析卡片内容
        if (typeof message.content === 'string') {
          cardItems = JSON.parse(message.content);
        } else if (Array.isArray(message.content)) {
          cardItems = message.content;
        }
      } catch (error) {
        console.error("解析卡片内容失败:", error);
        return (
          <div style={{color: "red", padding: "8px"}}>
            无法解析卡片内容
          </div>
        );
      }
      
      if (!cardItems || cardItems.length === 0) {
        return null;
      }
      
      return (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginTop: "0.25rem"
        }}>
          {cardItems.map((card: CardItem, index: number) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.25rem 0.5rem",
                backgroundColor: "#f9fafb",
                borderRadius: "0.25rem",
                fontSize: "0.7rem",
                color: "#4b5563",
                border: "1px solid #e5e7eb",
                fontWeight: 500
              }}
            >
              {/* 根据图标名称从字典中获取对应图标组件 */}
              {card.icon && iconMap[card.icon] ? iconMap[card.icon] : iconMap["default"]}
              <span>{card.text}</span>
            </div>
          ))}
        </div>
      );
    }
  },
  
  // search_content 类型处理器 - 搜索结果
  {
    canHandle: (message) => {
      const isSearchContent = message.type === "search_content";
      return isSearchContent;
    },
    render: (message) => {
      
      // 从内容中提取搜索结果
      let searchResults = [];
      const content = message.content || "";
      
      try {
        // 尝试解析JSON内容
        if (typeof content === 'string') {
          // 解析JSON字符串
          const parsedContent = JSON.parse(content);
          
          // 检查是否为数组
          if (Array.isArray(parsedContent)) {
            searchResults = parsedContent;
          } else {
            // 如果不是数组但是对象，可能是单个结果
            searchResults = [parsedContent];
          }
        } else if (Array.isArray(content)) {
          // 如果已经是数组，直接使用
          searchResults = content;
        }
      } catch (error: any) {
        console.error("解析搜索结果失败:", error);
        return (
          <div style={{color: "red", padding: "8px"}}>
            无法解析搜索结果: {error.message}
          </div>
        );
      }
      
      // 如果没有搜索结果，显示空消息
      if (!searchResults || searchResults.length === 0) {
        return (
          <div style={{padding: "8px", color: "#6b7280"}}>
            未找到搜索结果
          </div>
        );
      }
      
      // 处理网站信息用于显示
      const siteInfos = searchResults.map((result: any) => {
        const pageUrl = result.url || "";
        let domain = "未知来源";
        let displayName = "未知来源";
        let baseUrl = "";
        let faviconUrl = "";
        let useDefaultIcon = false;
        
        // 解析URL
        if (pageUrl) {
          try {
            const parsedUrl = new URL(pageUrl);
            baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
            domain = parsedUrl.hostname;
            
            // 处理域名，移除www前缀和com/cn等后缀
            displayName = domain
              .replace(/^www\./, '') // 移除www.前缀
              .replace(/\.(com|cn|org|net|io|gov|edu|co|info|biz|xyz)(\.[a-z]{2})?$/, ''); // 移除常见后缀
            
            // 如果处理后为空，则使用原域名
            if (!displayName) {
              displayName = domain;
            }
            
            faviconUrl = `${baseUrl}/favicon.ico`;
          } catch (e) {
            console.error("URL解析错误:", e);
            useDefaultIcon = true;
          }
        } else {
          useDefaultIcon = true;
        }
        
        return { domain, displayName, faviconUrl, url: pageUrl, useDefaultIcon };
      });
      
      // 渲染搜索结果信息条
      return (
        <div style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}>
          {/* 单行显示多个来源网站 */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "0.25rem"
          }}>
            {/* "正在阅读"标签 - 单独一行 */}
            <div style={{
              fontSize: "0.875rem",
              color: "#6b7280",
              fontWeight: 500,
              paddingTop: "0.15rem"
            }}>
              阅读检索结果
            </div>
            
            {/* 网站图标和域名列表 - 新的一行 */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem"
            }}>
              {siteInfos.map((site: any, index: number) => (
                <div 
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.25rem 0.5rem",
                    backgroundColor: "#f9fafb",
                    borderRadius: "0.25rem",
                    fontSize: "0.75rem",
                    color: "#4b5563",
                    border: "1px solid #e5e7eb",
                    cursor: "pointer", /* 添加指针样式表明可点击 */
                    transition: "background-color 0.2s" /* 添加过渡效果 */
                  }}
                  onClick={() => {
                    if (site.url) {
                      window.open(site.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f3f4f6"; /* 悬停时变色 */
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f9fafb"; /* 恢复原色 */
                  }}
                  title={`访问 ${site.domain}`} /* 使用完整域名作为提示文字 */
                >
                  {site.useDefaultIcon ? (
                    <Globe 
                      size={16} 
                      className="mr-2"
                      color="#6b7280"
                    />
                  ) : (
                    <img 
                      src={site.faviconUrl} 
                      alt={site.domain}
                      style={{
                        width: "16px",
                        height: "16px",
                        marginRight: "0.5rem",
                        borderRadius: "2px"
                      }}
                      onError={(e) => {
                        // 如果图标加载失败，替换为React组件
                        const imgElement = e.target as HTMLImageElement;
                        // 标记该元素，防止重复触发onError
                        imgElement.style.display = 'none';
                        // 获取父元素
                        const parent = imgElement.parentElement;
                        if (parent) {
                          // 创建一个占位符div，作为Globe组件的容器
                          const placeholder = document.createElement('div');
                          placeholder.style.marginRight = '0.5rem';
                          placeholder.style.display = 'inline-flex';
                          placeholder.style.alignItems = 'center';
                          placeholder.style.justifyContent = 'center';
                          placeholder.style.width = '16px';
                          placeholder.style.height = '16px';
                          // 插入到img前面
                          parent.insertBefore(placeholder, imgElement);
                          // 渲染Globe图标到该元素 (这里只能用原生方式近似实现)
                          placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
                        }
                      }}
                    />
                  )}
                  <span>{site.displayName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  },
  
  // model_output 类型处理器 - 模型输出
  {
    canHandle: (message) => message.type === "model_output",
    render: (message) => (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: "0.875rem",
        lineHeight: 1.5,
        color: "#1f2937",
        fontWeight: 400
      }}>
        <MarkdownRenderer content={message.content} className="task-message-content" />
      </div>
    )
  },
  
  // execution 类型处理器 - 执行结果（不展示）
  {
    canHandle: (message) => message.type === "execution",
    render: (message) => null // 返回null，不渲染此类型的消息
  },
  
  // error 类型处理器 - 错误信息
  {
    canHandle: (message) => message.type === "error",
    render: (message) => (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: "0.875rem",
        lineHeight: 1.5,
        color: "#dc2626",
        fontWeight: 500,
        borderRadius: "0.25rem",
        paddingTop: "0.2rem"
      }}>
        <span>{message.content}</span>
      </div>
    )
  },
  
  // virtual 类型处理器 - 虚拟消息（不显示内容，仅作为卡片容器）
  {
    canHandle: (message) => message.type === "virtual",
    render: () => null
  },

  // 默认处理器 - 应放在最后
  {
    canHandle: () => true,
    render: (message) => {
      const content = message.content;
      if (typeof content === 'string') {
        return <MarkdownRenderer content={content} className="task-message-content" />;
      } else {
        return (
          <pre style={{
            whiteSpace: "pre-wrap", 
            fontSize: "0.75rem",
            fontFamily: "monospace"
          }}>
            {JSON.stringify(content, null, 2)}
          </pre>
        );
      }
    }
  }
];

interface TaskWindowProps {
  messages: TaskMessageType[]
  isStreaming?: boolean
}

export function TaskWindow({
  messages,
  isStreaming = false
}: TaskWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isExpanded, setIsExpanded] = useState(isStreaming)
  
  const { hasMessages, hasVisibleMessages, groupedMessages } = useChatTaskMessage(messages as ChatMessageType[]);

  // 自动滚动到底部的逻辑
  useEffect(() => {
    if (autoScroll && isStreaming) {
      scrollToBottom();
    }
  }, [messages, autoScroll, isStreaming]);

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    if (isExpanded) {
      const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (!scrollAreaElement) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollAreaElement as HTMLElement;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      
      // 如果用户已经在底部附近或者正在流式输出，则自动滚动
      if (distanceToBottom < 100 || isStreaming) {
        // 使用 requestAnimationFrame 来避免过于频繁的更新
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      }
    }
  }, [messages.length, isExpanded, isStreaming]);

  // 处理滚动区域的滚动事件
  useEffect(() => {
    const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    
    if (!scrollAreaElement) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaElement as HTMLElement;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      
      // 如果距离底部小于20px，认为用户滚动到了底部，启用自动滚动
      if (distanceToBottom < 20) {
        setAutoScroll(true);
      } else if (distanceToBottom > 30) { 
        // 如果距离底部超过30px，且是用户主动滚动，则禁用自动滚动
        setAutoScroll(false);
      }
    };
    
    scrollAreaElement.addEventListener('scroll', handleScroll);
    
    return () => {
      scrollAreaElement.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 监听消息变化时的自动折叠逻辑
  useEffect(() => {
    if (!isStreaming && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // 检查最后一条消息是否包含 finalAnswer
      if (lastMessage.finalAnswer) {
        const timer = setTimeout(() => {
          setIsExpanded(false);
        }, 1000); // 1秒后折叠
        return () => clearTimeout(timer);
      }
    }
  }, [messages, isStreaming]);

  // 滚动到底部函数
  const scrollToBottom = () => {
    const scrollAreaElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollAreaElement) return;
    
    // 使用 requestAnimationFrame 来优化性能
    requestAnimationFrame(() => {
      (scrollAreaElement as HTMLElement).scrollTop = (scrollAreaElement as HTMLElement).scrollHeight;
    });
  };

  // 使用处理器渲染消息内容
  const renderMessageContent = (message: any) => {
    // 查找第一个能够处理此消息类型的处理器
    
    const handler = messageHandlers.find(h => h.canHandle(message));
    if (handler) {
      return handler.render(message);
    }
    
    // 兜底处理，正常不会执行到这里
    console.warn("没有找到处理器:", { 
      messageType: message.type 
    });
    return <div className="text-sm text-gray-500">未知消息类型: {message.type}</div>;
  };

  // 判断是否为最后一条消息
  const isLastMessage = (index: number, messages: any[]) => {
    return index === messages.length - 1;
  };

  // 判断一条消息是否应该显示闪烁的圆点
  const shouldBlinkDot = (message: any, index: number, messages: any[]) => {
    // 只要是最后一条消息且正在流式响应中，就应该闪烁，不论消息类型
    return isStreaming && isLastMessage(index, messages);
  };

  // 渲染消息列表
  const renderMessages = () => {
    if (!hasMessages) {
      return (
        <div className="text-center text-sm text-gray-400 mt-8">
          暂无任务消息
        </div>
      );
    }

    if (!hasVisibleMessages) {
      return (
        <div className="text-center text-sm text-gray-400 mt-8">
          暂无任务消息
        </div>
      );
    }

    return (
      <div className="relative pl-3">
        {groupedMessages.length > 1 && (
          <div className="absolute left-1.5 top-[0.65rem] bottom-[0.65rem] w-0.5 bg-gray-200"></div>
        )}

        {groupedMessages.map((group, groupIndex) => {
          const message = group.message;
          const isBlinking = shouldBlinkDot(message, groupIndex, groupedMessages.map(g => g.message));
          
          return (
            <div key={message.id || groupIndex} className="relative mb-5">
              {/* 圆点 - 根据条件添加闪烁效果 */}
              <div className="absolute left-[-9px] top-[0.55rem]">
                <div 
                  className={isBlinking ? "blinkingDot" : ""}
                  style={isBlinking ? {
                    width: "0.5rem",
                    height: "0.5rem",
                    borderRadius: "9999px"
                  } : {
                    width: "0.5rem",
                    height: "0.5rem",
                    borderRadius: "9999px",
                    backgroundColor: message.type === "virtual" ? "transparent" : "#9ca3af"
                  }}
                ></div>
              </div>
              
              {/* 消息内容 */}
              <div className="ml-3 text-sm break-words">
                {renderMessageContent(message)}
                
                {/* 渲染卡片消息 */}
                {group.cards.length > 0 && (
                  <div className="mt-2">
                    {group.cards.map((card, cardIndex) => (
                      <div key={`card-${cardIndex}`} className="ml-0">
                        {renderMessageContent(card)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {isExpanded ? (
        <div className="relative rounded-lg border border-gray-200 shadow-md h-[300px] mb-2 overflow-hidden">
          <div className="p-2 border-b border-gray-100/50">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-500">任务详情</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
                onClick={() => setIsExpanded(false)}
              >
                <ChevronRight className="h-4 w-4 rotate-90" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-[252px] px-4" ref={scrollAreaRef}>
            {renderMessages()}
          </ScrollArea>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mb-2 w-full bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"
          onClick={() => setIsExpanded(true)}
        >
          <ChevronRight className="h-4 w-4 mr-2 -rotate-90" />
          <span className="text-xs text-gray-500">展开任务执行详情</span>
        </Button>
      )}

      {/* 添加必要的CSS动画 */}
      <style jsx global>{`
        @keyframes blinkingDot {
          0% { background-color: rgba(59, 130, 246, 0.5); }
          50% { background-color: rgba(79, 70, 229, 1); }
          100% { background-color: rgba(59, 130, 246, 0.5); }
        }
        .blinkingDot {
          animation: blinkingDot 1.5s infinite ease-in-out;
          background-color: rgba(79, 70, 229, 1);
          box-shadow: 0 0 5px rgba(79, 70, 229, 0.5);
        }
      `}</style>
    </>
  )
} 