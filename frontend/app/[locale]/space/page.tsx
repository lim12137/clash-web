"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { App } from "antd";
import { useAuth } from "@/hooks/useAuth";
import { NavigationLayout } from "@/components/navigation/NavigationLayout";
import { SpaceContent } from "./components/SpaceContent";
import { EVENTS } from "@/const/auth";
import { fetchAgentList, importAgent } from "@/services/agentConfigService";
import log from "@/lib/logger";

interface Agent {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_available: boolean;
}

export default function AgentSpacePage() {
  const { t } = useTranslation("common");
  const { message } = App.useApp();
  const { user, isLoading: userLoading, isSpeedMode } = useAuth();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check login status
  useEffect(() => {
    if (!isSpeedMode && !userLoading && !user) {
      window.dispatchEvent(
        new CustomEvent(EVENTS.SESSION_EXPIRED, {
          detail: { message: "Session expired, please sign in again" },
        })
      );
      return;
    }
  }, [isSpeedMode, user, userLoading]);

  // Load agents on mount
  useEffect(() => {
    if (isSpeedMode || (user && !userLoading)) {
      loadAgents();
    }
  }, [isSpeedMode, user, userLoading]);

  // Load agents from backend
  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const result = await fetchAgentList();
      if (result.success) {
        setAgents(result.data);
      } else {
        message.error(t(result.message) || "Failed to load agents");
      }
    } catch (error) {
      log.error("Failed to load agents:", error);
      message.error("Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    loadAgents();
  };

  // Handle import agent
  const handleImportAgent = () => {
    // Create a hidden file input element
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Check file type
      if (!file.name.endsWith(".json")) {
        message.error(t("businessLogic.config.error.invalidFileType"));
        return;
      }

      setIsImporting(true);
      try {
        // Read file content
        const fileContent = await file.text();
        let agentInfo;

        try {
          agentInfo = JSON.parse(fileContent);
        } catch (parseError) {
          message.error(t("businessLogic.config.error.invalidFileType"));
          setIsImporting(false);
          return;
        }

        // Call import API
        const result = await importAgent(agentInfo);

        if (result.success) {
          message.success(t("businessLogic.config.error.agentImportSuccess"));
          // Refresh agent list
          loadAgents();
        } else {
          message.error(
            result.message || t("businessLogic.config.error.agentImportFailed")
          );
        }
      } catch (error) {
        log.error(t("agentConfig.agents.importFailed"), error);
        message.error(t("businessLogic.config.error.agentImportFailed"));
      } finally {
        setIsImporting(false);
      }
    };

    fileInput.click();
  };

  if (!mounted) {
    return null;
  }

  // Prevent rendering if user doesn't have permission (full mode)
  if (!isSpeedMode && !userLoading && !user) {
    return null;
  }

  return (
    <NavigationLayout contentMode="scrollable" showFooter={true}>
      <SpaceContent
        agents={agents}
        isLoading={isLoading}
        isImporting={isImporting}
        onRefresh={handleRefresh}
        onLoadAgents={loadAgents}
        onImportAgent={handleImportAgent}
      />
    </NavigationLayout>
  );
}

