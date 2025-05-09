"use client"

import { Input } from 'antd'

const { TextArea } = Input

// 系统提示词显示组件Props接口
export interface SystemPromptDisplayProps {
  prompt: string;
  isGenerating: boolean;
  onPromptChange: (value: string) => void;
}

/**
 * 系统提示词显示组件
 */
export default function SystemPromptDisplay({ prompt, isGenerating, onPromptChange }: SystemPromptDisplayProps) {
  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-lg font-medium mb-2">系统提示词</h2>
      <div className="flex-grow overflow-hidden">
        <TextArea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={isGenerating ? "正在生成系统提示词..." : "系统提示词将在这里显示..."}
          className="w-full h-full resize-none"
          style={{ height: '100%', minHeight: '100%' }}
        />
      </div>
    </div>
  )
} 