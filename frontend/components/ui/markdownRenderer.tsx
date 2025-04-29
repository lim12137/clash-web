import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
// @ts-ignore
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SearchResult } from '@/types/chat'

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
  // 跟踪当前鼠标位置
  const mousePositionRef = React.useRef({ x: 0, y: 0 });

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
          <TooltipContent 
            side="top"
            align="center"
            sideOffset={5}
            className="z-[9999] bg-white px-4 py-3 text-sm border shadow-lg max-w-md rounded-2xl"
            style={{ minWidth: '300px', maxWidth: '500px' }}
          >
            <div
              ref={tooltipRef}
              className="flex flex-col"
            >
              {matchedResult ? (
                <>
                  <div className="sticky top-0 pb-2 mb-1 border-b border-gray-200 bg-white">
                    {matchedResult.url && matchedResult.url !== "#" ? (
                      <a
                        href={matchedResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline block text-base"
                        style={{ wordBreak: 'break-all' }}
                      >
                        {matchedResult.title}
                      </a>
                    ) : (
                      <p className="font-medium text-base">{matchedResult.title}</p>
                    )}
                  </div>
                  <div 
                    className="whitespace-pre-wrap overflow-y-auto"
                    style={{
                      maxHeight: 200,
                      padding: '2px'
                    }}
                  >
                    <p className="text-gray-600">{matchedResult.text}</p>
                  </div>
                </>
              ) : null}
            </div>
          </TooltipContent>
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
  );
};