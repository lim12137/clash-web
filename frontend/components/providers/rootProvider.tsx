"use client"

import { ReactNode } from "react"
import { AuthProvider as AuthContextProvider, AuthContext } from "@/hooks/useAuth"
import { ConfigProvider } from "antd"
import { LoginModal, RegisterModal, SessionListeners } from "@/components/auth"

/**
 * 应用根Provider
 * 整合所有需要的Provider
 */
export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider getPopupContainer={() => document.body}>
      <AuthContextProvider>
        {(authContextValue) => (
          <AuthContext.Provider value={authContextValue}>
            {children}
            <LoginModal />
            <RegisterModal />
            <SessionListeners />
          </AuthContext.Provider>
        )}
      </AuthContextProvider>
    </ConfigProvider>
  )
} 