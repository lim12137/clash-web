"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

import { useConfig } from "@/hooks/useConfig";
import { configService } from "@/services/configService";

import { ChatInterface } from "./internal/chatInterface";

export default function ChatPage() {
  const { appConfig } = useConfig();
  const { user, isLoading: userLoading, openLoginModal, isSpeedMode } = useAuth();

  useEffect(() => {
    // Load config from backend when entering chat page
    configService.loadConfigToFrontend();

    if (appConfig.appName) {
      document.title = `${appConfig.appName}`;
    }
  }, [appConfig.appName]);

  // Require login on chat page when unauthenticated (full mode only)
  useEffect(() => {
    if (!isSpeedMode && !userLoading && !user) {
      openLoginModal();
    }
  }, [isSpeedMode, user, userLoading, openLoginModal]);

  // Avoid rendering and backend calls when unauthenticated (full mode only)
  if (!isSpeedMode && (!user || userLoading)) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col">
      <ChatInterface />
    </div>
  );
}
