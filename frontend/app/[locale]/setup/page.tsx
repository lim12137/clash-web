"use client";

import React, {useState, useEffect} from "react";
import {useRouter} from "next/navigation";
import {useTranslation} from "react-i18next";

import {useAuth} from "@/hooks/useAuth";
import {USER_ROLES} from "@/const/modelConfig";
import modelEngineService from "@/services/modelEngineService";
import {
  CONNECTION_STATUS,
  ConnectionStatus,
} from "@/const/modelConfig";
import log from "@/lib/logger";

import SetupLayout, {SetupHeaderLeftContent, SetupHeaderRightContent} from "./SetupLayout";
import {NavigationLayout} from "@/components/navigation/NavigationLayout";
import ModelsContent from "../models/ModelsContent";
import KnowledgesContent from "../knowledges/KnowledgesContent";
import AgentsContent from "../agents/AgentsContent";

type SetupStep = "models" | "knowledges" | "agents";

/**
 * SetupPage - Main setup flow page
 * Manages the setup wizard with multiple steps based on user role
 */
export default function SetupPage() {
  const router = useRouter();
  const {t} = useTranslation();
  const {user, isLoading: userLoading, isSpeedMode} = useAuth();
  const [currentStep, setCurrentStep] = useState<SetupStep>("models");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.PROCESSING
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Determine if user is admin
  const isAdmin = isSpeedMode || user?.role === USER_ROLES.ADMIN;

  // Initialize current step based on user role
  useEffect(() => {
    if (!userLoading) {
      if (!isSpeedMode && !user) {
        // Full mode without login, redirect to home
        router.push("/");
        return;
      }

      // Admin starts with models, normal user starts with knowledges
      if (isAdmin) {
        setCurrentStep("models");
      } else {
        setCurrentStep("knowledges");
      }
    }
  }, [user, userLoading, isSpeedMode, isAdmin, router]);

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

  // Handle navigation between steps
  const handleNext = () => {
    if (currentStep === "models") {
      setCurrentStep("knowledges");
    } else if (currentStep === "knowledges") {
      if (isAdmin) {
        setCurrentStep("agents");
      }
    }
  };

  const handleBack = () => {
    if (currentStep === "knowledges") {
      if (isAdmin) {
        setCurrentStep("models");
      }
    } else if (currentStep === "agents") {
      setCurrentStep("knowledges");
    }
  };

  const handleComplete = () => {
    router.push("/chat");
  };

  // Determine button visibility based on current step and user role
  const getNavigationProps = () => {
    if (!isAdmin) {
      // Normal user: only knowledges step with complete button
      return {
        showBack: false,
        showNext: false,
        showComplete: true,
      };
    }

    // Admin user navigation
    switch (currentStep) {
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

  const navProps = getNavigationProps();

  // Don't render until auth is loaded
  if (userLoading) {
    return null;
  }

  return (
    <NavigationLayout
      contentMode="scrollable"
      showFooter={true}
      topNavbarLeftContent={
        <SetupHeaderLeftContent
          title={t("setup.header.title")}
          description={t("setup.header.description")}
        />
      }
      topNavbarRightContent={
        <SetupHeaderRightContent
          connectionStatus={connectionStatus}
          isCheckingConnection={isCheckingConnection}
          onCheckConnection={checkModelEngineConnection}
        />
      }
    >
      <SetupLayout
        onBack={handleBack}
        onNext={handleNext}
        onComplete={handleComplete}
        isSaving={isSaving}
        showBack={navProps.showBack}
        showNext={navProps.showNext}
        showComplete={navProps.showComplete}
        nextText={t("setup.navigation.button.next")}
        completeText={t("setup.navigation.button.complete")}
      >
        
        {/* Render content based on current step */}
        {currentStep === "models" && isAdmin && (
          <ModelsContent
            showNavigation={true}
            onNext={handleNext}
            connectionStatus={connectionStatus}
            isCheckingConnection={isCheckingConnection}
            onCheckConnection={checkModelEngineConnection}
          />
        )}

        {currentStep === "knowledges" && (
          <KnowledgesContent
            showNavigation={true}
            onBack={handleBack}
            onNext={isAdmin ? handleNext : undefined}
            onComplete={!isAdmin ? handleComplete : undefined}
            isSaving={isSaving}
            connectionStatus={connectionStatus}
            isCheckingConnection={isCheckingConnection}
            onCheckConnection={checkModelEngineConnection}
            onSavingStateChange={setIsSaving}
          />
        )}

        {currentStep === "agents" && isAdmin && (
          <AgentsContent
            showNavigation={true}
            onBack={handleBack}
            onComplete={handleComplete}
            isSaving={isSaving}
            connectionStatus={connectionStatus}
            isCheckingConnection={isCheckingConnection}
            onCheckConnection={checkModelEngineConnection}
            onSavingStateChange={setIsSaving}
          />
        )}
      </SetupLayout>
    </NavigationLayout>
  );
}
