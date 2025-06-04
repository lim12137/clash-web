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
import 'github-markdown-css/github-markdown.css'

interface MarkdownRendererProps {
  content: string
  className?: string
  searchResults?: SearchResult[]
}

// 根据 tool_sign 获取背景色
const getBackgroundColor = (toolSign: string) => {
  switch (toolSign) {
    case 'a': return '#E3F2FD'; // 浅蓝色
    case 'b': return '#E8F5E9'; // 浅绿色
    case 'c': return '#FFF3E0'; // 浅橙色
    case 'd': return '#F3E5F5'; // 浅紫色
    case 'e': return '#FFEBEE'; // 浅红色
    default: return '#E5E5E5'; // 默认浅灰色
  }
}

// 替换原来的 LinkIcon 组件
const CitationBadge = ({ toolSign, citeIndex }: { toolSign: string, citeIndex: number }) => (
  <span
    className="ds-markdown-cite"
    style={{
      verticalAlign: 'middle',
      fontVariant: 'tabular-nums',
      boxSizing: 'border-box',
      color: '#404040',
      cursor: 'pointer',
      background: getBackgroundColor(toolSign),
      borderRadius: '9px',
      flexShrink: 0,
      justifyContent: 'center',
      alignItems: 'center',
      height: '18px',
      marginLeft: '4px',
      padding: '0 6px',
      fontSize: '12px',
      fontWeight: 400,
      display: 'inline-flex',
      position: 'relative',
      top: '-2px'
    }}
  >
    {citeIndex}
  </span>
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
            <span className="inline-flex items-center cursor-pointer transition-colors">
              <CitationBadge toolSign={toolSign} citeIndex={citeIndex} />
            </span>
          </TooltipTrigger>
          {/* 强制 Portal 到 body */}
          <TooltipPrimitive.Portal>
            <TooltipContent
              side="top"
              align="center"
              sideOffset={5}
              className="rag-tooltip"
            >
              <div
                ref={tooltipRef}
                className="whitespace-pre-wrap"
              >
                {matchedResult ? (
                  <>
                    {matchedResult.url && matchedResult.url !== "#" ? (
                      <a
                        href={matchedResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rag-tooltip-title"
                      >
                        {handleConsecutiveNewlines(matchedResult.title)}
                      </a>
                    ) : (
                      <p className="rag-tooltip-title">{handleConsecutiveNewlines(matchedResult.title)}</p>
                    )}
                    <p className="rag-tooltip-desc">{handleConsecutiveNewlines(matchedResult.text)}</p>
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
        .markdown-body {
          background: transparent !important;
          min-height: 1em;
          padding-top: 0.5em;
          padding-bottom: 0.5em;
        }
        .markdown-body ul,
        .markdown-body ol {
          list-style-type: revert !important;
          list-style-position: revert !important;
          margin-left: revert !important;
          padding-left: revert !important;
        }
        .markdown-body li {
          display: list-item !important;
        }
      `}</style>
      <div className={`markdown-body ${className || ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({children}: any) => (
              <p className={`user-paragraph`}>
                <TextWrapper>{children}</TextWrapper>
              </p>
            ),
            code({node, inline, className, children, ...props}: any) {
              const match = /language-(\w+)/.exec(className || '')
              return !inline && match ? (
                <SyntaxHighlighter
                  style={oneLight}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code {...props}>
                  {children}
                </code>
              )
            },
            img: ({src, alt}: any) => (
              <img src={src} alt={alt} />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </>
  );
};