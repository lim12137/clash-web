"use client";

import React, {ReactNode} from "react";
import {useRouter} from "next/navigation";
import {useTranslation} from "react-i18next";

import {Badge, Button, Dropdown} from "antd";
import {DownOutlined} from "@ant-design/icons";
import {FiArrowLeft, FiRefreshCw} from "react-icons/fi";
import {Globe} from "lucide-react";
import {languageOptions} from "@/const/constants";
import {useLanguageSwitch} from "@/lib/language";
import {HEADER_CONFIG} from "@/const/layoutConstants";
import {CONNECTION_STATUS, ConnectionStatus,} from "@/const/modelConfig";

// ================ Header ================
interface HeaderProps {
  connectionStatus: ConnectionStatus;
  isCheckingConnection: boolean;
  onCheckConnection: () => void;
  title: string;
  description: string;
}

function Header({
  connectionStatus,
  isCheckingConnection,
  onCheckConnection,
  title,
  description,
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
          {title}
        </h1>
        <div className="mx-2 h-6 border-l border-slate-300 dark:border-slate-600"></div>
        <span className="text-slate-600 dark:text-slate-400 text-sm">
          {description}
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
  onBack?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  isSaving?: boolean;
  showBack?: boolean;
  showNext?: boolean;
  showComplete?: boolean;
  nextText?: string;
  completeText?: string;
}

function Navigation({
  onBack,
  onNext,
  onComplete,
  isSaving = false,
  showBack = false,
  showNext = false,
  showComplete = false,
  nextText,
  completeText,
}: NavigationProps) {
  const { t } = useTranslation();

  const handleClick = () => {
    if (showComplete && onComplete) {
      onComplete();
    } else if (showNext && onNext) {
      onNext();
    }
  };

  const buttonText = () => {
    if (showComplete) {
      return isSaving
        ? t("setup.navigation.button.saving")
        : completeText || t("setup.navigation.button.complete");
    }
    if (showNext) {
      return nextText || t("setup.navigation.button.next");
    }
    return "";
  };

  return (
    <div className="mt-3 flex justify-between px-6">
      <div className="flex gap-2">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-md flex items-center text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
          >
            {t("setup.navigation.button.previous")}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {(showNext || showComplete) && (
          <button
            onClick={handleClick}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-md flex items-center text-sm font-medium bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{
              border: "none",
              marginLeft: !showBack ? "auto" : undefined,
            }}
          >
            {buttonText()}
          </button>
        )}
      </div>
    </div>
  );
}

// ================ Layout ================
interface SetupLayoutProps {
  children: ReactNode;
  connectionStatus: ConnectionStatus;
  isCheckingConnection: boolean;
  onCheckConnection: () => void;
  title: string;
  description: string;
  onBack?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  isSaving?: boolean;
  showBack?: boolean;
  showNext?: boolean;
  showComplete?: boolean;
  nextText?: string;
  completeText?: string;
}

export default function SetupLayout({
  children,
  connectionStatus,
  isCheckingConnection,
  onCheckConnection,
  title,
  description,
  onBack,
  onNext,
  onComplete,
  isSaving = false,
  showBack = false,
  showNext = false,
  showComplete = false,
  nextText,
  completeText,
}: SetupLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      <Header
        connectionStatus={connectionStatus}
        isCheckingConnection={isCheckingConnection}
        onCheckConnection={onCheckConnection}
        title={title}
        description={description}
      />

      {/* Main content */}
      <div className="max-w-[1800px] mx-auto px-8 pb-4 mt-6 bg-transparent">
        {children}
        <Navigation
          onBack={onBack}
          onNext={onNext}
          onComplete={onComplete}
          isSaving={isSaving}
          showBack={showBack}
          showNext={showNext}
          showComplete={showComplete}
          nextText={nextText}
          completeText={completeText}
        />
      </div>
    </div>
  );
}
