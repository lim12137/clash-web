"use client";

import React, { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import { App, Button, Badge, Dropdown } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { FiRefreshCw, FiArrowLeft } from "react-icons/fi";
import { Globe } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { configService } from "@/services/configService";
import modelEngineService from "@/services/modelEngineService";
import { configStore } from "@/lib/config";
import { languageOptions } from "@/const/constants";
import { useLanguageSwitch } from "@/lib/language";
import { HEADER_CONFIG } from "@/const/layoutConstants";
import {
  USER_ROLES,
  CONNECTION_STATUS,
  ConnectionStatus,
  MODEL_STATUS,
} from "@/const/modelConfig";
import log from "@/lib/logger";

import AppModelConfig from "./modelSetup/config";
import DataConfig from "./knowledgeSetup/config";
import AgentConfig from "./agentSetup/config";
import EmbedderCheckModal from "./modelSetup/components/model/EmbedderCheckModal";

// ================ Header ================
interface HeaderProps {
  connectionStatus:
    | typeof CONNECTION_STATUS.SUCCESS
    | typeof CONNECTION_STATUS.ERROR
    | typeof CONNECTION_STATUS.PROCESSING;
  isCheckingConnection: boolean;
  onCheckConnection: () => void;
}

function Header({
  connectionStatus,
  isCheckingConnection,
  onCheckConnection,
}: HeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentLanguage, handleLanguageChange } = useLanguageSwitch();

  // Get status text
  const getStatusText = () => {
    switch (connectionStatus) {
      case CONNECTION_STATUS.SUCCESS:
        return t("setup.header.status.connected");
      case CONNECTION_STATUS.ERROR:
        return t("setup.header.status.disconnected");
      case CONNECTION_STATUS.PROCESSING:
        return t("setup.header.status.checking");
      default:
        return t("setup.header.status.unknown");
    }
  };

  return (
    <header
      className="w-full py-4 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm"
      style={{ height: HEADER_CONFIG.HEIGHT }}
    >
      <div className="flex items-center">
        <Button
          onClick={() => router.push("/")}
          className="mr-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={t("setup.header.button.back")}
          icon={
            <FiArrowLeft className="text-slate-600 dark:text-slate-300 text-xl" />
          }
          type="text"
          shape="circle"
        />
        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-500">
          {t("setup.header.title")}
        </h1>
        <div className="mx-2 h-6 border-l border-slate-300 dark:border-slate-600"></div>
        <span className="text-slate-600 dark:text-slate-400 text-sm">
          {t("setup.header.description")}
        </span>
      </div>
      {/* Language switch */}
      <div className="flex items-center gap-3">
        <Dropdown
          menu={{
            items: languageOptions.map((opt) => ({
              key: opt.value,
              label: opt.label,
            })),
            onClick: ({ key }) => handleLanguageChange(key as string),
          }}
        >
          <a className="ant-dropdown-link text-sm !font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors flex items-center gap-2 cursor-pointer w-[110px] border-0 shadow-none bg-transparent text-left">
            <Globe className="h-4 w-4" />
            {languageOptions.find((o) => o.value === currentLanguage)?.label ||
              currentLanguage}
            <DownOutlined className="text-[10px]" />
          </a>
        </Dropdown>
        {/* ModelEngine connectivity status */}
        <div className="flex items-center px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">
          <Badge
            status={connectionStatus}
            text={getStatusText()}
            className="[&>.ant-badge-status-dot]:w-[8px] [&>.ant-badge-status-dot]:h-[8px] [&>.ant-badge-status-text]:text-base [&>.ant-badge-status-text]:ml-2 [&>.ant-badge-status-text]:font-medium"
          />
          <Button
            icon={
              <FiRefreshCw
                className={isCheckingConnection ? "animate-spin" : ""}
              />
            }
            size="small"
            type="text"
            onClick={onCheckConnection}
            disabled={isCheckingConnection}
            className="ml-2"
          />
        </div>
      </div>
    </header>
  );
}

// ================ Navigation ================
interface NavigationProps {
  selectedKey: string;
  onBackToFirstPage: () => void;
  onCompleteConfig: () => void;
  userRole?: typeof USER_ROLES.USER | typeof USER_ROLES.ADMIN;
}

function Navigation({
  selectedKey,
  onBackToFirstPage,
  onCompleteConfig,
  userRole,
}: NavigationProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-3 flex justify-between px-6">
      <div className="flex gap-2">
        {selectedKey != "1" && userRole === USER_ROLES.ADMIN && (
          <Button
            onClick={onBackToFirstPage}
            className="flex items-center text-sm font-medium transition-colors"
            style={{
              padding: "0px 24px",
              margin: 0,
              border: "none",
            }}
            color="default"
            variant="filled"
          >
            {t("setup.navigation.button.previous")}
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onCompleteConfig}
          className="flex items-center text-sm font-medium transition-colors"
          style={{
            padding: "0px 24px",
            marginLeft:
              selectedKey === "1" || userRole !== USER_ROLES.ADMIN
                ? "auto"
                : undefined,
          }}
          type="primary"
          variant="solid"
        >
          {selectedKey === "3"
            ? t("setup.navigation.button.complete")
            : selectedKey === "2" && userRole !== USER_ROLES.ADMIN
            ? t("setup.navigation.button.complete")
            : t("setup.navigation.button.next")}
        </Button>
      </div>
    </div>
  );
}

