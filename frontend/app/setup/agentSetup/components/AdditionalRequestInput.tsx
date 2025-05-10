"use client"

import { useState } from 'react'
import { Input, Button } from 'antd'

// 附加请求输入组件Props接口
export interface AdditionalRequestInputProps {
  onSend: (request: string) => void;
}

/**
 * 附加请求输入组件
 */
export default function AdditionalRequestInput({ onSend }: AdditionalRequestInputProps) {
  const [request, setRequest] = useState("")
  
  const handleSend = () => {
    if (request.trim()) {
      onSend(request)
      setRequest("")
    }
  }
  
  return (
    <div className="flex flex-col bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-lg font-medium mb-2">提示词微调</h2>
      <div className="flex gap-2">
        <Input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="输入提示词微调指令..."
          onPressEnter={handleSend}
        />
        <Button type="primary" onClick={handleSend}>发送</Button>
      </div>
    </div>
  )
} 