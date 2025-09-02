// Model connection status type
export type ModelConnectStatus =
  | "not_detected"
  | "detecting"
  | "available"
  | "unavailable";

// Model source type
export type ModelSource =
  | "openai"
  | "custom"
  | "silicon"
  | "OpenAI-API-Compatible";

// Model type
export type ModelType =
  | "llm"
  | "embedding"
  | "rerank"
  | "stt"
  | "tts"
  | "vlm"
  | "multi_embedding";

// OpenAI Model enum for agent configuration
export enum OpenAIModel {
  MainModel = "main_model",
  SubModel = "sub_model",
}

// Configuration storage key name
export const APP_CONFIG_KEY = "app";
export const MODEL_CONFIG_KEY = "model";

// Default configuration
export const defaultConfig: GlobalConfig = {
  app: {
    appName: "",
    appDescription: "",
    iconType: "preset",
    customIconUrl: "",
    avatarUri: "",
  },
  models: {
    llm: {
      modelName: "",
      displayName: "",
      apiConfig: {
        apiKey: "",
        modelUrl: "",
      },
    },
    llmSecondary: {
      modelName: "",
      displayName: "",
      apiConfig: {
        apiKey: "",
        modelUrl: "",
      },
    },
    embedding: {
      modelName: "",
      displayName: "",
      apiConfig: {
        apiKey: "",
        modelUrl: "",
      },
      dimension: 0,
    },
    multiEmbedding: {
      modelName: "",
      displayName: "",
      apiConfig: {
        apiKey: "",
        modelUrl: "",
      },
      dimension: 0,
    },
    rerank: {
      modelName: "",
      displayName: "",
      apiConfig: {
        apiKey: "",
        modelUrl: "",
      },
    },
    vlm: {
      modelName: "",
      displayName: "",
      apiConfig: {
        apiKey: "",
        modelUrl: "",
      },
    },
    stt: {
      modelName: "",
      displayName: "",
      apiConfig: {
        apiKey: "",
        modelUrl: "",
      },
    },
    tts: {
      modelName: "",
      displayName: "",
      apiConfig: {
        apiKey: "",
        modelUrl: "",
      },
    },
  },
};

// Model option interface
export interface ModelOption {
  id: string;
  name: string;
  type: ModelType;
  maxTokens: number;
  source: ModelSource;
  apiKey: string;
  apiUrl: string;
  displayName: string;
  connect_status?: ModelConnectStatus;
}

// Application configuration interface
export interface AppConfig {
  appName: string;
  appDescription: string;
  iconType: "preset" | "custom";
  customIconUrl: string | null;
  avatarUri: string | null;
}

// Model API configuration interface
export interface ModelApiConfig {
  apiKey: string;
  modelUrl: string;
}

// Single model configuration interface
export interface SingleModelConfig {
  modelName: string;
  displayName: string;
  apiConfig: ModelApiConfig;
  dimension?: number; // Only used for embedding and multiEmbedding models
}

// Model configuration interface
export interface ModelConfig {
  llm: SingleModelConfig;
  llmSecondary: SingleModelConfig;
  embedding: SingleModelConfig;
  multiEmbedding: SingleModelConfig;
  rerank: SingleModelConfig;
  vlm: SingleModelConfig;
  stt: SingleModelConfig;
  tts: SingleModelConfig;
}

// Global configuration interface
export interface GlobalConfig {
  app: AppConfig;
  models: ModelConfig;
}

// Add the type for model validation response with error_code
export interface ModelValidationResponse {
  connectivity: boolean;
  message?: string;
  error_code?: string;
  error_details?: string;
  model_name?: string;
  connect_status: string;
}
