"use client"

import { ReactNode } from "react"
import { FiRefreshCw, FiArrowLeft } from "react-icons/fi"
import { Badge, Button, Tooltip, Select, Dropdown } from "antd"
import { useRouter } from "next/navigation"
import { BugOutlined, DownOutlined } from '@ant-design/icons'
import { useTranslation } from "react-i18next"
import { languageOptions } from '@/lib/constants'
import { useLanguageSwitch } from '@/lib/languageUtils'
import { HEADER_CONFIG } from '@/lib/layoutConstants'
import { Globe } from "lucide-react"


// ================ Header 组件 ================
interface HeaderProps {
  connectionStatus: "success" | "error" | "processing";
  lastChecked: string | null;
  isCheckingConnection: boolean;
  onCheckConnection: () => void;
}

function Header({
  connectionStatus,
  lastChecked,
  isCheckingConnection,
  onCheckConnection
}: HeaderProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { currentLanguage, handleLanguageChange } = useLanguageSwitch()

  // 获取状态文本
  const getStatusText = () => {
    switch (connectionStatus) {
      case "success":
        return t("setup.header.status.connected")
      case "error":
        return t("setup.header.status.disconnected")
      case "processing":
        return t("setup.header.status.checking")
      default:
        return t("setup.header.status.unknown")
    }
  }



  return (
    <header className="w-full py-4 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm" style={{ height: HEADER_CONFIG.HEIGHT }}>
      <div className="flex items-center">
        <button
          onClick={() => router.push("/")}
          className="mr-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={t("setup.header.button.back")}
        >
          <FiArrowLeft className="text-slate-600 dark:text-slate-300 text-xl" />
        </button>
        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-500">{t("setup.header.title")}</h1>
        <div className="mx-2 h-6 border-l border-slate-300 dark:border-slate-600"></div>
        <span className="text-slate-600 dark:text-slate-400 text-sm">{t("setup.header.description")}</span>
      </div>
      {/* 语言切换 */}
      <div className="flex items-center gap-3">
        <Dropdown
          menu={{
            items: languageOptions.map(opt => ({ key: opt.value, label: opt.label })),
            onClick: ({ key }) => handleLanguageChange(key as string),
          }}
        >
          <a
            className="ant-dropdown-link text-sm !font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors flex items-center gap-2 cursor-pointer w-[110px] border-0 shadow-none bg-transparent text-left"
          >
            <Globe className="h-4 w-4" />
            {languageOptions.find(o => o.value === currentLanguage)?.label || currentLanguage}
            <DownOutlined className="text-[10px]" />
          </a>
        </Dropdown>
        {/* ModelEngine连通性状态 */}
        <div className="flex items-center px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">
          <Badge
            status={connectionStatus}
            text={getStatusText()}
            className="[&>.ant-badge-status-dot]:w-[8px] [&>.ant-badge-status-dot]:h-[8px] [&>.ant-badge-status-text]:text-base [&>.ant-badge-status-text]:ml-2 [&>.ant-badge-status-text]:font-medium"
          />
          <Tooltip title={lastChecked ? t("setup.header.tooltip.lastChecked", { time: lastChecked }) : t("setup.header.tooltip.checkStatus")}>
            <Button
              icon={<FiRefreshCw className={isCheckingConnection ? "animate-spin" : ""} />}
              size="small"
              type="text"
              onClick={onCheckConnection}
              disabled={isCheckingConnection}
              className="ml-2"
            />
          </Tooltip>
        </div>
      </div>
    </header>
  )
}

// ================ Navigation 组件 ================
interface NavigationProps {
  selectedKey: string;
  onBackToFirstPage: () => void;
  onCompleteConfig: () => void;
  isSavingConfig: boolean;
  userRole?: "user" | "admin";
  showDebugButton?: boolean;
}

function Navigation({
  selectedKey,
  onBackToFirstPage,
  onCompleteConfig,
  isSavingConfig,
  userRole,
  showDebugButton = false,
}: NavigationProps) {
  const { t } = useTranslation()

  return (
    <div className="mt-3 flex justify-between px-6">
      <div className="flex gap-2">
        {selectedKey != "1" && userRole === "admin" && (
          <button
            onClick={onBackToFirstPage}
            className={"px-6 py-2.5 rounded-md flex items-center text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"}
          >
            {t("setup.navigation.button.previous")}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCompleteConfig}
          disabled={isSavingConfig}
          className={"px-6 py-2.5 rounded-md flex items-center text-sm font-medium bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"}
          style={{ border: "none", marginLeft: selectedKey === "1" || userRole !== "admin" ? "auto" : undefined }}
        >
          {selectedKey === "3" ? (isSavingConfig ? t("setup.navigation.button.saving") : t("setup.navigation.button.complete")) :
           selectedKey === "2" && userRole !== "admin" ? (isSavingConfig ? t("setup.navigation.button.saving") : t("setup.navigation.button.complete")) :
           t("setup.navigation.button.next")}
        </button>
      </div>
    </div>
  )
}

// ================ Layout 组件 ================
interface LayoutProps {
  children: ReactNode;
  connectionStatus: "success" | "error" | "processing";
  lastChecked: string | null;
  isCheckingConnection: boolean;
  onCheckConnection: () => void;
  selectedKey: string;
  onBackToFirstPage: () => void;
  onCompleteConfig: () => void;
  isSavingConfig: boolean;
  userRole?: "user" | "admin";
  showDebugButton?: boolean;
}

function Layout({
  children,
  connectionStatus,
  lastChecked,
  isCheckingConnection,
  onCheckConnection,
  selectedKey,
  onBackToFirstPage,
  onCompleteConfig,
  isSavingConfig,
  userRole,
  showDebugButton = false,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      <Header
        connectionStatus={connectionStatus}
        lastChecked={lastChecked}
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
            isSavingConfig={isSavingConfig}
            userRole={userRole}
            showDebugButton={showDebugButton}
          />
      </div>
    </div>
  )
}

export { Header, Navigation, Layout }
export default Layout 