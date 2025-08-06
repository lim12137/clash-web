"use client"

import PromptManager from './PromptManager'

// System prompt display component Props interface - 保持与原来相同的接口
export interface SystemPromptDisplayProps {
  onDebug?: () => void;
  agentId?: number;
  businessLogic?: string;
  dutyContent?: string;
  constraintContent?: string;
  fewShotsContent?: string;
  onDutyContentChange?: (content: string) => void;
  onConstraintContentChange?: (content: string) => void;
  onFewShotsContentChange?: (content: string) => void;
  agentName?: string;
  agentDescription?: string;
  onAgentNameChange?: (name: string) => void;
  onAgentDescriptionChange?: (description: string) => void;
  isEditingMode?: boolean;
  mainAgentModel?: string;
  mainAgentMaxStep?: number;
  onModelChange?: (value: string) => void;
  onMaxStepChange?: (value: number | null) => void;
  onBusinessLogicChange?: (value: string) => void;
  onGenerateAgent?: () => void;
  onSaveAgent?: () => void;
  isGeneratingAgent?: boolean;
  isSavingAgent?: boolean;
  isCreatingNewAgent?: boolean;
  canSaveAgent?: boolean;
  getButtonTitle?: () => string;
  onExportAgent?: () => void;
  onDeleteAgent?: () => void;
  onDeleteSuccess?: () => void;
  editingAgent?: any;
}

/**
 * System Prompt Display Component - 现在使用统一的PromptManager
 */
export default function SystemPromptDisplay(props: SystemPromptDisplayProps) {
  return <PromptManager {...props} />
} 