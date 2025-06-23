/**
 * Authentication utilities
 */

/**
 * 获取API请求的授权头信息
 * @returns HTTP headers object containing authentication and content type information
 */
export const getAuthHeaders = () => {
  const session = typeof window !== "undefined" ? localStorage.getItem("session") : null;
  const sessionObj = session ? JSON.parse(session) : null;

  return {
    'Content-Type': 'application/json',
    'User-Agent': 'AgentFrontEnd/1.0',
    ...(sessionObj?.access_token && { "Authorization": `Bearer ${sessionObj.access_token}` }),
  };
}; 