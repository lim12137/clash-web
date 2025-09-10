/*
 * Authentication related types and constant definitions
 */
export const STATUS_CODES = {
  SUCCESS: 200,
  
  UNAUTHORIZED_HTTP: 401,

  INVALID_CREDENTIALS: 1002,
  TOKEN_EXPIRED: 1003,
  UNAUTHORIZED: 1004,
  INVALID_INPUT: 1006,
  AUTH_SERVICE_UNAVAILABLE: 1007,

  SERVER_ERROR: 1005,
};

// Local storage keys
export const STORAGE_KEYS = {
  SESSION: "session",
};

// Custom events
export const EVENTS = {
  SESSION_EXPIRED: "session-expired",
  STORAGE_CHANGE: "storage",
}; 


// User type definition
export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
  avatar_url?: string;
}

// Session type definition
export interface Session {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Error response interface
export interface ErrorResponse {
  message: string;
  code: number;
  data?: any;
}

// Authorization context type
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isLoginModalOpen: boolean;
  isRegisterModalOpen: boolean;
  isFromSessionExpired: boolean;
  authServiceUnavailable: boolean;
  isSpeedMode: boolean;
  isReady: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  openRegisterModal: () => void;
  closeRegisterModal: () => void;
  setIsFromSessionExpired: (value: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, isAdmin?: boolean, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Session response type
export interface SessionResponse {
  data?: {
    session?: Session | null;
    user?: User | null;
  };
  error: ErrorResponse | null;
}
