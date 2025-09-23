"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { App } from "antd";
import { motion } from "framer-motion";

import { useAuth } from "@/hooks/useAuth";
import { configService } from "@/services/configService";
import modelEngineService from "@/services/modelEngineService";
import { configStore } from "@/lib/config";
import {
  USER_ROLES,
  CONNECTION_STATUS,
  ConnectionStatus,
} from "@/const/modelConfig";
import log from "@/lib/logger";

import SetupLayout from "../SetupLayout";
import DataConfig from "./config";

export default function KnowledgeSetupPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isLoading: userLoading } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.PROCESSING
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check login status and permission
  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/");
      return;
    }
  }, [user, userLoading, router]);

  // Check the connection status when the page is initialized
  useEffect(() => {
    checkModelEngineConnection();

    // Trigger knowledge base data acquisition when the page is initialized
    window.dispatchEvent(
      new CustomEvent("knowledgeBaseDataUpdated", {
        detail: { forceRefresh: true },
      })
    );

    // Load config for normal user
    const loadConfigForNormalUser = async () => {
      if (user && user.role !== USER_ROLES.ADMIN) {
        try {
          await configService.loadConfigToFrontend();
          configStore.reloadFromStorage();
        } catch (error) {
          log.error("加载配置失败:", error);
        }
      }
    };

    loadConfigForNormalUser();
  }, [user]);

  // Function to check the ModelEngine connection status
  const checkModelEngineConnection = async () => {
    setIsCheckingConnection(true);

    try {
      const result = await modelEngineService.checkConnection();
      setConnectionStatus(result.status);
    } catch (error) {
      log.error(t("setup.page.error.checkConnection"), error);
      setConnectionStatus(CONNECTION_STATUS.ERROR);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Handle next button click (for admin users)
  const handleNext = async () => {
    try {
      // For admin users, go to agent page
      router.push("/setup/agents");
    } catch (error) {
      log.error("Navigation error:", error);
      message.error("系统异常，请稍后重试");
    }
  };

  // Handle complete button click (for normal users)
  const handleComplete = async () => {
    try {
      setIsSaving(true);

      // Reload the config for normal user before saving, ensure the latest model config
      await configService.loadConfigToFrontend();
      configStore.reloadFromStorage();

      // Get the current global configuration
      const currentConfig = configStore.getConfig();

      // Check if the main model is configured
      if (!currentConfig.models.llm.modelName) {
        message.error("未找到模型配置，请联系管理员先完成模型配置");
        return;
      }

      router.push("/chat");
    } catch (error) {
      log.error("保存配置异常:", error);
      message.error("系统异常，请稍后重试");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle back button click
  const handleBack = () => {
    if (user?.role === USER_ROLES.ADMIN) {
      router.push("/setup/models");
    } else {
      message.error(t("setup.page.error.adminOnly"));
    }
  };

  // Animation variants for smooth transitions
  const pageVariants = {
    initial: {
      opacity: 0,
      x: 20,
    },
    in: {
      opacity: 1,
      x: 0,
    },
    out: {
      opacity: 0,
      x: -20,
    },
  };

  const pageTransition = {
    type: "tween" as const,
    ease: "anticipate" as const,
    duration: 0.4,
  };

  // Determine which button to show based on user role
  const isAdmin = user?.role === USER_ROLES.ADMIN;

  return (
    <SetupLayout
      connectionStatus={connectionStatus}
      isCheckingConnection={isCheckingConnection}
      onCheckConnection={checkModelEngineConnection}
      title={t("setup.header.title")}
      description={t("setup.header.description")}
      onBack={handleBack}
      onNext={isAdmin ? handleNext : undefined}
      onComplete={isAdmin ? undefined : handleComplete}
      isSaving={isSaving}
      showBack={isAdmin}
      showNext={isAdmin}
      showComplete={!isAdmin}
      nextText={t("setup.navigation.button.next")}
      completeText={t("setup.navigation.button.complete")}
    >
      <motion.div
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        style={{ width: "100%", height: "100%" }}
      >
        <DataConfig isActive={true} />
      </motion.div>
    </SetupLayout>
  );
}
