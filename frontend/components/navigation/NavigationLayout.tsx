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
  contentMode?: "centered" | "scrollable";
  /** Custom content for the left side of the top navbar */
  topNavbarLeftContent?: React.ReactNode;
  /** Custom content for the right side of the top navbar */
  topNavbarRightContent?: React.ReactNode;
}

/**
 * Main navigation layout component
 * Combines top navbar, side navigation, and optional footer with main content area
 * 
 * @param contentMode - "centered": content is centered vertically and horizontally (default)
 *                      "scrollable": content can scroll and fills the entire area
 * @param topNavbarLeftContent - Custom content to display on the left side of the top navbar
 * @param topNavbarRightContent - Custom content to display on the right side of the top navbar
 */
export function NavigationLayout({
  children,
  onAuthRequired,
  onAdminRequired,
  showFooter = true,
  contentMode = "centered",
  topNavbarLeftContent,
  topNavbarRightContent,
}: NavigationLayoutProps) {
  const headerHeight = parseInt(HEADER_CONFIG.HEIGHT);
  const footerHeight = parseInt(FOOTER_CONFIG.HEIGHT);
  const contentMinHeight = showFooter
    ? `calc(100vh - ${headerHeight}px - ${footerHeight}px)`
    : `calc(100vh - ${headerHeight}px)`;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Top navigation bar */}
      <TopNavbar 
        leftContent={topNavbarLeftContent}
        rightContent={topNavbarRightContent}
      />

      {/* Layout with sidebar and content */}
      <Layout
        className="flex-1 bg-transparent"
        style={{
          marginTop: 0,
          marginBottom: 0,
          minHeight: contentMinHeight,
        }}
      >
        {/* Side navigation */}
        <SideNavigation
          onAuthRequired={onAuthRequired}
          onAdminRequired={onAdminRequired}
        />

        {/* Main content area */}
        <Content 
          className={
            contentMode === "centered"
              ? "flex-1 flex items-center justify-center overflow-hidden"
              : "flex-1 overflow-auto"
          }
          style={{
                  paddingTop: `${headerHeight}px`,
                  paddingBottom: showFooter ? `${footerHeight}px` : 0
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

