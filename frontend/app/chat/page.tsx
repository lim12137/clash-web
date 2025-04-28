"use client"

import { useEffect } from "react"
import { ChatInterface } from "@/app/chat/internal/chatInterface"
import { useConfig } from "@/hooks/useConfig"

export default function ChatPage() {
  const { appConfig } = useConfig()

  useEffect(() => {
    if (appConfig.appName) {
      document.title = `ModelEngine | ${appConfig.appName}`
    }
  }, [appConfig.appName])

  return (
    <div className="flex h-screen flex-col">
      <ChatInterface />
    </div>
  )
}

