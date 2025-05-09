"use client"

import { useState } from 'react'
import BusinessLogicConfig from './AgentManagementConfig'
import SystemPromptConfig from './SystemPromptConfig'
import { generateSystemPrompt } from './components/utils'
import DebugConfig from './DebugConfig'

/**
 * Agent配置主组件
 */
export default function AgentConfig() {
  const [businessLogic, setBusinessLogic] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedAgents, setSelectedAgents] = useState<any[]>([])
  const [selectedTools, setSelectedTools] = useState<any[]>([])
  const [testQuestion, setTestQuestion] = useState("")
  const [testAnswer, setTestAnswer] = useState("")

  // 处理生成系统提示词
  const handleGenerateSystemPrompt = async () => {
    if (!businessLogic.trim()) return
    
    setIsGenerating(true)
    setSystemPrompt("")
    
    try {
      // 使用generateSystemPrompt服务
      const generatedPrompt = await generateSystemPrompt(businessLogic, selectedAgents, selectedTools)
      setSystemPrompt(generatedPrompt)
    } catch (error) {
      console.error("Error generating system prompt:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex p-2 gap-2 overflow-hidden">
      {/* 左侧面板 */}
      <div className="flex flex-col w-1/3 gap-2 overflow-hidden">
        <BusinessLogicConfig 
          businessLogic={businessLogic}
          setBusinessLogic={setBusinessLogic}
          selectedAgents={selectedAgents}
          setSelectedAgents={setSelectedAgents}
          selectedTools={selectedTools}
          setSelectedTools={setSelectedTools}
          onGenerateSystemPrompt={handleGenerateSystemPrompt}
          systemPrompt={systemPrompt}
        />
      </div>
      
      {/* 中间面板 */}
      <div className="flex flex-col w-1/3 gap-2 overflow-hidden">
        <SystemPromptConfig 
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          isGenerating={isGenerating}
        />
      </div>
      
      {/* 右侧面板 */}
      <div className="flex flex-col w-1/3 gap-2 overflow-hidden">
        <DebugConfig 
          testQuestion={testQuestion}
          setTestQuestion={setTestQuestion}
          testAnswer={testAnswer}
          setTestAnswer={setTestAnswer}
        />
      </div>
    </div>
  )
} 