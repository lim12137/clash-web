"use client"

import { Input, Button, Modal } from 'antd'
import { useState } from 'react'
import AdditionalRequestInput from './AdditionalRequestInput'

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
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSendAdditionalRequest = (request: string) => {
    console.log("发送附加请求:", request)
    setIsModalOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium">系统提示词</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-1.5 rounded-md flex items-center text-sm bg-blue-500 text-white hover:bg-blue-600"
          style={{ border: "none" }}
        >微调</button>
      </div>
      <div className="flex-grow overflow-hidden">
        <TextArea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={isGenerating ? "正在生成系统提示词..." : "系统提示词将在这里显示..."}
          className="w-full h-full resize-none"
          style={{ height: '100%', minHeight: '100%' }}
        />
      </div>
      <Modal
        title="提示词微调"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <AdditionalRequestInput onSend={handleSendAdditionalRequest} />
      </Modal>
    </div>
  )
} 