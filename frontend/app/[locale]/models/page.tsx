"use client";

import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import modelEngineService from "@/services/modelEngineService";
import {
  CONNECTION_STATUS,
  ConnectionStatus,
} from "@/const/modelConfig";
import log from "@/lib/logger";

import {NavigationLayout} from "@/components/navigation/NavigationLayout";
import ModelsContent from "./ModelsContent";

/**
 * ModelsPage - Standalone model configuration page
 * Provides independent access to model management outside of the setup flow
 */
export default function ModelsPage() {
  const {t} = useTranslation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.PROCESSING
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

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

  return (
    <NavigationLayout
      contentMode="centered"
      showFooter={true}
    >
      <div className="w-full h-full p-1">
        <ModelsContent
          connectionStatus={connectionStatus}
          isCheckingConnection={isCheckingConnection}
          onCheckConnection={checkModelEngineConnection}
        />
      </div>
    </NavigationLayout>
  );
}

