"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

import { useConfig } from "@/hooks/useConfig";
import { configService } from "@/services/configService";
import { EVENTS } from "@/const/auth";

import { ChatInterface } from "./internal/chatInterface";

export default function ChatPage() {
  const { appConfig } = useConfig();
  const { user, isLoading: userLoading, isSpeedMode } = useAuth();

  useEffect(() => {
    // Load config from backend when entering chat page
    configService.loadConfigToFrontend();

    if (appConfig.appName) {
      document.title = `${appConfig.appName}`;
    }
  }, [appConfig.appName]);

  // Require login on chat page when unauthenticated (full mode only)
  // Trigger SESSION_EXPIRED event to show "Login Expired" modal instead of directly opening login modal
  useEffect(() => {
    if (!isSpeedMode && !userLoading && !user) {
      window.dispatchEvent(
        new CustomEvent(EVENTS.SESSION_EXPIRED, {
          detail: { message: "Session expired, please sign in again" },
        })
      );
    }
  }, [isSpeedMode, user, userLoading]);

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
