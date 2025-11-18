"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePathname } from "next/navigation";
import { Layout, Menu, ConfigProvider, Button } from "antd";
import {
  Bot,
  Globe,
  Zap,
  Settings,
  BookOpen,
  Users,
  Database,
  ShoppingBag,
  Code,
  ChevronLeft,
  ChevronRight,
  Home,
} from "lucide-react";
import type { MenuProps } from "antd";
import { useAuth } from "@/hooks/useAuth";
import { HEADER_CONFIG, FOOTER_CONFIG } from "@/const/layoutConstants";

const { Sider } = Layout;

interface SideNavigationProps {
  onAuthRequired?: () => void;
  onAdminRequired?: () => void;
  onViewChange?: (view: string) => void;
  currentView?: string;
}

/**
 * Get menu key based on current pathname
 */
function getMenuKeyFromPathname(pathname: string): string {
  // Remove locale prefix (e.g., /zh/, /en/)
  const segments = pathname.split('/').filter(Boolean);
  const pathWithoutLocale = segments.length > 1 ? segments[1] : '';
  
  // Map paths to menu keys
  const pathToKeyMap: Record<string, string> = {
    '': '0',           // Home page
    'chat': '1',       // Start chat (separate page)
    'setup': '2',      // Quick config
    'space': '3',      // Agent space
    'agents': '5',     // Agent dev
    'knowledges': '6', // Knowledge base
    'models': '7',     // Model management
    'memory': '8',     // Memory management
  };
  
  return pathToKeyMap[pathWithoutLocale] || '0';
}

/**
 * Side navigation component with collapsible menu
 * Displays main navigation items for the application
 */
export function SideNavigation({
  onAuthRequired,
  onAdminRequired,
  onViewChange,
  currentView,
}: SideNavigationProps) {
  const { t } = useTranslation("common");
  const { user, isSpeedMode } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState("0");
  
  // Update selected key when pathname or currentView changes
  useEffect(() => {
    // If we have a currentView from parent, use it to determine the key
    if (currentView) {
      const viewToKeyMap: Record<string, string> = {
        'home': '0',
        'chat': '1',
        'setup': '2',
        'space': '3',
        'agents': '5',
        'knowledges': '6',
        'models': '7',
        'memory': '8',
      };
      setSelectedKey(viewToKeyMap[currentView] || '0');
    } else {
      // Otherwise, fall back to pathname-based selection
      const key = getMenuKeyFromPathname(pathname);
      setSelectedKey(key);
    }
  }, [pathname, currentView]);

  // Menu items configuration
  const menuItems: MenuProps["items"] = [
    {
      key: "0",
      icon: <Home className="h-4 w-4" />,
      label: t("sidebar.homePage"),
      onClick: () => {
        onViewChange?.("home");
      },
    },
    {
      key: "1",
      icon: <Bot className="h-4 w-4" />,
      label: t("sidebar.startChat"),
      onClick: () => {
        if (!isSpeedMode && !user) {
          onAuthRequired?.();
        } else {
          // Chat page remains as separate route since it's a different page structure
          window.location.href = "/chat";
        }
      },
    },
    {
      key: "2",
      icon: <Zap className="h-4 w-4" />,
      label: t("sidebar.quickConfig"),
      onClick: () => {
        if (!isSpeedMode && user?.role !== "admin") {
          onAdminRequired?.();
        } else {
          onViewChange?.("setup");
        }
      },
    },
    {
      key: "3",
      icon: <Globe className="h-4 w-4" />,
      label: t("sidebar.agentSpace"),
      onClick: () => {
        if (!isSpeedMode && !user) {
          onAuthRequired?.();
        } else {
          onViewChange?.("space");
        }
      },
    },
    {
      key: "4",
      icon: <ShoppingBag className="h-4 w-4" />,
      label: t("sidebar.agentMarket"),
    },
    {
      key: "5",
      icon: <Code className="h-4 w-4" />,
      label: t("sidebar.agentDev"),
      onClick: () => {
        if (!isSpeedMode && user?.role !== "admin") {
          onAdminRequired?.();
        } else {
          onViewChange?.("agents");
        }
      },
    },
    {
      key: "6",
      icon: <BookOpen className="h-4 w-4" />,
      label: t("sidebar.knowledgeBase"),
      onClick: () => {
        if (!isSpeedMode && !user) {
          onAuthRequired?.();
        } else {
          onViewChange?.("knowledges");
        }
      },
    },
    {
      key: "7",
      icon: <Settings className="h-4 w-4" />,
      label: t("sidebar.modelManagement"),
      onClick: () => {
        if (!isSpeedMode && user?.role !== "admin") {
          onAdminRequired?.();
        } else {
          onViewChange?.("models");
        }
      },
    },
    {
      key: "8",
      icon: <Database className="h-4 w-4" />,
      label: t("sidebar.memoryManagement"),
      onClick: () => {
        if (!isSpeedMode && !user) {
          onAuthRequired?.();
        } else {
          onViewChange?.("memory");
        }
      },
    },
    {
      key: "9",
      icon: <Users className="h-4 w-4" />,
      label: t("sidebar.userManagement"),
    },
  ];

  // Calculate sidebar height dynamically based on header and footer reserved heights
  const headerReservedHeight = parseInt(HEADER_CONFIG.RESERVED_HEIGHT);
  const footerReservedHeight = parseInt(FOOTER_CONFIG.RESERVED_HEIGHT);
  const sidebarHeight = `calc(105vh - ${headerReservedHeight}px - ${footerReservedHeight}px)`;
  const sidebarTop = `${headerReservedHeight}px`;

  return (
    <ConfigProvider
      theme={{
        components: {
          Layout: {
            siderBg: "rgba(255, 255, 255, 0.95)",
          },
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: "#e6f4ff",
            itemSelectedColor: "#1677ff",
            itemHoverBg: "#f5f5f5",
            itemHoverColor: "#1677ff",
            itemActiveBg: "#e6f4ff",
            itemColor: "#334155",
            iconSize: 16,
            itemBorderRadius: 6,
            itemMarginInline: 6,
            itemPaddingInline: 12,
            itemHeight: 36,
          },
        },
      }}
    >
      <div style={{ position: "relative" }}>
        <Sider
          collapsed={collapsed}
          trigger={null}
          breakpoint="lg"
          collapsedWidth={64}
          width={250}
          className="!bg-white/95 dark:!bg-slate-900/95 border-r border-slate-200 dark:border-slate-700 backdrop-blur-sm shadow-sm"
          style={{
            overflow: "auto",
            height: sidebarHeight,
            position: "sticky",
            top: sidebarTop,
            left: 0,
          }}
        >
          <div className="py-2 h-full">
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={({ key }) => setSelectedKey(key)}
              className="!bg-transparent !border-r-0"
              style={{
                height: "100%",
                borderRight: 0,
              }}
            />
          </div>
        </Sider>

        {/* Custom circular floating toggle button - positioned outside Sider */}
        <Button
          type="primary"
          shape="circle"
          size="small"
          onClick={() => setCollapsed(!collapsed)}
          className="shadow-md hover:shadow-lg transition-all"
          style={{
            position: "fixed",
            left: collapsed ? "52px" : "238px",
            top: "50vh",
            transform: "translateY(-50%)",
            width: "24px",
            height: "24px",
            minWidth: "24px",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid white",
            zIndex: 1000,
            transition: "left 0.2s ease",
          }}
          icon={
            collapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )
          }
        />
      </div>
    </ConfigProvider>
  );
}

