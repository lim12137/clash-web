/**
 * 会话管理服务
 */

import { API_ENDPOINTS } from "./api";
import { STATUS_CODES } from "@/types/auth";
import { fetchWithAuth, saveSessionToStorage, removeSessionFromStorage, getSessionFromStorage } from "@/lib/auth";

// 上次刷新令牌的时间记录
let lastTokenRefreshTime = 0;
// 令牌刷新CD（1分钟）
const TOKEN_REFRESH_CD = 1 * 60 * 1000;

/**
 * 检查并刷新令牌（如果需要）
 */
export const sessionService = {
  checkAndRefreshToken: async (): Promise<boolean> => {
    try {
      const sessionObj = getSessionFromStorage();
      if (!sessionObj) return false;
      
      const now = Date.now();
      
      // 检查是否处于刷新冷却期
      const timeSinceLastRefresh = now - lastTokenRefreshTime;
      if (timeSinceLastRefresh < TOKEN_REFRESH_CD) {
        return true; // 处于冷却期，默认令牌有效
      }
      
      // 检查令牌是否已过期
      const expiresAt = sessionObj.expires_at * 1000; // 转换为毫秒
      if (expiresAt > now) {
        // 令牌未过期，尝试刷新
        // 更新最后刷新时间，即使尚未成功，也记录尝试时间以避免频繁请求
        lastTokenRefreshTime = now;
        
        // 调用刷新令牌API
        const response = await fetchWithAuth(API_ENDPOINTS.user.refreshToken, {
          method: "POST",
          body: JSON.stringify({
            refresh_token: sessionObj.refresh_token
          })
        });
        
        const data = await response.json();
        
        if (data.code === STATUS_CODES.SUCCESS && data.data?.session) {
          // 更新本地存储的会话信息
          const updatedSession = {
            ...sessionObj,
            access_token: data.data.session.access_token,
            refresh_token: data.data.session.refresh_token,
            expires_at: data.data.session.expires_at,
          };
          
          saveSessionToStorage(updatedSession);
          return true;
        } else {
          console.warn("令牌刷新失败:", data.message);
          
          // 如果是TOKEN_EXPIRED错误，清除会话
          if (data.code === STATUS_CODES.TOKEN_EXPIRED) {
            removeSessionFromStorage();
          }
          
          return false;
        }
      } else {
        // 令牌已过期，清除会话
        console.warn("令牌已过期");
        removeSessionFromStorage();
        return false;
      }
    } catch (error) {
      console.error("检查令牌状态失败:", error);
      return false;
    }
  }
}; 