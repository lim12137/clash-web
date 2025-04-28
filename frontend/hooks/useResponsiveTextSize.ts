import { useState, useRef, useEffect } from "react";

// 自定义Hook - 根据文本内容动态调整字体大小
export const useResponsiveTextSize = (text: string, containerWidth: number, maxFontSize: number = 24) => {
    const [fontSize, setFontSize] = useState(maxFontSize);
    const textRef = useRef<HTMLHeadingElement>(null);
    
    useEffect(() => {
      if (!textRef.current) return;
      
      const adjustFontSize = () => {
        const element = textRef.current;
        if (!element) return;
        
        // 从最大字体开始尝试
        let currentSize = maxFontSize;
        element.style.fontSize = `${currentSize}px`;
        
        // 如果文本溢出，减小字体大小直到适合
        while (element.scrollWidth > containerWidth && currentSize > 12) {
          currentSize -= 1;
          element.style.fontSize = `${currentSize}px`;
        }
        
        setFontSize(currentSize);
      };
      
      // 初始调整
      adjustFontSize();
      
      // 监听窗口大小变化
      window.addEventListener('resize', adjustFontSize);
      
      return () => {
        window.removeEventListener('resize', adjustFontSize);
      };
    }, [text, containerWidth, maxFontSize]);
    
    return { textRef, fontSize };
  };