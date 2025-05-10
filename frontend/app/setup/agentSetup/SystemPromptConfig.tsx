"use client"

import { useState } from 'react'
import { message, Typography } from 'antd'
import SystemPromptDisplay from './components/SystemPromptDisplay'
import AdditionalRequestInput from './components/AdditionalRequestInput'

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
  // 处理发送附加请求
  const handleSendAdditionalRequest = (request: string) => {
    console.log("发送附加请求:", request)
    message.success("附加指令已发送")
  }

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
      <div className="flex-shrink-0 mt-auto">
        <div>
          <Text className="text-sm text-gray-500 mb-2 block">附加请求</Text>
          <AdditionalRequestInput 
            onSend={handleSendAdditionalRequest} 
          />
        </div>
      </div>
    </div>
  )
} 