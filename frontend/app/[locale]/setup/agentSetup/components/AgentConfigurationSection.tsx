"use client"

import { Collapse, Badge, Button } from 'antd'
import { ExpandAltOutlined, SaveOutlined, LoadingOutlined, BugOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { OpenAIModel } from '../ConstInterface'
import PromptEditor from './PromptEditor'
import { MilkdownProvider } from '@milkdown/react'

export interface AgentConfigurationSectionProps {
  agentId?: number;
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
  onSavePrompt?: () => void;
  onExpandCard?: (title: string, content: string, index: number) => void;
  isGeneratingAgent?: boolean; // 新增：生成状态
  // Add new props for action buttons
  onDebug?: () => void;
  onExportAgent?: () => void;
  onDeleteAgent?: () => void;
  onSaveAgent?: () => void;
  isCreatingNewAgent?: boolean;
  editingAgent?: any;
  canSaveAgent?: boolean;
  isSavingAgent?: boolean;
}

export default function AgentConfigurationSection({
  agentId,
  dutyContent = '',
  constraintContent = '',
  fewShotsContent = '',
  onDutyContentChange,
  onConstraintContentChange,
  onFewShotsContentChange,
  agentName = '',
  agentDescription = '',
  onAgentNameChange,
  onAgentDescriptionChange,
  isEditingMode = false,
  mainAgentModel = '',
  mainAgentMaxStep = 5,
  onModelChange,
  onMaxStepChange,
  onSavePrompt,
  onExpandCard,
  isGeneratingAgent = false,
  // Add new props for action buttons
  onDebug,
  onExportAgent,
  onDeleteAgent,
  onSaveAgent,
  isCreatingNewAgent = false,
  editingAgent,
  canSaveAgent = false,
  isSavingAgent = false
}: AgentConfigurationSectionProps) {
  const { t } = useTranslation('common')
  
  // Add local state to track content of three sections
  const [localDutyContent, setLocalDutyContent] = useState(dutyContent)
  const [localConstraintContent, setLocalConstraintContent] = useState(constraintContent)
  const [localFewShotsContent, setLocalFewShotsContent] = useState(fewShotsContent)
  
  // Add segmented state management
  const [activeSegment, setActiveSegment] = useState<string>('agent-info');
  const [renderKey, setRenderKey] = useState<number>(0);

  // Optimized click handlers using useCallback
  const handleSegmentClick = useCallback((segment: string) => {
    setActiveSegment(segment);
    setRenderKey(prev => prev + 1);
  }, []);

  // Set default active segment when entering edit mode
  useEffect(() => {
    if (isEditingMode) {
      setActiveSegment('agent-info');
    }
  }, [isEditingMode]);

  // Move getBadgeProps to component level
  const getBadgeProps = (index: number): { status?: 'success' | 'warning' | 'error' | 'default', color?: string } => {
    switch(index) {
      case 1:
        return { status: 'success' };  // Green - Agent Info
      case 2:
        return { status: 'warning' };  // Yellow - Duty
      case 3:
        return { color: '#1677ff' };   // Blue - Constraint
      case 4:
        return { status: 'default' };  // Default - Few Shots
      default:
        return { status: 'default' };
    }
  };

  // Update local state
  useEffect(() => {
    if (dutyContent !== localDutyContent) {
      setLocalDutyContent(dutyContent);
    }
    if (constraintContent !== localConstraintContent) {
      setLocalConstraintContent(constraintContent);
    }
    if (fewShotsContent !== localFewShotsContent) {
      setLocalFewShotsContent(fewShotsContent);
    }
  }, [dutyContent, constraintContent, fewShotsContent, localDutyContent, localConstraintContent, localFewShotsContent]);

  // Render content based on active segment
  const renderContent = () => {
    switch (activeSegment) {
      case 'agent-info':
        return (
          <div className="p-4 agent-info-content">
            {/* Agent Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('agent.name')}:
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => onAgentNameChange?.(e.target.value)}
                placeholder={t('agent.namePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 box-border"
                disabled={!isEditingMode}
              />
            </div>
            
            {/* Model Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('businessLogic.config.model')}:
              </label>
              <select
                value={mainAgentModel}
                onChange={(e) => onModelChange?.(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 box-border"
                disabled={!isEditingMode}
              >
                <option value={OpenAIModel.MainModel}>{t('model.option.main')}</option>
                <option value={OpenAIModel.SubModel}>{t('model.option.sub')}</option>
              </select>
            </div>
            
            {/* Max Steps */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('businessLogic.config.maxSteps')}:
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={mainAgentMaxStep}
                onChange={(e) => onMaxStepChange?.(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 box-border"
                disabled={!isEditingMode}
              />
            </div>
            
            {/* Agent Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('agent.description')}:
              </label>
              <textarea
                value={agentDescription}
                onChange={(e) => onAgentDescriptionChange?.(e.target.value)}
                placeholder={t('agent.descriptionPlaceholder')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none box-border"
                disabled={!isEditingMode}
                style={{
                  minHeight: '100px',
                  maxHeight: '150px'
                }}
              />
            </div>
          </div>
        );
      
      case 'duty':
        return (
          <div className="relative p-4">
            <button
              onClick={() => onExpandCard?.(t('systemPrompt.card.duty.title'), localDutyContent, 2)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 hover:bg-white text-gray-500 hover:text-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
              style={{ border: "none" }}
              title={t('systemPrompt.button.expand')}
            >
              <ExpandAltOutlined className="text-xs" />
            </button>
            <div className="pr-8">
              <MilkdownProvider>
                <PromptEditor
                  value={localDutyContent}
                  onChange={(value) => {
                    setLocalDutyContent(value);
                    onDutyContentChange?.(value);
                  }}
                  placeholder={t('systemPrompt.placeholder')}
                />
              </MilkdownProvider>
            </div>
          </div>
        );
      
      case 'constraint':
        return (
          <div className="relative p-4">
            <button
              onClick={() => onExpandCard?.(t('systemPrompt.card.constraint.title'), localConstraintContent, 3)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 hover:bg-white text-gray-500 hover:text-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
              style={{ border: "none" }}
              title={t('systemPrompt.button.expand')}
            >
              <ExpandAltOutlined className="text-xs" />
            </button>
            <div className="pr-8">
              <MilkdownProvider>
                <PromptEditor
                  value={localConstraintContent}
                  onChange={(value) => {
                    setLocalConstraintContent(value);
                    onConstraintContentChange?.(value);
                  }}
                  placeholder={t('systemPrompt.placeholder')}
                />
              </MilkdownProvider>
            </div>
          </div>
        );
      
      case 'few-shots':
        return (
          <div className="relative p-4">
            <button
              onClick={() => onExpandCard?.(t('systemPrompt.card.fewShots.title'), localFewShotsContent, 4)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/90 hover:bg-white text-gray-500 hover:text-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
              style={{ border: "none" }}
              title={t('systemPrompt.button.expand')}
            >
              <ExpandAltOutlined className="text-xs" />
            </button>
            <div className="pr-8">
              <MilkdownProvider>
                <PromptEditor
                  value={localFewShotsContent}
                  onChange={(value) => {
                    setLocalFewShotsContent(value);
                    onFewShotsContentChange?.(value);
                  }}
                  placeholder={t('systemPrompt.placeholder')}
                />
              </MilkdownProvider>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full relative mt-4">
      {/* Section Title */}
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <div className="flex items-center">
          <h3 className="text-sm font-medium text-gray-700">{t('agent.detailContent.title')}</h3>
        </div>
      </div>
      
      {/* Segmented Control */}
      <div className="flex justify-center mb-4 flex-shrink-0">
        <div className="w-full max-w-4xl">
          <div className="flex bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={handleSegmentClick.bind(null, 'agent-info')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors text-sm segment-button ${
                activeSegment === 'agent-info'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              style={{ fontSize: '14px' }}
              type="button"
            >
              {t('agent.info.title')}
            </button>
            <button
              onClick={handleSegmentClick.bind(null, 'duty')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative text-sm segment-button ${
                activeSegment === 'duty'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              style={{ fontSize: '14px' }}
              type="button"
            >
              {t('systemPrompt.card.duty.title')}
              {isGeneratingAgent && activeSegment === 'duty' && (
                <LoadingOutlined className="ml-2 text-white" />
              )}
            </button>
            <button
              onClick={handleSegmentClick.bind(null, 'constraint')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative text-sm segment-button ${
                activeSegment === 'constraint'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              style={{ fontSize: '14px' }}
              type="button"
            >
              {t('systemPrompt.card.constraint.title')}
              {isGeneratingAgent && activeSegment === 'constraint' && (
                <LoadingOutlined className="ml-2 text-white" />
              )}
            </button>
            <button
              onClick={handleSegmentClick.bind(null, 'few-shots')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative text-sm segment-button ${
                activeSegment === 'few-shots'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              style={{ fontSize: '14px' }}
              type="button"
            >
              {t('systemPrompt.card.fewShots.title')}
              {isGeneratingAgent && activeSegment === 'few-shots' && (
                <LoadingOutlined className="ml-2 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Content area - flexible height */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full max-w-4xl mx-auto min-h-0" style={{ 
        maxHeight: 'min(calc(60vh - 120px), 450px)', 
        minHeight: 'min(calc(40vh - 120px), 280px)'
      }}>
        <style jsx global>{`
          /* Custom scrollbar styles for better UX */
          .milkdown-editor-container .milkdown {
            overflow: auto !important;
          }
          .milkdown-editor-container .milkdown .editor {
            overflow: auto !important;
          }
          /* Show Milkdown editor's scrollbar */
          .milkdown-editor-container .milkdown .editor::-webkit-scrollbar {
            width: 8px !important;
            display: block !important;
          }
          .milkdown-editor-container .milkdown .editor {
            scrollbar-width: auto !important;
            -ms-overflow-style: auto !important;
          }
          /* Show all Milkdown related scrollbars */
          .milkdown-editor-container *::-webkit-scrollbar {
            width: 8px !important;
            display: block !important;
          }
          .milkdown-editor-container * {
            scrollbar-width: auto !important;
            -ms-overflow-style: auto !important;
          }
          /* Force consistent font sizes */
          .agent-config-content * {
            font-size: inherit !important;
          }
          .agent-config-content input,
          .agent-config-content select,
          .agent-config-content textarea {
            font-size: 14px !important;
          }
          .agent-config-content label {
            font-size: 14px !important;
          }
          /* Custom scrollbar for content area */
          .content-scroll::-webkit-scrollbar {
            width: 8px !important;
            display: block !important;
          }
          .content-scroll::-webkit-scrollbar-track {
            background: #f1f5f9 !important;
            border-radius: 4px !important;
          }
          .content-scroll::-webkit-scrollbar-thumb {
            background: #cbd5e1 !important;
            border-radius: 4px !important;
          }
          .content-scroll::-webkit-scrollbar-thumb:hover {
            background: #94a3b8 !important;
          }
          /* Custom scrollbar for input containers */
          .overflow-y-auto::-webkit-scrollbar {
            width: 8px !important;
            display: block !important;
          }
          .overflow-y-auto::-webkit-scrollbar-track {
            background: #f1f5f9 !important;
            border-radius: 4px !important;
          }
          .overflow-y-auto::-webkit-scrollbar-thumb {
            background: #cbd5e1 !important;
            border-radius: 4px !important;
          }
          .overflow-y-auto::-webkit-scrollbar-thumb:hover {
            background: #94a3b8 !important;
          }
          /* Prevent button click issues */
          .segment-button {
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
          }
          .segment-button:focus {
            outline: none !important;
          }
          /* Responsive adjustments for small screens */
          @media (max-width: 768px) {
            .agent-config-content {
              height: calc(50vh - 80px) !important;
              min-height: calc(300px - 80px) !important;
              max-height: calc(50vh - 80px) !important;
            }
            .content-scroll {
              height: calc(50vh - 82px) !important;
              min-height: calc(300px - 82px) !important;
            }
          }
          
          @media (max-width: 480px) {
            .agent-config-content {
              height: calc(45vh - 80px) !important;
              min-height: calc(250px - 80px) !important;
              max-height: calc(45vh - 80px) !important;
            }
            .content-scroll {
              height: calc(45vh - 82px) !important;
              min-height: calc(250px - 82px) !important;
            }
          }
          
          /* Ensure textarea has proper height in agent info */
          .agent-info-content textarea {
            min-height: 80px !important;
            max-height: 120px !important;
          }
          
          @media (max-width: 768px) {
            .agent-info-content textarea {
              min-height: 60px !important;
              max-height: 100px !important;
            }
          }
          
          /* Ensure button container is always visible */
          .agent-config-buttons {
            position: sticky !important;
            bottom: 0 !important;
            z-index: 10 !important;
            background: white !important;
            box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1) !important;
          }
          
          /* Responsive button styles */
          .responsive-button {
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          @media (max-width: 768px) {
            .agent-config-buttons {
              padding: 12px 16px !important;
              margin: 0 -16px !important;
            }
            .responsive-button {
              font-size: 12px !important;
              padding: 4px 8px !important;
              height: 28px !important;
              min-width: 60px !important;
              max-width: 120px !important;
            }
            .responsive-button .anticon {
              font-size: 12px !important;
            }
          }
          
          @media (max-width: 480px) {
            .responsive-button {
              font-size: 11px !important;
              padding: 3px 6px !important;
              height: 24px !important;
              min-width: 50px !important;
              max-width: 100px !important;
              flex: 1 0 auto !important;
            }
            .responsive-button .anticon {
              font-size: 11px !important;
              margin-right: 2px !important;
            }
            .agent-config-buttons .flex {
              gap: 4px !important;
              max-width: 100% !important;
              flex-wrap: wrap !important;
            }
            .agent-config-buttons {
              padding: 8px 12px !important;
              margin: 0 -12px !important;
            }
          }
          
          @media (max-width: 360px) {
            .responsive-button {
              font-size: 10px !important;
              padding: 2px 4px !important;
              height: 22px !important;
              min-width: 40px !important;
              max-width: 80px !important;
            }
            .responsive-button .anticon {
              font-size: 10px !important;
              margin-right: 1px !important;
            }
            .agent-config-buttons .flex {
              gap: 3px !important;
            }
          }
          
          @media (min-width: 769px) {
            .responsive-button {
              font-size: 14px !important;
              padding: 6px 15px !important;
              height: 32px !important;
            }
          }
        `}</style>
        
        <div className="content-scroll h-full overflow-y-auto agent-config-content" style={{ 
          height: 'calc(min(calc(60vh - 120px), 450px) - 2px)',
          minHeight: 'calc(min(calc(40vh - 120px), 280px) - 2px)'
        }}>
          <div key={`${activeSegment}-${renderKey}`}>
            {renderContent()}
          </div>
        </div>
      </div>
      
      {/* Action Buttons - Fixed at bottom */}
      <div className="flex justify-center mt-4 flex-shrink-0 pt-4 border-t border-gray-200 bg-white agent-config-buttons">
        <div className="flex gap-2 lg:gap-3 flex-wrap justify-center">
          {/* Debug Button - Always show */}
          <Button
            type="primary"
            size="middle"
            icon={<BugOutlined />}
            onClick={onDebug}
            className="bg-blue-500 hover:bg-blue-600 border-blue-500 hover:border-blue-600 responsive-button"
            title={t('systemPrompt.button.debug')}
          >
            {t('systemPrompt.button.debug')}
          </Button>
          
          {/* Export and Delete Buttons - Only show when editing existing agent */}
          {isEditingMode && editingAgent && editingAgent.id && onExportAgent && !isCreatingNewAgent && (
            <>
              <Button
                type="primary"
                size="middle"
                icon={<UploadOutlined />}
                onClick={onExportAgent}
                className="bg-green-500 hover:bg-green-600 border-green-500 hover:border-green-600 responsive-button"
                title={t('agent.contextMenu.export')}
              >
                {t('agent.contextMenu.export')}
              </Button>
              
              <Button
                type="primary"
                size="middle"
                icon={<DeleteOutlined />}
                onClick={onDeleteAgent}
                className="bg-red-500 hover:bg-red-600 border-red-500 hover:border-red-600 responsive-button"
                title={t('agent.contextMenu.delete')}
              >
                {t('agent.contextMenu.delete')}
              </Button>
            </>
          )}
          
          {/* Save Button - Different logic for new agent vs existing agent */}
          {isCreatingNewAgent ? (
            <Button
              type="primary"
              size="middle"
              icon={<SaveOutlined />}
              onClick={onSaveAgent}
              disabled={!canSaveAgent}
              className="bg-green-500 hover:bg-green-600 border-green-500 hover:border-green-600 disabled:opacity-50 disabled:cursor-not-allowed responsive-button"
              title={t('businessLogic.config.button.saveToAgentPool')}
            >
              {isSavingAgent ? t('businessLogic.config.button.saving') : t('businessLogic.config.button.saveToAgentPool')}
            </Button>
          ) : (
            <Button
              type="primary"
              size="middle"
              icon={<SaveOutlined />}
              onClick={onSavePrompt}
              disabled={!agentId || !isEditingMode || !editingAgent?.id}
              className="bg-green-500 hover:bg-green-600 border-green-500 hover:border-green-600 disabled:opacity-50 disabled:cursor-not-allowed responsive-button"
              title={t('systemPrompt.button.save')}
            >
              {t('systemPrompt.button.save')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
} 