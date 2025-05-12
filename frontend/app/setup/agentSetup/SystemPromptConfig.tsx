"use client"

import { useState } from 'react'
import { message, Typography } from 'antd'
import SystemPromptDisplay from './components/SystemPromptDisplay'

const { Text } = Typography

// 主组件Props接口
interface SystemPromptConfigProps {
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  isGenerating: boolean;
}

/**
 * 系统提示词配置主组件
 */
export default function SystemPromptConfig({
  systemPrompt,
  setSystemPrompt,
  isGenerating
}: SystemPromptConfigProps) {
  return (
    <div className="flex flex-col h-full gap-4 pl-4">
      <div className="flex-grow overflow-hidden">
        <div className="h-full">
          <SystemPromptDisplay 
            prompt={systemPrompt} 
            isGenerating={isGenerating} 
            onPromptChange={setSystemPrompt} 
          />
        </div>
      </div>
    </div>
  )
} 