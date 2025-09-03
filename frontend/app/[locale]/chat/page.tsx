"use client";

import { useEffect } from "react";

import { useConfig } from "@/hooks/useConfig";
import { configService } from "@/services/configService";

import { ChatInterface } from "./internal/chatInterface";

export default function ChatPage() {
  const { appConfig } = useConfig();

  useEffect(() => {
    // Load config from backend when entering chat page
    configService.loadConfigToFrontend();

    if (appConfig.appName) {
      document.title = `${appConfig.appName}`;
    }
  }, [appConfig.appName]);

  return (
    <div className="flex h-screen flex-col">
      <ChatInterface />
    </div>
  );
}
