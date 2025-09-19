"use client";

import React, {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useTranslation} from "react-i18next";

import {App, Button, Modal} from "antd";
import {WarningFilled} from "@ant-design/icons";
import {motion} from "framer-motion";

import {useAuth} from "@/hooks/useAuth";
import modelEngineService from "@/services/modelEngineService";
import {configStore} from "@/lib/config";
import {CONNECTION_STATUS, ConnectionStatus,} from "@/const/modelConfig";
import log from "@/lib/logger";

import SetupLayout from "../SetupLayout";
import AppModelConfig from "./config";

export default function ModelSetupPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isLoading: userLoading } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.PROCESSING
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [pendingJump, setPendingJump] = useState(false);
  const [liveSelectedModels, setLiveSelectedModels] = useState<Record<
    string,
    Record<string, string>
  > | null>(null);

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

  // Handle next button click
  const handleNext = async () => {
    try {
      // Get the current configuration
      const currentConfig = configStore.getConfig();

      // Check the main model
      if (!currentConfig.models.llm.modelName) {
        message.error(t("setup.page.error.selectMainModel"));

        // Trigger a custom event to notify the ModelConfigSection to mark the main model dropdown as an error
        window.dispatchEvent(
          new CustomEvent("highlightMissingField", {
            detail: { field: t("setup.page.error.highlightField.llmMain") },
          })
        );

        return;
      }

      // Check embedding model using live selection from current UI, not the stored config
      const hasEmbeddingLive =
        !!liveSelectedModels?.embedding?.embedding ||
        !!liveSelectedModels?.embedding?.multi_embedding;
      if (!hasEmbeddingLive) {
        setEmbeddingModalOpen(true);
        setPendingJump(true);
        // Highlight embedding dropdown
        window.dispatchEvent(
          new CustomEvent("highlightMissingField", {
            detail: { field: "embedding.embedding" },
          })
        );
        return;
      }
      router.push("/setup/knowledges");
    } catch (error) {
      log.error(t("setup.page.error.systemError"), error);
      message.error(t("setup.page.error.systemError"));
    }
  };

  const handleEmbeddingOk = async () => {
    setEmbeddingModalOpen(false);
    if (pendingJump) {
      setPendingJump(false);
      router.push("/setup/knowledges");
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

  return (
    <SetupLayout
      connectionStatus={connectionStatus}
      isCheckingConnection={isCheckingConnection}
      onCheckConnection={checkModelEngineConnection}
      title={t("setup.header.title")}
      description={t("setup.model.description")}
      onNext={handleNext}
      showNext={true}
      nextText={t("setup.navigation.button.next")}
    >
      <motion.div
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        style={{ width: "100%", height: "100%" }}
      >
        <AppModelConfig
          onSelectedModelsChange={(selected) => setLiveSelectedModels(selected)}
        />
      </motion.div>

      <Modal
        title={t("embedding.emptyWarningModal.title")}
        open={embeddingModalOpen}
        onCancel={() => setEmbeddingModalOpen(false)}
        centered
        footer={
          <div className="flex justify-end mt-6 gap-4">
            <Button onClick={handleEmbeddingOk}>
              {t("embedding.emptyWarningModal.ok_continue")}
            </Button>
            <Button type="primary" onClick={() => setEmbeddingModalOpen(false)}>
              {t("embedding.emptyWarningModal.cancel")}
            </Button>
          </div>
        }
      >
        <div className="py-2">
          <div className="flex items-center">
            <WarningFilled
              className="text-yellow-500 mt-1 mr-2"
              style={{ fontSize: "48px" }}
            />
            <div className="ml-3 mt-2">
              <div
                dangerouslySetInnerHTML={{
                  __html: t("embedding.emptyWarningModal.content"),
                }}
              />
              <div className="mt-2 text-xs opacity-70">
                {t("embedding.emptyWarningModal.tip")}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </SetupLayout>
  );
}
