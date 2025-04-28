"use client"

import { API_ENDPOINTS } from './api'

export type ConnectionStatus = "success" | "error" | "processing";

interface ModelEngineCheckResult {
  status: ConnectionStatus;
  lastChecked: string;
}

/**
 * ModelEngine服务 - 负责与ModelEngine交互的服务
 */
const modelEngineService = {
  /**
   * 检查ModelEngine连接状态
   * @returns Promise<ModelEngineCheckResult> 包含连接状态和检查时间的结果对象
   */
  checkConnection: async (): Promise<ModelEngineCheckResult> => {
    try {
      const response = await fetch(API_ENDPOINTS.modelEngine.healthcheck, {
        method: "GET"
      })

      let status: ConnectionStatus = "error";
      
      if (response.ok) {
        try {
          const resp = await response.json()
          // 解析API返回的数据
          if (resp.data.status === "Connected") {
            status = "success"
          }
          else if (resp.data.status === "Disconnected") {
            status = "error"
          }
        } catch (parseError) {
          // JSON 解析失败，视为连接失败
          console.error("响应数据解析失败:", parseError)
          status = "error"
        }
      } else {
        status = "error"
      }

      return {
        status,
        lastChecked: new Date().toLocaleTimeString()
      }
    } catch (error) {
      console.error("检查ModelEngine连接状态失败:", error)
      return {
        status: "error",
        lastChecked: new Date().toLocaleTimeString()
      }
    }
  }
}

export default modelEngineService; 