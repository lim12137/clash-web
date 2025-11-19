"use client";

import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Button } from "@/components/ui/button";
import { NavigationLayout } from "@/components/navigation/NavigationLayout";
import { HomepageContent } from "@/components/homepage/HomepageContent";
import { LoginModal } from "@/components/auth/loginModal";
import { RegisterModal } from "@/components/auth/registerModal";
import { useAuth } from "@/hooks/useAuth";
import { Modal, ConfigProvider, App } from "antd";
import modelEngineService from "@/services/modelEngineService";
import { CONNECTION_STATUS, ConnectionStatus } from "@/const/modelConfig";
import log from "@/lib/logger";

// Import content components
import MemoryContent from "./memory/MemoryContent";
import ModelsContent from "./models/ModelsContent";
import AgentsContent from "./agents/AgentsContent";
import KnowledgesContent from "./knowledges/KnowledgesContent";
import { SpaceContent } from "./space/components/SpaceContent";
import { fetchAgentList, importAgent } from "@/services/agentConfigService";
import SetupLayout from "./setup/SetupLayout";
import { ChatContent } from "./chat/internal/ChatContent";
import { ChatTopNavContent } from "./chat/internal/ChatTopNavContent";
import { Badge, Button as AntButton } from "antd";
import { FiRefreshCw } from "react-icons/fi";
import { USER_ROLES } from "@/const/modelConfig";

