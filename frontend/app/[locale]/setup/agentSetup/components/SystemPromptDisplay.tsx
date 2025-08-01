"use client"

import { message, Input } from 'antd'
import { useState, useEffect } from 'react'
import { ThunderboltOutlined, LoadingOutlined } from '@ant-design/icons'
import { fineTunePrompt, savePrompt } from '@/services/promptService'
import { updateAgent } from '@/services/agentConfigService'
import { useTranslation } from 'react-i18next'

// Import new components
import AgentConfigurationSection from './AgentConfigurationSection'
import ExpandModal from './ExpandModal'
import FineTuneModal from './FineTuneModal'
import NonEditingOverlay from './NonEditingOverlay'

// System prompt display component Props interface
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
  // Add new props for agent name and description
  agentName?: string;
  agentDescription?: string;
  onAgentNameChange?: (name: string) => void;
  onAgentDescriptionChange?: (description: string) => void;
  // Add new prop for editing mode
  isEditingMode?: boolean;
  // Add new props for model configuration
  mainAgentModel?: string;
  mainAgentMaxStep?: number;
  onModelChange?: (value: string) => void;
  onMaxStepChange?: (value: number | null) => void;
  // Add new props for business logic and action buttons
  onBusinessLogicChange?: (value: string) => void;
  onGenerateAgent?: () => void;
  onSaveAgent?: () => void;
  isGeneratingAgent?: boolean;
  isSavingAgent?: boolean;
  isCreatingNewAgent?: boolean;
  canSaveAgent?: boolean;
  getButtonTitle?: () => string;
  // Add new props for export and delete functionality
  onExportAgent?: () => void;
  onDeleteAgent?: () => void;
  editingAgent?: any; // Current editing agent for export/delete operations
}

/**
 * System Prompt Display Component
 */
