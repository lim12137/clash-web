"use client"

import { useState } from 'react'
import { Input, Button } from 'antd'

// Additional request input component Props interface
export interface AdditionalRequestInputProps {
  onSend: (request: string) => void;
  isTuning?: boolean;  // 添加微调状态属性
}

/**
 * Additional request input component
 */
export default function AdditionalRequestInput({ onSend, isTuning = false }: AdditionalRequestInputProps) {
  const [request, setRequest] = useState("")
  
  const handleSend = () => {
    if (request.trim()) {
      onSend(request)
      setRequest("")  // 发送后清空输入框
    }
  }
  
  return (
    <div className="flex flex-col items-end">
      <Input.TextArea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="输入提示词微调指令..."
        onPressEnter={(e) => {
          if (!e.shiftKey) {  // 只有在不按Shift键时才发送
            e.preventDefault()
            handleSend()
          }
        }}
        rows={7}
        style={{ resize: 'none' }}
        disabled={isTuning}  // 微调时禁用输入框
      />
      <Button 
        type="primary" 
        onClick={handleSend} 
        className="mt-2"
        disabled={isTuning || !request.trim()}  // 微调时或输入为空时禁用按钮
        loading={isTuning}  // 微调时显示加载状态
      >
        {isTuning ? "微调中..." : "发送"}
      </Button>
    </div>
  )
} 