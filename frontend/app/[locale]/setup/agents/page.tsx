"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { App } from "antd";
import { motion } from "framer-motion";

import { useAuth } from "@/hooks/useAuth";
import modelEngineService from "@/services/modelEngineService";
import {
  USER_ROLES,
  CONNECTION_STATUS,
  ConnectionStatus,
} from "@/const/modelConfig";
import log from "@/lib/logger";

import SetupLayout from "../SetupLayout";
import AgentConfig from "./config";

export default function AgentSetupPage() {
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

    // Only admin users can access this page
    if (user && user.role !== USER_ROLES.ADMIN) {
      router.push("/setup/knowledges");
      return;
    }
  }, [user, userLoading, router]);

  // Check the connection status when the page is initialized
  useEffect(() => {
    checkModelEngineConnection();
  }, []);

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

  // Handle complete button click
  const handleComplete = async () => {
    try {
      setIsSaving(true);
      // Jump to chat page directly, no any check
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
    router.push("/setup/knowledges");
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

  return (
    <SetupLayout
      connectionStatus={connectionStatus}
      isCheckingConnection={isCheckingConnection}
      onCheckConnection={checkModelEngineConnection}
      title={t("setup.header.title")}
      description={t("setup.header.description")}
      onBack={handleBack}
      onComplete={handleComplete}
      isSaving={isSaving}
      showBack={true}
      showComplete={true}
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
        <AgentConfig />
      </motion.div>
    </SetupLayout>
  );
}
