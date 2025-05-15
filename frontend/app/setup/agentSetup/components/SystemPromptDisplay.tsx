"use client"

import { Input, Button, Modal, Spin } from 'antd'
import { useState } from 'react'
import AdditionalRequestInput from './AdditionalRequestInput'
import { MarkdownRenderer } from '@/components/ui/markdownRenderer'
import { ScrollArea } from '@/components/ui/scrollArea'

const { TextArea } = Input

// System prompt display component Props interface
export interface SystemPromptDisplayProps {
  prompt: string;
  isGenerating: boolean;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onDebug?: () => void;
}

/**
 * System prompt word display component
 */
export default function SystemPromptDisplay({ prompt, isGenerating, onPromptChange, onGenerate, onDebug }: SystemPromptDisplayProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [tunedPrompt, setTunedPrompt] = useState("")
  const [isTuning, setIsTuning] = useState(false)
  const [isEditingTuned, setIsEditingTuned] = useState(false)

  const handleSendAdditionalRequest = (request: string) => {
    setIsTuning(true)
    
    // Simulate API calls and generate new prompt words
    setTimeout(() => {
      const newPrompt = `# 优化后的系统提示词

## 角色定义
你是一个智能AI助手，专门负责${request || '通用任务'}。

## 行为准则
- 保持友好和专业的态度
- 提供准确的信息和有用的建议
- 在不确定时，坦诚表明自己的局限性

## 回应格式
1. 简洁明了地回答问题
2. 必要时提供相关上下文
3. 对于复杂问题，分步骤解释

请始终在能力范围内回答问题，如果不确定，请说明你不知道。`
      
      setTunedPrompt(newPrompt)
      setIsTuning(false)
    }, 1500)
  }
  
  const handleSaveTunedPrompt = () => {
    onPromptChange(tunedPrompt)
    setIsModalOpen(false)
    setTunedPrompt("")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium">系统提示词</h2>
        <div className="flex gap-2">
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: "none" }}
          >
            生成
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            微调
          </button>
          <button
            onClick={onDebug}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            调试
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-hidden border border-gray-200 rounded-md">
        {isEditMode ? (
          <TextArea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={isGenerating ? "正在生成系统提示词..." : "系统提示词将在这里显示..."}
            className="w-full h-full resize-none border-none"
            style={{ height: '100%', minHeight: '100%' }}
            autoFocus
            onBlur={() => setIsEditMode(false)}
          />
        ) : (
          <div 
            className="w-full h-full cursor-text"
            onDoubleClick={() => setIsEditMode(true)}
            title="双击编辑"
          >
            <ScrollArea className="h-full">
              <div className="p-3">
                {prompt ? (
                  <MarkdownRenderer content={prompt} />
                ) : (
                  <div className="text-gray-400 italic">
                    {isGenerating ? "正在生成系统提示词..." : "系统提示词将在这里显示..."}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
      <Modal
        title="提示词微调"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setTunedPrompt("")
        }}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <div className="flex flex-col">
          <AdditionalRequestInput onSend={handleSendAdditionalRequest} />
          
          {isTuning && (
            <div className="mt-4 flex justify-center">
              <Spin tip="正在生成微调后的提示词..." />
            </div>
          )}
          
          {tunedPrompt && !isTuning && (
            <div className="mt-4">
              <div className="font-medium text-gray-700 mb-2">微调后的提示词:</div>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {isEditingTuned ? (
                  <TextArea
                    value={tunedPrompt}
                    onChange={(e) => setTunedPrompt(e.target.value)}
                    className="w-full resize-none border-none"
                    style={{ minHeight: '200px' }}
                    autoFocus
                    onBlur={() => setIsEditingTuned(false)}
                  />
                ) : (
                  <div style={{ height: '400px' }}>
                    <ScrollArea className="h-full">
                      <div 
                        className="p-3 cursor-text"
                        onDoubleClick={() => setIsEditingTuned(true)}
                        title="双击编辑"
                      >
                        <MarkdownRenderer content={tunedPrompt} />
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveTunedPrompt}
                  className="px-4 py-1.5 rounded-md flex items-center text-sm bg-blue-500 text-white hover:bg-blue-600"
                  style={{ border: "none" }}
                >
                  保存到配置
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
} 