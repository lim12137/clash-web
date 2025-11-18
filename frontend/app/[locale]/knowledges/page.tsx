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
import KnowledgesContent from "./KnowledgesContent";

/**
 * KnowledgesPage - Standalone knowledge base configuration page
 * Provides independent access to knowledge base management outside of the setup flow
 */
export default function KnowledgesPage() {
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
      contentMode="scrollable"
      showFooter={true}
    >
      <div className="w-full h-full p-8">
        <KnowledgesContent
          isSaving={false}
          connectionStatus={connectionStatus}
          isCheckingConnection={isCheckingConnection}
          onCheckConnection={checkModelEngineConnection}
        />
      </div>
    </NavigationLayout>
  );
}