export default function SystemPromptDisplay({ 
  onDebug, 
  agentId,
  businessLogic = '',
  dutyContent = '',
  constraintContent = '',
  fewShotsContent = '',
  onDutyContentChange,
  onConstraintContentChange,
  onFewShotsContentChange,
  // Add new props
  agentName = '',
  agentDescription = '',
  onAgentNameChange,
  onAgentDescriptionChange,
  // Add new prop for editing mode
  isEditingMode = false,
  // Add new props for model configuration
  mainAgentModel = '',
  mainAgentMaxStep = 5,
  onModelChange,
  onMaxStepChange,
  // Add new props for business logic and action buttons
  onBusinessLogicChange,
  onGenerateAgent,
  onSaveAgent,
  isGeneratingAgent,
  isSavingAgent,
  isCreatingNewAgent,
  canSaveAgent,
  getButtonTitle,
  // Add new props for export and delete functionality
  onExportAgent,
  onDeleteAgent,
  editingAgent
}: SystemPromptDisplayProps) {

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tunedPrompt, setTunedPrompt] = useState("")
  const [isTuning, setIsTuning] = useState(false)
  const [expandModalOpen, setExpandModalOpen] = useState(false)
  const [expandTitle, setExpandTitle] = useState("")
  const [expandContent, setExpandContent] = useState("")
  const [expandIndex, setExpandIndex] = useState(0)
  
  const { t } = useTranslation('common')

  // Handle expand card content
  const handleExpandCard = (title: string, content: string, index: number) => {
    setExpandTitle(title)
    setExpandContent(content)
    setExpandIndex(index)
    setExpandModalOpen(true)
  }

  // Handle close expanded modal
  const handleCloseExpandedModal = () => {
    // Save modified content before closing
    switch (expandIndex) {
      case 2:
        onDutyContentChange?.(expandContent);
        break;
      case 3:
        onConstraintContentChange?.(expandContent);
        break;
      case 4:
        onFewShotsContentChange?.(expandContent);
        break;
    }
    setExpandModalOpen(false)
  }

  // Handle fine-tuning request
  const handleSendAdditionalRequest = async (request: string) => {
    // Check if any of the prompt parts have content
    const hasPromptContent = dutyContent?.trim() || constraintContent?.trim() || fewShotsContent?.trim();
    if (!hasPromptContent) {
      message.warning(t('systemPrompt.message.empty'));
      return;
    }
    
    if (!request || request.trim() === '') {
      message.warning(t('systemPrompt.message.emptyTuning'));
      return;
    }

    setIsTuning(true);
    
    try {
      // Use service for fine-tuning
      const result = await fineTunePrompt({
        agent_id: agentId!,
        system_prompt: `${dutyContent}\n\n${constraintContent}\n\n${fewShotsContent}`,
        command: request
      });
      
      setTunedPrompt(result);
      message.success(t('systemPrompt.message.tune.success'));
    } catch (error) {
      console.error(t('systemPrompt.message.tune.error'), error);
      message.error(`${t('systemPrompt.message.tune.error')} ${error instanceof Error ? error.message : t('error.unknown')}`);
    } finally {
      setIsTuning(false);
    }
  };
  
  const handleSaveTunedPrompt = async () => {
    try {
      if (!agentId) {
        message.warning(t('systemPrompt.message.noAgentId'));
        return;
      }
      // Call save interface
      await savePrompt({
        agent_id: agentId,
        prompt: tunedPrompt
      });
      setIsModalOpen(false);
      setTunedPrompt("");
      message.success(t('systemPrompt.message.save.success'));
    } catch (error) {
      console.error(t('systemPrompt.message.save.error'), error);
      message.error(t('systemPrompt.message.save.error'));
    }
  };

  // Handle manual save
  const handleSavePrompt = async () => {
    if (!agentId) return;
    
    try {
      // Save complete agent information including prompts
      const result = await updateAgent(
        Number(agentId),
        agentName, // name
        agentDescription, // description
        mainAgentModel, // modelName
        mainAgentMaxStep, // maxSteps
        false, // provideRunSummary
        undefined, // enabled
        businessLogic, // businessDescription
        dutyContent, // duty_prompt
        constraintContent, // constraint_prompt
        fewShotsContent // few_shots_prompt
      );
      
      if (result.success) {
        // Notify parent component that content has been updated
        onDutyContentChange?.(dutyContent);
        onConstraintContentChange?.(constraintContent);
        onFewShotsContentChange?.(fewShotsContent);
        message.success(t('systemPrompt.message.save.success'));
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error(t('systemPrompt.message.save.error'), error);
      message.error(t('systemPrompt.message.save.error'));
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <style jsx global>{`
        /* Responsive adjustments for SystemPromptDisplay */
        @media (max-width: 768px) {
          .system-prompt-container {
            overflow-y: auto !important;
            max-height: none !important;
          }
          .system-prompt-content {
            min-height: auto !important;
            max-height: none !important;
          }
        }
        @media (max-width: 1024px) {
          .system-prompt-business-logic {
            min-height: 100px !important;
            max-height: 150px !important;
          }
        }
      `}</style>
      
      {/* Non-editing mode overlay */}
      {!isEditingMode && <NonEditingOverlay />}

      {/* Main Container Header: 描述 Agent 应该如何工作 */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
            3
          </div>
                     <h2 className="text-lg font-medium">{t('guide.steps.describeBusinessLogic.title')}</h2>
        </div>
      </div>

      {/* Main Container Content */}
      <div className="flex-1 flex flex-col border-t pt-2 system-prompt-container overflow-hidden">
        {/* Upper Section: Business Logic Description */}
        <div className="flex-shrink-0 mb-4">
          <div className="mb-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">{t('businessLogic.title')}</h3>
          </div>
          <div className="relative">
                         <Input.TextArea
               value={businessLogic}
               onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onBusinessLogicChange?.(e.target.value)}
               placeholder={t('businessLogic.placeholder')}
              className="w-full resize-none p-3 text-base pr-20 transition-all duration-300 system-prompt-business-logic"
              style={{ 
                minHeight: '120px',
                maxHeight: '200px'
              }}
              autoSize={{ 
                minRows: 4, 
                maxRows: 8 
              }}
               disabled={!isEditingMode}
             />
            {/* Generate button positioned in input box bottom-right corner */}
            <div className="absolute bottom-2 right-2">
              <button
                onClick={onGenerateAgent}
                disabled={isGeneratingAgent || isSavingAgent}
                className="px-3 py-1.5 rounded-md flex items-center justify-center text-xs bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ border: 'none' }}
              >
                {isGeneratingAgent ? (
                  <>
                    <LoadingOutlined spin className="mr-1" />
                    {t('businessLogic.config.button.generating')}
                  </>
                ) : (
                  <>
                    <ThunderboltOutlined className="mr-1" />
                    {t('businessLogic.config.button.generatePrompt')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Lower Section: Agent Configuration */}
        <div className="flex-1 min-h-0 system-prompt-content">
      <AgentConfigurationSection
        agentId={agentId}
        dutyContent={dutyContent}
        constraintContent={constraintContent}
        fewShotsContent={fewShotsContent}
        onDutyContentChange={onDutyContentChange}
        onConstraintContentChange={onConstraintContentChange}
        onFewShotsContentChange={onFewShotsContentChange}
        agentName={agentName}
        agentDescription={agentDescription}
        onAgentNameChange={onAgentNameChange}
        onAgentDescriptionChange={onAgentDescriptionChange}
        isEditingMode={isEditingMode}
        mainAgentModel={mainAgentModel}
        mainAgentMaxStep={mainAgentMaxStep}
        onModelChange={onModelChange}
        onMaxStepChange={onMaxStepChange}
        onSavePrompt={handleSavePrompt}
        onExpandCard={handleExpandCard}
        isGeneratingAgent={isGeneratingAgent}
        // Add action button props
        onDebug={onDebug}
        onExportAgent={onExportAgent}
        onDeleteAgent={onDeleteAgent}
        onSaveAgent={onSaveAgent}
        isCreatingNewAgent={isCreatingNewAgent}
        editingAgent={editingAgent}
        canSaveAgent={canSaveAgent}
        isSavingAgent={isSavingAgent}
      />
        </div>
      </div>

      {/* Expand Modal */}
      <ExpandModal
        open={expandModalOpen}
        title={expandTitle}
        content={expandContent}
        index={expandIndex}
        onClose={handleCloseExpandedModal}
        onContentChange={setExpandContent}
      />

      {/* Fine Tune Modal */}
      <FineTuneModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setTunedPrompt("")
        }}
        onSendRequest={handleSendAdditionalRequest}
        isTuning={isTuning}
        tunedPrompt={tunedPrompt}
        onSaveTunedPrompt={handleSaveTunedPrompt}
      />
    </div>
  )
} 