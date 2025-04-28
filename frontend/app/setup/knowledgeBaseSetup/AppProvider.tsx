"use client"

import React, { ReactNode } from 'react'
import { KnowledgeBaseProvider } from './knowledgeBase/KnowledgeBaseContext'
import { DocumentProvider } from './document/DocumentContext'
import { UIProvider } from './UIStateManager'

interface AppProviderProps {
  children: ReactNode
}

/**
 * AppProvider - 为应用提供全局状态管理
 * 
 * 将知识库、文档和UI状态管理组合在一起，方便一次引入所有上下文
 */
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <KnowledgeBaseProvider>
      <DocumentProvider>
        <UIProvider>
          {children}
        </UIProvider>
      </DocumentProvider>
    </KnowledgeBaseProvider>
  )
}

export default AppProvider 