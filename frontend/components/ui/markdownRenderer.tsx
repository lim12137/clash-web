import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
// @ts-ignore
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SearchResult } from '@/types/chat'
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

interface MarkdownRendererProps {
  content: string
  className?: string
  searchResults?: SearchResult[]
}

const LinkIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    aria-hidden="true" 
    className="rag-icon" 
    width="1.2em" 
    height="1.2em" 
    viewBox="0 0 1024 1024"
  >
    <path 
      d="M183.25504 363.3152C225.03424 333.25056 274.0224 323.584 307.2 323.584h81.92a36.864 36.864 0 1 1 0 73.728H307.2c-21.38112 0-54.31296 6.71744-80.85504 25.8048-24.65792 17.77664-46.12096 47.63648-46.12096 101.1712 0 53.53472 21.46304 83.39456 46.12096 101.1712 26.54208 19.08736 59.47392 25.8048 80.85504 25.8048h81.92a36.864 36.864 0 1 1 0 73.728H307.2c-33.1776 0-82.20672-9.66656-123.94496-39.7312C139.6736 653.84448 106.496 601.82528 106.496 524.288c0-77.53728 33.1776-129.59744 76.75904-160.9728zM598.016 360.448a36.864 36.864 0 0 1 36.864-36.864h81.92c33.1776 0 82.16576 9.66656 123.94496 39.7312 43.6224 31.37536 76.75904 83.43552 76.75904 160.9728 0 77.53728-33.1776 129.55648-76.75904 160.9728-41.7792 30.06464-90.7264 39.7312-123.94496 39.7312h-81.92a36.864 36.864 0 0 1 0-73.728h81.92c21.42208 0 54.31296-6.71744 80.85504-25.8048 24.65792-17.77664 46.12096-47.63648 46.12096-101.1712 0-53.53472-21.46304-83.43552-46.12096-101.1712-26.54208-19.08736-59.43296-25.8048-80.85504-25.8048h-81.92a36.864 36.864 0 0 1-36.864-36.864z m-286.72 163.84a36.864 36.864 0 0 1 36.864-36.864h327.68a36.864 36.864 0 1 1 0 73.728H348.16a36.864 36.864 0 0 1-36.864-36.864z" 
      fill="currentColor"
    />
  </svg>
);

