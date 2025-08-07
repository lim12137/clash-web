import React from "react"

// ======================= 类型定义 =======================
export interface MemoryItem {
  id: string
  memory: string
  user_id: string
  agent_id: string
  agent_name: string
  update_date: string
}

export interface MemoryGroup {
  title: string
  key: string
  items: MemoryItem[]
}

// ======================= 常量 =======================

// 分页大小
export const pageSize = 4

// 共享策略下拉标签
export const shareLabels: Record<"always" | "ask" | "never", string> = {
  always: "总是共享",
  ask: "每次询问我",
  never: "永不共享",
}

// 折叠 Panel 的基础样式
export const panelStyle: React.CSSProperties = {
  background: "#f9fafb",
  borderRadius: 4,
  border: "1px solid #f0f0f0",
}