// View type definition
type ViewType = "home" | "memory" | "models" | "agents" | "knowledges" | "space" | "setup" | "chat";
type SetupStep = "models" | "knowledges" | "agents";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ConfigProvider getPopupContainer={() => document.body}>
      <FrontpageContent />
    </ConfigProvider>
  );

  function FrontpageContent() {
    const { t } = useTranslation("common");
    const { message } = App.useApp();
    const {
      user,
      isLoading: userLoading,
      openLoginModal,
      openRegisterModal,
      isSpeedMode,
    } = useAuth();
    const [loginPromptOpen, setLoginPromptOpen] = useState(false);
    const [adminRequiredPromptOpen, setAdminRequiredPromptOpen] =
      useState(false);
    
    // View state management
    const [currentView, setCurrentView] = useState<ViewType>("home");
    
    // Connection status for model-dependent views
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
      CONNECTION_STATUS.PROCESSING
    );
    const [isCheckingConnection, setIsCheckingConnection] = useState(false);
    
    // Space-specific states
    const [agents, setAgents] = useState<any[]>([]);
    const [isLoadingAgents, setIsLoadingAgents] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    
    // Setup-specific states
    const [currentSetupStep, setCurrentSetupStep] = useState<SetupStep>("models");
    const [isSaving, setIsSaving] = useState(false);

    // Handle operations that require login
    const handleAuthRequired = () => {
      if (!isSpeedMode && !user) {
        setLoginPromptOpen(true);
      }
    };

    // Confirm login dialog
    const handleCloseLoginPrompt = () => {
      setLoginPromptOpen(false);
    };

    // Handle login button click
    const handleLoginClick = () => {
      setLoginPromptOpen(false);
      openLoginModal();
    };

    // Handle register button click
    const handleRegisterClick = () => {
      setLoginPromptOpen(false);
      openRegisterModal();
    };

    // Handle operations that require admin privileges
    const handleAdminRequired = () => {
      if (!isSpeedMode && user?.role !== "admin") {
        setAdminRequiredPromptOpen(true);
      }
    };

    // Close admin prompt dialog
    const handleCloseAdminPrompt = () => {
      setAdminRequiredPromptOpen(false);
    };
    
    // Determine if user is admin
    const isAdmin = isSpeedMode || user?.role === USER_ROLES.ADMIN;
    
    // Handle view change from navigation
    const handleViewChange = (view: string) => {
      const viewType = view as ViewType;
      setCurrentView(viewType);
      
      // Initialize setup step based on user role
      if (viewType === "setup") {
        if (isAdmin) {
          setCurrentSetupStep("models");
        } else {
          setCurrentSetupStep("knowledges");
        }
      }
      
      // Load data for specific views
      if (viewType === "space" && agents.length === 0) {
        loadAgents();
      }
    };
    
    // Check ModelEngine connection status
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
    
    // Load agents for space view
    const loadAgents = async () => {
      setIsLoadingAgents(true);
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
        setIsLoadingAgents(false);
      }
    };
    
    // Handle import agent for space view
    const handleImportAgent = () => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
      fileInput.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".json")) {
          message.error(t("businessLogic.config.error.invalidFileType"));
          return;
        }

        setIsImporting(true);
        try {
          const fileContent = await file.text();
          let agentInfo;

          try {
            agentInfo = JSON.parse(fileContent);
          } catch (parseError) {
            message.error(t("businessLogic.config.error.invalidFileType"));
            setIsImporting(false);
            return;
          }

          const result = await importAgent(agentInfo);

          if (result.success) {
            message.success(t("businessLogic.config.error.agentImportSuccess"));
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
    
    // Setup navigation handlers
    const handleSetupNext = () => {
      if (currentSetupStep === "models") {
        setCurrentSetupStep("knowledges");
      } else if (currentSetupStep === "knowledges") {
        if (isAdmin) {
          setCurrentSetupStep("agents");
        }
      }
    };

    const handleSetupBack = () => {
      if (currentSetupStep === "knowledges") {
        if (isAdmin) {
          setCurrentSetupStep("models");
        }
      } else if (currentSetupStep === "agents") {
        setCurrentSetupStep("knowledges");
      }
    };

    const handleSetupComplete = () => {
      setCurrentView("chat");
    };
    
    // Determine setup button visibility based on current step and user role
    const getSetupNavigationProps = () => {
      if (!isAdmin) {
        return {
          showBack: false,
          showNext: false,
          showComplete: true,
        };
      }

      switch (currentSetupStep) {
        case "models":
          return {
            showBack: false,
            showNext: true,
            showComplete: false,
          };
        case "knowledges":
          return {
            showBack: true,
            showNext: true,
            showComplete: false,
          };
        case "agents":
          return {
            showBack: true,
            showNext: false,
            showComplete: true,
          };
        default:
          return {
            showBack: false,
            showNext: false,
            showComplete: false,
          };
      }
    };

    // Render content based on current view
    const renderContent = () => {
      switch (currentView) {
        case "home":
          return (
            <div className="w-full h-full flex items-center justify-center p-4">
              <HomepageContent
                onAuthRequired={handleAuthRequired}
                onAdminRequired={handleAdminRequired}
                onChatNavigate={() => setCurrentView("chat")}
                onSetupNavigate={() => setCurrentView("setup")}
                onSpaceNavigate={() => setCurrentView("space")}
              />
            </div>
          );
        
        case "memory":
          return (
            <div className="w-full h-full p-1">
              <MemoryContent />
            </div>
          );
        
        case "models":
          return (
            <div className="w-full h-full p-1">
              <ModelsContent
                connectionStatus={connectionStatus}
                isCheckingConnection={isCheckingConnection}
                onCheckConnection={checkModelEngineConnection}
              />
            </div>
          );
        
        case "agents":
          return (
            <div className="w-full h-full p-8">
              <AgentsContent
                connectionStatus={connectionStatus}
                isCheckingConnection={isCheckingConnection}
                onCheckConnection={checkModelEngineConnection}
              />
            </div>
          );
        
        case "knowledges":
          return (
            <div className="w-full h-full p-8">
              <KnowledgesContent
                isSaving={false}
                connectionStatus={connectionStatus}
                isCheckingConnection={isCheckingConnection}
                onCheckConnection={checkModelEngineConnection}
              />
            </div>
          );
        
        case "space":
          return (
            <SpaceContent
              agents={agents}
              isLoading={isLoadingAgents}
              isImporting={isImporting}
              onRefresh={loadAgents}
              onLoadAgents={loadAgents}
              onImportAgent={handleImportAgent}
              onChatNavigate={(agentId) => {
                // TODO: Store the selected agentId and pass it to ChatContent
                // For now, just navigate to chat view
                setCurrentView("chat");
              }}
            />
          );
        
        case "chat":
          return <ChatContent />;
        
        case "setup":
          const setupNavProps = getSetupNavigationProps();
          return (
            <SetupLayout
              onBack={handleSetupBack}
              onNext={handleSetupNext}
              onComplete={handleSetupComplete}
              isSaving={isSaving}
              showBack={setupNavProps.showBack}
              showNext={setupNavProps.showNext}
              showComplete={setupNavProps.showComplete}
              nextText={t("setup.navigation.button.next")}
              completeText={t("setup.navigation.button.complete")}
            >
              {currentSetupStep === "models" && isAdmin && (
                <ModelsContent
                  onNext={handleSetupNext}
                  connectionStatus={connectionStatus}
                  isCheckingConnection={isCheckingConnection}
                  onCheckConnection={checkModelEngineConnection}
                />
              )}

              {currentSetupStep === "knowledges" && (
                <KnowledgesContent
                  isSaving={isSaving}
                  connectionStatus={connectionStatus}
                  isCheckingConnection={isCheckingConnection}
                  onCheckConnection={checkModelEngineConnection}
                  onSavingStateChange={setIsSaving}
                />
              )}

              {currentSetupStep === "agents" && isAdmin && (
                <AgentsContent
                  isSaving={isSaving}
                  connectionStatus={connectionStatus}
                  isCheckingConnection={isCheckingConnection}
                  onCheckConnection={checkModelEngineConnection}
                  onSavingStateChange={setIsSaving}
                />
              )}
            </SetupLayout>
          );
        
        default:
          return null;
      }
    };

    // Get status text for connection badge
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
    
    // Render status badge for setup view
    const renderStatusBadge = () => (
      <div className="flex items-center px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
        <Badge
          status={connectionStatus}
          text={getStatusText()}
          className="[&>.ant-badge-status-dot]:w-[6px] [&>.ant-badge-status-dot]:h-[6px] [&>.ant-badge-status-text]:text-xs [&>.ant-badge-status-text]:ml-1.5 [&>.ant-badge-status-text]:font-medium"
        />
        <AntButton
          icon={
            <FiRefreshCw
              className={`h-3.5 w-3.5 ${isCheckingConnection ? "animate-spin" : ""}`}
            />
          }
          size="small"
          type="text"
          onClick={checkModelEngineConnection}
          disabled={isCheckingConnection}
          className="ml-1.5 !p-0 !h-auto !min-w-0"
        />
      </div>
    );

    return (
      <NavigationLayout
        onAuthRequired={handleAuthRequired}
        onAdminRequired={handleAdminRequired}
        onViewChange={handleViewChange}
        currentView={currentView}
        showFooter={currentView !== "setup"}
        contentMode={
          currentView === "home" 
            ? "centered" 
            : currentView === "memory" || currentView === "models" 
            ? "centered" 
            : currentView === "chat"
            ? "fullscreen"
            : "scrollable"
        }
        topNavbarAdditionalTitle={
          currentView === "chat" ? <ChatTopNavContent /> : undefined
        }
        topNavbarAdditionalRightContent={
          currentView === "setup" ? renderStatusBadge() : undefined
        }
      >
        {renderContent()}

        {/* Login prompt dialog - only shown in full version */}
        {!isSpeedMode && (
          <Modal
            title={t("page.loginPrompt.title")}
            open={loginPromptOpen}
            onCancel={handleCloseLoginPrompt}
            footer={[
              <Button
                key="register"
                variant="link"
                onClick={handleRegisterClick}
                className="bg-white mr-2"
              >
                {t("page.loginPrompt.register")}
              </Button>,
              <Button
                key="login"
                onClick={handleLoginClick}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {t("page.loginPrompt.login")}
              </Button>,
            ]}
            centered
          >
            <div className="py-2">
              <h3 className="text-base font-medium mb-2">
                {t("page.loginPrompt.header")}
              </h3>
              <p className="text-gray-600 mb-3">
                {t("page.loginPrompt.intro")}
              </p>

              <div className="rounded-md mb-6 mt-3">
                <h3 className="text-base font-medium mb-1">
                  {t("page.loginPrompt.benefitsTitle")}
                </h3>
                <ul className="text-gray-600 pl-5 list-disc">
                  {(
                    t("page.loginPrompt.benefits", {
                      returnObjects: true,
                    }) as string[]
                  ).map((benefit, i) => (
                    <li key={i}>{benefit}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <p className="text-base font-medium">
                  <Trans i18nKey="page.loginPrompt.githubSupport">
                    ⭐️ Nexent is still growing, please help me by starring on{" "}
                    <a
                      href="https://github.com/ModelEngine-Group/nexent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-bold"
                    >
                      GitHub
                    </a>
                    , thank you.
                  </Trans>
                </p>
              </div>
              <br />

              <p className="text-gray-500 text-xs">
                {t("page.loginPrompt.noAccount")}
              </p>
            </div>
          </Modal>
        )}

        {/* Login and register modals - only shown in full version */}
        {!isSpeedMode && (
          <>
            <LoginModal />
            <RegisterModal />
          </>
        )}

        {/* Admin prompt dialog - only shown in full version */}
        {!isSpeedMode && (
          <Modal
            title={t("page.adminPrompt.title")}
            open={adminRequiredPromptOpen}
            onCancel={handleCloseAdminPrompt}
            footer={[
              <Button
                key="register"
                variant="link"
                onClick={() => {
                  setAdminRequiredPromptOpen(false);
                  openRegisterModal();
                }}
                className="bg-white mr-2"
              >
                {t("page.loginPrompt.register")}
              </Button>,
              <Button
                key="login"
                onClick={() => {
                  setAdminRequiredPromptOpen(false);
                  openLoginModal();
                }}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {t("page.loginPrompt.login")}
              </Button>,
            ]}
            centered
          >
            <div className="py-2">
              <p className="text-gray-600">{t("page.adminPrompt.intro")}</p>
            </div>
            <div className="py-2">
              <h3 className="text-base font-medium mb-2">
                {t("page.adminPrompt.unlockHeader")}
              </h3>
              <p className="text-gray-600 mb-3">
                {t("page.adminPrompt.unlockIntro")}
              </p>
              <div className="rounded-md mb-6 mt-3">
                <h3 className="text-base font-medium mb-1">
                  {t("page.adminPrompt.permissionsTitle")}
                </h3>
                <ul className="text-gray-600 pl-5 list-disc">
                  {(
                    t("page.adminPrompt.permissions", {
                      returnObjects: true,
                    }) as string[]
                  ).map((permission, i) => (
                    <li key={i}>{permission}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <p className="text-base font-medium">
                  <Trans i18nKey="page.adminPrompt.githubSupport">
                    ⭐️ Nexent is still growing, please help me by starring on{" "}
                    <a
                      href="https://github.com/ModelEngine-Group/nexent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-bold"
                    >
                      GitHub
                    </a>
                    , thank you.
                  </Trans>
                  <br />
                  <br />
                  <Trans i18nKey="page.adminPrompt.becomeAdmin">
                    💡 Want to become an administrator? Please visit the{" "}
                    <a
                      href="http://nexent.tech/contact"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-bold"
                    >
                      official contact page
                    </a>{" "}
                    to apply for an administrator account.
                  </Trans>
                </p>
              </div>
              <br />
            </div>
          </Modal>
        )}
      </NavigationLayout>
    );
  }
}