// 修改 HoverableText 组件
const HoverableText = ({ text, searchResults }: { 
  text: string;
  searchResults?: SearchResult[]
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const mousePositionRef = React.useRef({ x: 0, y: 0 });

  // Function to handle multiple consecutive line breaks
  const handleConsecutiveNewlines = (text: string) => {
    if (!text) return text;
    return text
      // First, standardize all types of line breaks to \n
      .replace(/\r\n/g, '\n')  // Windows line breaks
      .replace(/\r/g, '\n')    // Old Mac line breaks
      // Handle consecutive line breaks and whitespace
      .replace(/[\n\s]*\n[\n\s]*/g, '\n')  // Process whitespace around line breaks
      .replace(/^\s+|\s+$/g, '');  // Remove leading and trailing whitespace
  };

  // 查找对应搜索结果
  const toolSign = text.charAt(0);
  const citeIndex = parseInt(text.slice(1));
  const matchedResult = searchResults?.find(
    result => result.tool_sign === toolSign && result.cite_index === citeIndex
  );

  // 处理鼠标事件
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let closeTimeoutId: NodeJS.Timeout | null = null;

    // 更新鼠标位置的处理函数
    const updateMousePosition = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseEnter = () => {
      // 清除可能存在的关闭定时器
      if (closeTimeoutId) {
        clearTimeout(closeTimeoutId);
        closeTimeoutId = null;
      }
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // 延迟一小段时间再显示，避免用户快速划过时显示
      timeoutId = setTimeout(() => {
        setIsOpen(true);
      }, 50);
    };

    const handleMouseLeave = () => {
      // 清除打开定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // 延迟关闭tooltip，以便用户可以移动到tooltip内容上
      closeTimeoutId = setTimeout(() => {
        checkShouldClose();
      }, 100);
    };
    
    // 检查是否应该关闭tooltip的函数
    const checkShouldClose = () => {
      const tooltipContent = document.querySelector(".z-\\[9999\\]");
      const linkElement = containerRef.current;
      
      if (!tooltipContent || !linkElement) {
        setIsOpen(false);
        return;
      }
      
      const tooltipRect = tooltipContent.getBoundingClientRect();
      const linkRect = linkElement.getBoundingClientRect();
      const { x: mouseX, y: mouseY } = mousePositionRef.current;
      
      // 检查鼠标是否在tooltip或链接图标上
      const isMouseOverTooltip = 
        mouseX >= tooltipRect.left && 
        mouseX <= tooltipRect.right && 
        mouseY >= tooltipRect.top && 
        mouseY <= tooltipRect.bottom;
        
      const isMouseOverLink = 
        mouseX >= linkRect.left && 
        mouseX <= linkRect.right && 
        mouseY >= linkRect.top && 
        mouseY <= linkRect.bottom;
        
      // 如果鼠标既不在tooltip上也不在链接图标上，则关闭tooltip
      if (!isMouseOverTooltip && !isMouseOverLink) {
        setIsOpen(false);
      }
    };
    
    // 添加全局鼠标移动事件监听，处理任何位置移动
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 更新鼠标位置
      updateMousePosition(e);
      
      if (!isOpen) return;
      
      // 使用防抖逻辑，避免频繁计算
      if (closeTimeoutId) {
        clearTimeout(closeTimeoutId);
      }
      
      closeTimeoutId = setTimeout(() => {
        checkShouldClose();
      }, 100);
    };

    // 添加事件监听
    document.addEventListener('mousemove', handleGlobalMouseMove);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (closeTimeoutId) {
        clearTimeout(closeTimeoutId);
      }
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isOpen]);

  return (
    <TooltipProvider>
      <Tooltip open={isOpen}>
        <div
          ref={containerRef}
          className="inline-flex items-center relative"
          style={{ zIndex: isOpen ? 1000 : 'auto' }}
        >
          <TooltipTrigger asChild>
            <span 
              className="inline-flex items-center text-blue-600 cursor-pointer hover:text-blue-800 transition-colors"
              style={{ padding: '2px' }} // 增加点击区域
            >
              <LinkIcon />
            </span>
          </TooltipTrigger>
          {/* 强制 Portal 到 body */}
          <TooltipPrimitive.Portal>
            <TooltipContent 
              side="top"
              align="center"
              sideOffset={5}
              className="z-[9999] bg-white px-3 py-2 text-sm border shadow-md max-w-md"
              style={{
                '--scrollbar-width': '8px',
                '--scrollbar-height': '8px',
                '--scrollbar-track-bg': 'transparent',
                '--scrollbar-thumb-bg': 'rgb(209, 213, 219)',
                '--scrollbar-thumb-hover-bg': 'rgb(156, 163, 175)',
                '--scrollbar-thumb-radius': '9999px'
              } as React.CSSProperties}
            >
              <div
                ref={tooltipRef}
                className="whitespace-pre-wrap overflow-y-auto"
                style={{
                  maxHeight: 240,
                  minWidth: 200,
                  maxWidth: 400,
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--scrollbar-thumb-bg) var(--scrollbar-track-bg)'
                }}
              >
                <style jsx>{`
                  div::-webkit-scrollbar {
                    width: var(--scrollbar-width);
                    height: var(--scrollbar-height);
                  }
                  div::-webkit-scrollbar-track {
                    background: var(--scrollbar-track-bg);
                  }
                  div::-webkit-scrollbar-thumb {
                    background: var(--scrollbar-thumb-bg);
                    border-radius: var(--scrollbar-thumb-radius);
                  }
                  div::-webkit-scrollbar-thumb:hover {
                    background: var(--scrollbar-thumb-hover-bg);
                  }
                  @media (prefers-color-scheme: dark) {
                    div::-webkit-scrollbar-thumb {
                      background: rgb(55, 65, 81);
                    }
                    div::-webkit-scrollbar-thumb:hover {
                      background: rgb(75, 85, 99);
                    }
                  }
                `}</style>
                {matchedResult ? (
                  <>
                    {matchedResult.url && matchedResult.url !== "#" ? (
                      <a
                        href={matchedResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium mb-1 text-blue-600 hover:underline block"
                        style={{ wordBreak: 'break-all' }}
                      >
                        {handleConsecutiveNewlines(matchedResult.title)}
                      </a>
                    ) : (
                      <p 
                        className="font-medium mb-1"
                        style={{ cursor: 'pointer' }}
                      >
                        {handleConsecutiveNewlines(matchedResult.title)}
                      </p>
                    )}
                    <p className="text-gray-600">{handleConsecutiveNewlines(matchedResult.text)}</p>
                  </>
                ) : null}
              </div>
            </TooltipContent>
          </TooltipPrimitive.Portal>
        </div>
      </Tooltip>
    </TooltipProvider>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className,
  searchResults = [] 
}) => {
  // 调整自定义代码块样式为浅灰色
  const customStyle = {
    ...oneLight,
    'pre[class*="language-"]': {
      ...oneLight['pre[class*="language-"]'],
      background: '#f5f5f5', // 浅灰色背景
      borderRadius: '4px',
      padding: '12px',
      margin: '8px 0',
      fontSize: '1rem', // 调整代码块字体
      lineHeight: '1.6' // 增加代码块的行间距
    },
    'code[class*="language-"]': {
      ...oneLight['code[class*="language-"]'],
      background: '#f5f5f5', // 浅灰色背景
      color: '#333333', // 深灰色文字，提高可读性
      fontSize: '1rem', // 调整代码块字体
      lineHeight: '1.6' // 增加代码块的行间距
    }
  };

  // 检查是否是用户消息内容
  const isUserMessage = className?.includes('user-message-content');

  // 修改 processText 函数中的处理逻辑
  const processText = (text: string) => {
    if (typeof text !== 'string') return text;
    
    const parts = text.split(/(\[\[[^\]]+\]\])/g);
    return (
      <>
        {parts.map((part, index) => {
          const match = part.match(/^\[\[([^\]]+)\]\]$/);
          if (match) {
            const innerText = match[1];
            // 检查是否存在匹配的搜索结果
            const toolSign = innerText.charAt(0);
            const citeIndex = parseInt(innerText.slice(1));
            const hasMatch = searchResults?.some(
              result => result.tool_sign === toolSign && result.cite_index === citeIndex
            );
            
            // 只有找到匹配的搜索结果时才显示溯源图标
            if (hasMatch) {
              return <HoverableText key={index} text={innerText} searchResults={searchResults} />;
            } else {
              // 如果没有找到匹配的结果，返回空字符串（不显示任何内容）
              return '';
            }
          }
          return part;
        })}
      </>
    );
  };

  // 创建包装器组件处理不同类型的子元素
  const TextWrapper = ({ children }: { children: any }) => {
    if (typeof children === 'string') {
      return processText(children);
    }
    if (Array.isArray(children)) {
      return (
        <>
          {children.map((child, index) => {
            if (typeof child === 'string') {
              return <React.Fragment key={index}>{processText(child)}</React.Fragment>;
            }
            return child;
          })}
        </>
      );
    }
    return children;
  };
  
  return (
    <>
      <style jsx global>{`
        /* 全局滚动条样式 */
        .tooltip-content-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgb(209 213 219) transparent;
        }
        
        .tooltip-content-scroll::-webkit-scrollbar {
          width: 6px;
        }
        
        .tooltip-content-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .tooltip-content-scroll::-webkit-scrollbar-thumb {
          background-color: rgb(209 213 219);
          border-radius: 9999px;
        }
        
        .tooltip-content-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgb(156 163 175);
        }
        
        /* 暗色模式 */
        @media (prefers-color-scheme: dark) {
          .tooltip-content-scroll::-webkit-scrollbar-thumb {
            background-color: rgb(55 65 81);
          }
          
          .tooltip-content-scroll::-webkit-scrollbar-thumb:hover {
            background-color: rgb(75 85 99);
          }
        }
      `}</style>
      <div className={`markdown-content text-base leading-relaxed space-y-4 ${className || ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({children}: any) => (
              <p className={`my-3 text-base leading-relaxed ${isUserMessage ? 'user-paragraph' : ''}`}>
                <TextWrapper>{children}</TextWrapper>
              </p>
            ),
            // 标题样式
            h1: ({children}: any) => <h1 className="text-2xl font-bold my-6"><TextWrapper>{children}</TextWrapper></h1>,
            h2: ({children}: any) => <h2 className="text-xl font-bold my-5"><TextWrapper>{children}</TextWrapper></h2>,
            h3: ({children}: any) => <h3 className="text-lg font-bold my-4"><TextWrapper>{children}</TextWrapper></h3>,
            h4: ({children}: any) => <h4 className="text-base font-bold my-3"><TextWrapper>{children}</TextWrapper></h4>,
            h5: ({children}: any) => <h5 className="text-sm font-bold my-2"><TextWrapper>{children}</TextWrapper></h5>,
            h6: ({children}: any) => <h6 className="text-xs font-bold my-2"><TextWrapper>{children}</TextWrapper></h6>,
            // 列表样式
            ul: ({children}: any) => <ul className="list-disc ml-5 my-4 text-base leading-relaxed space-y-2">{children}</ul>,
            ol: ({children}: any) => <ol className="list-decimal ml-5 my-4 text-base leading-relaxed space-y-2">{children}</ol>,
            // 列表项
            li: ({children}: any) => (
              <li className="my-1.5 leading-relaxed">
                <TextWrapper>{children}</TextWrapper>
              </li>
            ),
            // 代码块样式
            code({node, inline, className, children, ...props}: any) {
              const match = /language-(\w+)/.exec(className || '')
              return !inline && match ? (
                <SyntaxHighlighter
                  style={customStyle}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={`bg-gray-100 px-1 rounded text-sm ${className || ''}`} {...props}>
                  {children}
                </code>
              )
            },
            // 粗体文本样式
            strong: ({children}: any) => <strong className="font-bold"><TextWrapper>{children}</TextWrapper></strong>,
            // 表格样式
            table: ({children}: any) => (
              <div className="overflow-x-auto my-5">
                <table className="min-w-full border-collapse border border-gray-300 text-base">
                  {children}
                </table>
              </div>
            ),
            thead: ({children}: any) => <thead className="bg-gray-100">{children}</thead>,
            tbody: ({children}: any) => <tbody className="leading-relaxed">{children}</tbody>,
            tr: ({children}: any) => <tr className="border-b border-gray-300">{children}</tr>,
            th: ({children}: any) => (
              <th className="px-4 py-3 border border-gray-300 text-left">
                <TextWrapper>{children}</TextWrapper>
              </th>
            ),
            td: ({children}: any) => (
              <td className="px-4 py-3 border border-gray-300">
                <TextWrapper>{children}</TextWrapper>
              </td>
            ),
            // 引用块样式
            blockquote: ({children}: any) => (
              <blockquote className="border-l-4 border-gray-300 pl-4 py-2 my-4 bg-gray-50 italic text-base leading-relaxed">
                <TextWrapper>{children}</TextWrapper>
              </blockquote>
            ),
            // 水平线样式
            hr: () => <hr className="my-6 border-t border-gray-300" />,
            // 添加链接样式
            a: ({href, children}: any) => (
              <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                <TextWrapper>{children}</TextWrapper>
              </a>
            ),
            // 添加图片样式
            img: ({src, alt}: any) => (
              <img src={src} alt={alt} className="max-w-full h-auto my-4 rounded" />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </>
  );
};