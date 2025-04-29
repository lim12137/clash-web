"use client"

import { ReactNode } from "react"
import { AuthProvider } from "./authProvider"

/**
 * 应用根Provider
 * 整合所有需要的Provider
 */
export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
} 