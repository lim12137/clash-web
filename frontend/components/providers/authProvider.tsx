"use client"

import { ConfigProvider } from "antd"
import { AuthContext, AuthProvider as AuthContextProvider } from "@/hooks/useAuth"
import { LoginModal, RegisterModal, SessionListeners } from "@/components/auth"
import { ReactNode } from "react"

/**
 * 认证提供者包装组件
 * 提供认证上下文和相关模态框
 */
export function AuthProvider({ children }: { children: ReactNode }) {
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