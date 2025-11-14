"use client";

import React, { useState, useEffect, useRef } from "react";
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
import { EVENTS } from "@/const/auth";
import log from "@/lib/logger";

import SetupLayout from "../SetupLayout";
import AgentConfig, { AgentConfigHandle } from "./config";
import SaveConfirmModal from "./components/SaveConfirmModal";

export default function AgentSetupPage() {
  const agentConfigRef = useRef<AgentConfigHandle | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const pendingNavRef = useRef<null | (() => void)>(null);
  const { message } = App.useApp();
  const router = useRouter();
  const { t } = useTranslation();
  const {
    user,
    isLoading: userLoading,
    isSpeedMode
  } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.PROCESSING
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check login status and permission
  // Trigger SESSION_EXPIRED event to show "Login Expired" modal instead of directly opening login modal
  useEffect(() => {
    if (!isSpeedMode && !userLoading && !user) {
      window.dispatchEvent(
        new CustomEvent(EVENTS.SESSION_EXPIRED, {
          detail: { message: "Session expired, please sign in again" },
        })
      );
      return;
    }

    // Only admin users can access this page (full mode)
    if (!isSpeedMode && user && user.role !== USER_ROLES.ADMIN) {
      router.push("/setup/knowledges");
      return;
    }
  }, [isSpeedMode, user, userLoading, router]);

  // Check the connection status when the page is initialized
  useEffect(() => {
    if (isSpeedMode || (user && !userLoading)) {
      checkModelEngineConnection();
    }
  }, [isSpeedMode, user, userLoading]);

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
    const hasDirty = agentConfigRef.current?.hasUnsavedChanges?.() || false;
    if (hasDirty) {
      pendingNavRef.current = () => router.push("/chat");
      setShowSaveConfirm(true);
      return;
    }
    router.push("/chat");
  };

  // Handle back button click
  const handleBack = () => {
    const hasDirty = agentConfigRef.current?.hasUnsavedChanges?.() || false;
    if (hasDirty) {
      pendingNavRef.current = () => router.push("/setup/knowledges");
      setShowSaveConfirm(true);
      return;
    }
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

  // Prevent rendering if user doesn't have permission (full mode)
  if (!isSpeedMode && !userLoading && (!user || user.role !== USER_ROLES.ADMIN)) {
    return null;
  }

  return (
    <>
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
          <AgentConfig ref={agentConfigRef} />
        </motion.div>
      </SetupLayout>
      <SaveConfirmModal
        open={showSaveConfirm}
        onCancel={async () => {
          // Reload data from backend to discard changes
          await agentConfigRef.current?.reloadCurrentAgentData?.();
          setShowSaveConfirm(false);
          const go = pendingNavRef.current;
          pendingNavRef.current = null;
          if (go) go();
        }}
        onSave={async () => {
          try {
            setIsSaving(true);
            await agentConfigRef.current?.saveAllChanges?.();
            setShowSaveConfirm(false);
            const go = pendingNavRef.current;
            pendingNavRef.current = null;
            if (go) go();
          } catch (e) {
            // errors are surfaced by underlying save
          } finally {
            setIsSaving(false);
          }
        }}
      />
    </>
  );
}
