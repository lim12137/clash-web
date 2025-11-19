"use client";

import { Layout } from "antd";
import { TopNavbar } from "./TopNavbar";
import { SideNavigation } from "./SideNavigation";
import { Footer } from "./Footer";
import { HEADER_CONFIG, FOOTER_CONFIG } from "@/const/layoutConstants";
import React from "react";

const { Content } = Layout;

interface NavigationLayoutProps {
  children: React.ReactNode;
  onAuthRequired?: () => void;
  onAdminRequired?: () => void;
  showFooter?: boolean;
  contentMode?: "centered" | "scrollable" | "fullscreen";
  /** Additional title text to display after logo in top navbar */
  topNavbarAdditionalTitle?: React.ReactNode;
  /** Additional content to insert before default right nav items in top navbar */
  topNavbarAdditionalRightContent?: React.ReactNode;
  /** Callback for view changes in side navigation */
  onViewChange?: (view: string) => void;
  /** Current active view */
  currentView?: string;
}

/**
 * Main navigation layout component
 * Combines top navbar, side navigation, and optional footer with main content area
 * 
 * @param contentMode - "centered": content is centered vertically and horizontally (default)
 *                      "scrollable": content can scroll and fills the entire area
 *                      "fullscreen": content fills entire area with no padding, seamless integration
 * @param topNavbarAdditionalTitle - Additional title text after logo in top navbar
 * @param topNavbarAdditionalRightContent - Additional content before default right nav items
 */
export function NavigationLayout({
  children,
  onAuthRequired,
  onAdminRequired,
  showFooter = true,
  contentMode = "centered",
  topNavbarAdditionalTitle,
  topNavbarAdditionalRightContent,
  onViewChange,
  currentView,
}: NavigationLayoutProps) {
  // Use RESERVED_HEIGHT for layout calculations (actual space occupied)
  const headerReservedHeight = parseInt(HEADER_CONFIG.RESERVED_HEIGHT);
  const footerReservedHeight = parseInt(FOOTER_CONFIG.RESERVED_HEIGHT);
  
  const contentMinHeight = showFooter
    ? `calc(100vh - ${headerReservedHeight}px - ${footerReservedHeight}px)`
    : `calc(100vh - ${headerReservedHeight}px)`;

  return (
    <div className={`${contentMode === "fullscreen" ? "h-screen" : "min-h-screen"} flex flex-col ${contentMode === "fullscreen" ? "bg-white dark:bg-slate-900" : "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"} overflow-hidden`}>
      {/* Top navigation bar */}
      <TopNavbar 
        additionalTitle={topNavbarAdditionalTitle}
        additionalRightContent={topNavbarAdditionalRightContent}
      />

      {/* Layout with sidebar and content */}
      <Layout
        className="flex-1 bg-transparent"
        style={{
          marginTop: 0,
          marginBottom: 0,
          ...(contentMode === "fullscreen" 
            ? { height: contentMinHeight } 
            : { minHeight: contentMinHeight }
          ),
        }}
      >
        {/* Side navigation */}
        <SideNavigation
          onAuthRequired={onAuthRequired}
          onAdminRequired={onAdminRequired}
          onViewChange={onViewChange}
          currentView={currentView}
        />

        {/* Main content area */}
        <Content 
          className={
            contentMode === "centered"
              ? "flex-1 flex items-center justify-center overflow-hidden"
              : contentMode === "fullscreen"
              ? "flex-1 overflow-hidden"
              : "flex-1 overflow-auto"
          }
          style={{
                  paddingTop: contentMode === "fullscreen" ? `${headerReservedHeight}px` : `${headerReservedHeight}px`,
                  paddingBottom: contentMode === "fullscreen" ? (showFooter ? `${footerReservedHeight}px` : 0) : (showFooter ? `${footerReservedHeight}px` : 0)
          }}
        >
          {contentMode === "centered" ? (
            <div className="w-full h-full flex items-center justify-center p-4">
              {children}
            </div>
          ) : (
            children
          )}
        </Content>
      </Layout>

      {/* Fixed footer at bottom */}
      {showFooter && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          <Footer />
        </div>
      )}
    </div>
  );
}

