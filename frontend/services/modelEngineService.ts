"use client"

import { API_ENDPOINTS } from './api';
import { CONNECTION_STATUS } from '@/const/modelConfig';
import { ConnectionStatus, ModelEngineCheckResult } from '../types/modelConfig';

import { fetchWithAuth } from '@/lib/auth';

// @ts-ignore
const fetch = fetchWithAuth;

/**
 * ModelEngine service - responsible for interacting with ModelEngine
 */
const modelEngineService = {
  /**
   * Check ModelEngine connection status
   * @returns Promise<ModelEngineCheckResult> Result object containing connection status and check time
   */
  checkConnection: async (): Promise<ModelEngineCheckResult> => {
    try {
      const response = await fetch(API_ENDPOINTS.model.healthcheck, {
        method: "GET"
      })

      let status: ConnectionStatus = CONNECTION_STATUS.ERROR;
      
      if (response.ok) {
        try {
          const resp = await response.json()
          // Parse the data returned by the API
          if (resp.data.status === "Connected") {
            status = CONNECTION_STATUS.SUCCESS
          }
          else if (resp.data.status === "Disconnected") {
            status = CONNECTION_STATUS.ERROR
          }
        } catch (parseError) {
          // JSON parsing failed,视为连接失败
          console.error("响应数据解析失败:", parseError)
          status = CONNECTION_STATUS.ERROR
        }
      } else {
        status = CONNECTION_STATUS.ERROR
      }

      return {
        status,
        lastChecked: new Date().toLocaleTimeString()
      }
    } catch (error) {
      console.error("检查ModelEngine连接状态失败:", error)
      return {
        status: CONNECTION_STATUS.ERROR,
        lastChecked: new Date().toLocaleTimeString()
      }
    }
  }
}

export default modelEngineService; 