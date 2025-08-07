"use client"

import { LoadingOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

interface ActionButtonsProps {
  isPromptGenerating: boolean;
  isPromptSaving: boolean;
  isCreatingNewAgent: boolean;
  canSaveAsAgent: boolean;
  getButtonTitle: () => string;
  onGeneratePrompt: () => void;
  onSaveAsAgent: () => void;
  onCancelCreating: () => void;
}

/**
 * Action Buttons Component
 */
export default function ActionButtons({
  isPromptGenerating,
  isPromptSaving,
  isCreatingNewAgent,
  canSaveAsAgent,
  getButtonTitle,
  onGeneratePrompt,
  onSaveAsAgent,
  onCancelCreating
}: ActionButtonsProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col gap-2 w-full">
      <button
        onClick={onGeneratePrompt}
        disabled={isPromptGenerating || isPromptSaving}
        className="px-3 py-1.5 rounded-md flex items-center justify-center text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed w-full"
        style={{ border: 'none' }}
      >
        {isPromptGenerating ? (
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
      {isCreatingNewAgent && (
        <>
          <button
            onClick={onSaveAsAgent}
            disabled={!canSaveAsAgent}
            title={getButtonTitle()}
            className="px-3 py-1.5 rounded-md flex items-center justify-center text-sm bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed w-full"
            style={{ border: "none" }}
          >
            {isPromptSaving ? t('businessLogic.config.button.saving') : t('businessLogic.config.button.save')}
          </button>
          <button
            onClick={onCancelCreating}
            disabled={isPromptGenerating || isPromptSaving}
            className="px-3 py-1.5 rounded-md flex items-center justify-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed w-full"
            style={{ border: 'none' }}
          >
            {t('businessLogic.config.button.cancel')}
          </button>
        </>
      )}
    </div>
  )
} 