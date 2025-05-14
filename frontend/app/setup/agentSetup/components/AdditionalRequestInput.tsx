"use client"

import { useState } from 'react'
import { Input, Button } from 'antd'

// Additional request input component Props interface
export interface AdditionalRequestInputProps {
  onSend: (request: string) => void;
}

/**
 * Additional request input component
 */
export default function AdditionalRequestInput({ onSend }: AdditionalRequestInputProps) {
  const [request, setRequest] = useState("")
  
  const handleSend = () => {
    if (request.trim()) {
      onSend(request)
    }
  }
  
  return (
    <div className="flex flex-col items-end">
      <Input.TextArea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="输入提示词微调指令..."
        onPressEnter={handleSend}
        rows={5}
      />
      <Button type="primary" onClick={handleSend} className="mt-2">发送</Button>
    </div>
  )
} 