// ================ Layout ================
interface LayoutProps {
  children: ReactNode;
  connectionStatus:
    | typeof CONNECTION_STATUS.SUCCESS
    | typeof CONNECTION_STATUS.ERROR
    | typeof CONNECTION_STATUS.PROCESSING;
  isCheckingConnection: boolean;
  onCheckConnection: () => void;
  selectedKey: string;
  onBackToFirstPage: () => void;
  onCompleteConfig: () => void;
  userRole?: typeof USER_ROLES.USER | typeof USER_ROLES.ADMIN;
}

function Layout({
  children,
  connectionStatus,
  isCheckingConnection,
  onCheckConnection,
  selectedKey,
  onBackToFirstPage,
  onCompleteConfig,
  userRole,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      <Header
        connectionStatus={connectionStatus}
        isCheckingConnection={isCheckingConnection}
        onCheckConnection={onCheckConnection}
      />

      {/* Main content */}
      <div className="max-w-[1800px] mx-auto px-8 pb-4 mt-6 bg-transparent">
        {children}
        <Navigation
          selectedKey={selectedKey}
          onBackToFirstPage={onBackToFirstPage}
          onCompleteConfig={onCompleteConfig}
          userRole={userRole}
        />
      </div>
    </div>
  );
}

export default function CreatePage() {
  const { message } = App.useApp();
  const [selectedKey, setSelectedKey] = useState("1");
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.PROCESSING
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isFromSecondPage, setIsFromSecondPage] = useState(false);
  const { user, isLoading: userLoading, openLoginModal } = useAuth();
  const { modal } = App.useApp();
  const { t } = useTranslation();
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [pendingJump, setPendingJump] = useState(false);
  const [connectivityWarningOpen, setConnectivityWarningOpen] = useState(false);
  const [liveSelectedModels, setLiveSelectedModels] = useState<Record<
    string,
    Record<string, string>
  > | null>(null);
  const [embeddingConnectivity, setEmbeddingConnectivity] = useState<{
    embedding?: string;
  } | null>(null);

  // Check login status and permission
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        // user not logged in, do nothing
        return;
      }

      // If the user is not an admin and currently on the first page, automatically jump to the second page
      if (user.role !== USER_ROLES.ADMIN && selectedKey === "1") {
        setSelectedKey("2");
      }

      // If the user is not an admin and currently on the third page, force jump to the second page
      if (user.role !== USER_ROLES.ADMIN && selectedKey === "3") {
        setSelectedKey("2");
      }
    }
  }, [user, userLoading, selectedKey, modal, openLoginModal, router]);

  // Check the connection status when the page is initialized
  useEffect(() => {
    // Trigger knowledge base data acquisition only when the page is initialized
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

    // Check if the knowledge base configuration option card needs to be displayed
    const showPageConfig = localStorage.getItem("show_page");
    if (showPageConfig) {
      setSelectedKey(showPageConfig);
      localStorage.removeItem("show_page");
    }
  }, [user]);

  // Listen for changes in selectedKey, refresh knowledge base data when entering the second page
  useEffect(() => {
    if (selectedKey === "2") {
      // When entering the second page, reset the flag
      setIsFromSecondPage(false);
      // Clear all possible caches
      localStorage.removeItem("preloaded_kb_data");
      localStorage.removeItem("kb_cache");
      // When entering the second page, get the latest knowledge base data
      // Use setTimeout to ensure the component is fully mounted before triggering the event
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("knowledgeBaseDataUpdated", {
            detail: { forceRefresh: true },
          })
        );
      }, 100);
    }
    checkModelEngineConnection();
  }, [selectedKey]);

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

  // Calculate the effective selectedKey, ensure that non-admin users get the correct page status
  const getEffectiveSelectedKey = () => {
    if (!user) return selectedKey;

    if (user.role !== USER_ROLES.ADMIN) {
      // If the current page is the first or third page, return the second page
      if (selectedKey === "1" || selectedKey === "3") {
        return "2";
      }
    }

    return selectedKey;
  };

  const renderContent = () => {
    // If the user is not an admin and attempts to access the first page, force display the second page content
    if (user?.role !== USER_ROLES.ADMIN && selectedKey === "1") {
      return <DataConfig />;
    }

    // If the user is not an admin and attempts to access the third page, force display the second page content
    if (user?.role !== USER_ROLES.ADMIN && selectedKey === "3") {
      return <DataConfig />;
    }

    switch (selectedKey) {
      case "1":
        return (
          <AppModelConfig
            skipModelVerification={isFromSecondPage}
            onSelectedModelsChange={(selected) =>
              setLiveSelectedModels(selected)
            }
            onEmbeddingConnectivityChange={(status) =>
              setEmbeddingConnectivity(status)
            }
          />
        );
      case "2":
        return <DataConfig isActive={selectedKey === "2"} />;
      case "3":
        return <AgentConfig />;
      default:
        return null;
    }
  };

  // Check embedding connectivity for selected models
  const isEmbeddingConnectivityOk = (): boolean => {
    // can add multi_embedding in future
    const selectedEmbedding = liveSelectedModels?.embedding?.embedding || "";
    if (!selectedEmbedding) return true;
    const embStatus = embeddingConnectivity?.embedding;
    const ok = (s?: string) => !s || s === MODEL_STATUS.AVAILABLE;
    return ok(embStatus);
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

  // Handle completed configuration
  const handleCompleteConfig = async () => {
    if (selectedKey === "3") {
      // jump to chat page directly, no any check
      router.push("/chat");
    } else if (selectedKey === "2") {
      // If the user is an admin, jump to the third page; if the user is a normal user, complete the configuration directly and jump to the chat page
      if (user?.role === USER_ROLES.ADMIN) {
        setSelectedKey("3");
      } else {
        // Normal users complete the configuration directly on the second page
        try {
          // Reload the config for normal user before saving, ensure the latest model config
          await configService.loadConfigToFrontend();
          configStore.reloadFromStorage();

          // Get the current global configuration
          const currentConfig = configStore.getConfig();

          // Check if the main model is configured
          if (!currentConfig.models.llm.modelName) {
            message.error(t("setup.page.error.missingModelConfig"));
            return;
          }

          router.push("/chat");
        } catch (error) {
          log.error("Model config reload error:", error);
          message.error(t("setup.page.error.systemError"));
        }
      }
    } else if (selectedKey === "1") {
      // Validate required fields when jumping from the first page to the second page
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

        // check embedding model using live selection from current UI, not the stored config
        const hasEmbeddingLive = !!liveSelectedModels?.embedding?.embedding;
        if (!hasEmbeddingLive) {
          setEmbeddingModalOpen(true);
          setPendingJump(true);
          // highlight embedding dropdown
          window.dispatchEvent(
            new CustomEvent("highlightMissingField", {
              detail: { field: "embedding.embedding" },
            })
          );
          return;
        }

        // connectivity check for embedding models
        const connectivityOk = isEmbeddingConnectivityOk();
        if (!connectivityOk) {
          setConnectivityWarningOpen(true);
          setPendingJump(true);
          return;
        }

        // All required fields have been filled, allow the jump to the second page
        setSelectedKey("2");
      } catch (error) {
        log.error(t("setup.page.error.systemError"), error);
        message.error(t("setup.page.error.systemError"));
      }
    }
  };

  // Handle the logic of the user switching to the first page
  const handleBackToFirstPage = () => {
    if (selectedKey === "3") {
      setSelectedKey("2");
    } else if (selectedKey === "2") {
      // Only admins can return to the first page
      if (user?.role !== USER_ROLES.ADMIN) {
        message.error(t("setup.page.error.adminOnly"));
        return;
      }
      setSelectedKey("1");
      // Set the flag to indicate that the user is returning from the second page to the first page
      setIsFromSecondPage(true);
    }
  };

  const handleEmbeddingOk = async () => {
    setEmbeddingModalOpen(false);
    if (pendingJump) {
      setPendingJump(false);
      setSelectedKey("2");
    }
  };

  const handleConnectivityOk = async () => {
    setConnectivityWarningOpen(false);
    if (pendingJump) {
      setPendingJump(false);
      const currentConfig = configStore.getConfig();
      try {
        await configService.saveConfigToBackend(currentConfig);
      } catch (e) {
        message.error(t("setup.page.error.saveConfig"));
      }
      setSelectedKey("2");
    }
  };

  return (
    <Layout
      connectionStatus={connectionStatus}
      isCheckingConnection={isCheckingConnection}
      onCheckConnection={checkModelEngineConnection}
      selectedKey={getEffectiveSelectedKey()}
      onBackToFirstPage={handleBackToFirstPage}
      onCompleteConfig={handleCompleteConfig}
      userRole={user?.role}
    >
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          // when animation is complete and switch to the second page, ensure the knowledge base data is updated
          if (selectedKey === "2") {
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("knowledgeBaseDataUpdated", {
                  detail: { forceRefresh: true },
                })
              );
            }, 50);
          }
        }}
      >
        <motion.div
          key={selectedKey}
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          style={{ width: "100%", height: "100%" }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      <EmbedderCheckModal
        emptyWarningOpen={embeddingModalOpen}
        onEmptyOk={handleEmbeddingOk}
        onEmptyCancel={() => setEmbeddingModalOpen(false)}
        connectivityWarningOpen={connectivityWarningOpen}
        onConnectivityOk={handleConnectivityOk}
        onConnectivityCancel={() => setConnectivityWarningOpen(false)}
        modifyWarningOpen={false}
        onModifyOk={() => {}}
        onModifyCancel={() => {}}
      />
    </Layout>
  );
}
