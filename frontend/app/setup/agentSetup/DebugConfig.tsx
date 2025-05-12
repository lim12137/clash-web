"use client"

import { useState } from 'react'
import { Typography, Input, Button } from 'antd'
import { SendOutlined } from '@ant-design/icons'

const { Text } = Typography

// Agent调试组件Props接口
interface AgentDebuggingProps {
  question: string;
  answer: string;
  onAskQuestion: (question: string) => void;
}

// 主组件Props接口
interface DebugConfigProps {
  testQuestion: string;
  setTestQuestion: (question: string) => void;
  testAnswer: string;
  setTestAnswer: (answer: string) => void;
}

/**
 * Agent调试组件
 */
function AgentDebugging({ question, answer, onAskQuestion }: AgentDebuggingProps) {
  const [inputQuestion, setInputQuestion] = useState("")
  
  const handleSend = () => {
    if (inputQuestion.trim()) {
      onAskQuestion(inputQuestion)
      setInputQuestion("")
    }
  }
  
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex flex-col gap-4 flex-grow overflow-hidden">
        <div className="flex flex-col gap-3 h-full">
          <div className="flex flex-col gap-1">
            <Text className="text-sm text-gray-500">用户提问</Text>
            <div className="border rounded-md p-3 bg-gray-50 min-h-[40px] text-sm">
              {question || "尚未提问"}
            </div>
          </div>
          
          <div className="flex flex-col gap-1 flex-grow overflow-hidden">
            <Text className="text-sm text-gray-500">Agent回答</Text>
            <div className="border rounded-md p-3 bg-gray-50 h-full overflow-y-auto text-sm custom-scrollbar">
              {answer || "等待回答..."}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        <Input
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="输入测试问题..."
          onPressEnter={handleSend}
        />
        <button
          onClick={handleSend}
          className="px-4 py-1.5 rounded-md flex items-center text-sm bg-blue-500 text-white hover:bg-blue-600"
          style={{ border: "none" }}
        >
          发送
        </button>
      </div>
    </div>
  )
}

/**
 * 调试配置主组件
 */
export default function DebugConfig({
  testQuestion,
  setTestQuestion,
  testAnswer,
  setTestAnswer
}: DebugConfigProps) {
  // 处理测试问题
  const handleTestQuestion = (question: string) => {
    setTestQuestion(question)
    
    // 模拟回答生成
    setTimeout(() => {
      setTestAnswer(`这是对问题 "${question}" 的模拟回答。在实际实现中，这将由Agent生成。`)
    }, 1000)
  }

  return (
    <div className="w-full h-full bg-white">
      <AgentDebugging 
        question={testQuestion} 
        answer={testAnswer} 
        onAskQuestion={handleTestQuestion} 
      />
    </div>
  )
} 