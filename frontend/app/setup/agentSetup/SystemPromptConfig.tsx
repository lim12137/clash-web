"use client"

import { useState } from 'react'
import { message } from 'antd'
import SystemPromptDisplay from './components/SystemPromptDisplay'
import AdditionalRequestInput from './components/AdditionalRequestInput'

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
  // 处理发送附加请求
  const handleSendAdditionalRequest = (request: string) => {
    console.log("发送附加请求:", request)
    message.success("附加指令已发送")
  }

  return (
    <div className="flex flex-col w-full h-full gap-4 overflow-hidden">
      <div className="flex-grow overflow-hidden">
        <SystemPromptDisplay 
          prompt={systemPrompt} 
          isGenerating={isGenerating} 
          onPromptChange={setSystemPrompt} 
        />
      </div>
      <div className="flex-shrink-0 mt-auto">
        <AdditionalRequestInput 
          onSend={handleSendAdditionalRequest} 
        />
      </div>
    </div>
  )
} 