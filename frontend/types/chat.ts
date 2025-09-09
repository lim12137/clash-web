// Step related types
export interface StepSection {
  content: string
  expanded: boolean
}

export interface StepContent {
  id: string
  type: "model_output" | "parsing" | "execution" | "error" | "agent_new_run" | "executing" | "generating_code" | "search_content" | "card" | "search_content_placeholder" | "virtual" | "memory_search"
  content: string
  expanded: boolean
  timestamp: number
  subType?: "thinking" | "code" | "deep_thinking"
  isLoading?: boolean
  _preserve?: boolean
  _messageContainer?: {
    search?: any[]
    [key: string]: any
  }
}

export interface AgentStep {
  id: string
  title: string
  content: string
  expanded: boolean
  metrics: string
  // Support for both formats
  thinking: StepSection
  code: StepSection
  output: StepSection
  // New format content array
  contents: StepContent[]
  parsingContent?: string
}

// Agent related types
export interface Agent {
  agent_id: number;
  name: string;
  display_name: string;
  description: string;
  is_available: boolean;
}

export interface ChatAgentSelectorProps {
  selectedAgentId: number | null;
  onAgentSelect: (agentId: number | null) => void;
  disabled?: boolean;
  isInitialMode?: boolean;
}

// Search result type
export interface SearchResult {
  title: string
  url: string
  text: string
  published_date: string
  source_type?: string
  filename?: string
  score?: number
  score_details?: any
  isExpanded?: boolean
  tool_sign?: string
  cite_index?: number
}

// File attachment type
export interface FileAttachment {
  name: string
  type: string
  size: number
  url?: string
  object_name?: string
  description?: string
}

// Attachment item type (for chat attachment component)
export interface AttachmentItem {
  type: string;
  name: string;
  size: number;
  url?: string;
  contentType?: string;
}

// Chat attachment component props
export interface ChatAttachmentProps {
  attachments: AttachmentItem[];
  onImageClick?: (url: string) => void;
  className?: string;
}

// Main chat message type
export interface ChatMessageType {
  id: string
  role: "user" | "assistant" | "system"
  message_id?: number
  content: string
  opinion_flag?: string
  timestamp: Date
  sources?: {
    id: string
    title: string
    url?: string
    icon?: string
  }[]
  isComplete?: boolean
  showRawContent?: boolean
  docIds?: string[]
  images?: string[]
  isDeepSearch?: boolean
  isDeepSeek?: boolean
  sessionId?: string
  referenceId?: string
  reference?: any
  steps?: AgentStep[]
  finalAnswer?: string
  error?: string
  agentRun?: string
  searchResults?: SearchResult[]
  attachments?: FileAttachment[]
  thinking?: any[]
}

export interface ApiMessageItem {
  type: string
  content: string
}

export interface SearchResultItem {
  cite_index: number;
  tool_sign: string;
  title: string
  text: string
  source_type: string
  url: string
  filename: string | null
  published_date: string | null
  score: number | null
  score_details: Record<string, any>
}

export interface MinioFileItem {
  type: string
  name: string
  size: number
  object_name?: string
  url?: string
  description?: string
}

export interface ApiMessage {
  role: "user" | "assistant"
  message: ApiMessageItem[]
  message_id: number
  opinion_flag?: string
  picture?: string[]
  search?: SearchResultItem[]
  search_unit_id?: { [unitId: string]: SearchResultItem[] }
  minio_files?: MinioFileItem[]
  cards?: any[]
}

export interface ApiConversationDetail {
  create_time: number
  conversation_id: number
  message: ApiMessage[]
}

export interface ConversationListItem {
  conversation_id: number
  conversation_title: string
  create_time: number
  update_time: number
}

// File preview type
export interface FilePreview {
  id: string;
  file: File;
  type: "image" | "file";
  fileType?: string;
  extension?: string;
  previewUrl?: string;
}

// Chat sidebar props type
export interface ChatSidebarProps {
  conversationList: ConversationListItem[];
  selectedConversationId: number | null;
  openDropdownId: string | null;
  streamingConversations: Set<number>;
  completedConversations: Set<number>;
  onNewConversation: () => void;
  onDialogClick: (dialog: ConversationListItem) => void;
  onRename: (dialogId: number, title: string) => void;
  onDelete: (dialogId: number) => void;
  onSettingsClick: () => void;
  onDropdownOpenChange: (open: boolean, id: string | null) => void;
  onToggleSidebar: () => void;
  expanded: boolean;
  userEmail: string | undefined;
  userAvatarUrl: string | undefined;
  userRole: string | undefined;
}

// Image item type for chat right panel
export interface ImageItem {
  base64Data: string;
  contentType: string;
  isLoading: boolean;
  error?: string;
  loadAttempts?: number; // Load attempts
}

// Chat right panel props type
export interface ChatRightPanelProps {
  messages: ChatMessageType[];
  onImageError: (imageUrl: string) => void;
  maxInitialImages?: number;
  isVisible?: boolean;
  toggleRightPanel?: () => void;
  selectedMessageId?: string;
}

// Task message type
export interface TaskMessageType extends ChatMessageType {
  type?: string;
} 