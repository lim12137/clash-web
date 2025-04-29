"use client"

import { useEffect } from "react"
import { ChatInterface } from "@/app/chat/internal/chatInterface"
import { useConfig } from "@/hooks/useConfig"
import { useAuth } from "@/hooks/useAuth"

export default function ChatPage() {
  const { appConfig } = useConfig()
  const { user, isLoading } = useAuth()

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

