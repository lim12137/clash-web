"use client"

import { API_ENDPOINTS } from './api';
import { CONNECTION_STATUS, ConnectionStatus } from '@/const/modelConfig';
import { ModelEngineCheckResult } from '../types/modelConfig';

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
          if (resp.status === "Connected") {
            status = CONNECTION_STATUS.SUCCESS
          }
          else if (resp.status === "Disconnected") {
            status = CONNECTION_STATUS.ERROR
          }
        } catch (parseError) {
          // JSON parsing failed, treat as connection failure
          console.error("Response data parsing failed:", parseError)
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
      console.error("Failed to check ModelEngine connection status:", error)
      return {
        status: CONNECTION_STATUS.ERROR,
        lastChecked: new Date().toLocaleTimeString()
      }
    }
  }
}

export default modelEngineService; 