"use client"

import { Button } from 'antd'
import { BugOutlined, UploadOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

export interface ActionButtonsSectionProps {
  onDebug?: () => void;
  onExportAgent?: () => void;
  onDeleteAgent?: () => void;
  onSaveAgent?: () => void;
  isCreatingNewAgent?: boolean;
  isEditingMode?: boolean;
  editingAgent?: any;
  canSaveAgent?: boolean;
  isSavingAgent?: boolean;
  getButtonTitle?: () => string;
}

export default function ActionButtonsSection({
  onDebug,
  onExportAgent,
  onDeleteAgent,
  onSaveAgent,
  isCreatingNewAgent,
  isEditingMode,
  editingAgent,
  canSaveAgent,
  isSavingAgent,
  getButtonTitle
}: ActionButtonsSectionProps) {
  const { t } = useTranslation('common')

  return (
    <div className="border-t pt-3 pb-2">
      <div className="flex gap-3 justify-center flex-wrap">
        {/* Debug Button - Always show */}
        <Button
          type="text"
          size="small"
          icon={<BugOutlined />}
          onClick={onDebug}
          className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
          title={t('systemPrompt.button.debug')}
        >
          {t('systemPrompt.button.debug')}
        </Button>
        
        {/* Export and Delete Buttons - Only show when editing existing agent */}
        {isEditingMode && editingAgent && onExportAgent && !isCreatingNewAgent && (
          <>
            <Button
              type="text"
              size="small"
              icon={<UploadOutlined />}
              onClick={onExportAgent}
              className="text-green-500 hover:text-green-600 hover:bg-green-50"
              title={t('agent.contextMenu.export')}
            >
              {t('agent.contextMenu.export')}
            </Button>
            
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={onDeleteAgent}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              title={t('agent.contextMenu.delete')}
            >
              {t('agent.contextMenu.delete')}
            </Button>
          </>
        )}
        
        {/* Save Button - Only show when creating new agent */}
        {isCreatingNewAgent && (
          <Button
            type="text"
            size="small"
            icon={<SaveOutlined />}
            onClick={onSaveAgent}
            disabled={!canSaveAgent}
            title={(() => {
              if (!canSaveAgent && getButtonTitle) {
                const tooltipText = getButtonTitle();
                return tooltipText || t('businessLogic.config.button.saveToAgentPool');
              }
              return t('businessLogic.config.button.saveToAgentPool');
            })()}
            className="text-green-500 hover:text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingAgent ? t('businessLogic.config.button.saving') : t('businessLogic.config.button.saveToAgentPool')}
          </Button>
        )}
      </div>
    </div>
  )
} 