"use client"

import { Input, message } from 'antd'
import { ThunderboltOutlined, LoadingOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

const { TextArea } = Input

export interface BusinessLogicSectionProps {
  businessLogic: string;
  onBusinessLogicChange?: (value: string) => void;
  onGenerateAgent?: () => void;
  isGeneratingAgent?: boolean;
  isSavingAgent?: boolean;
  isEditingMode?: boolean;
}

export default function BusinessLogicSection({
  businessLogic,
  onBusinessLogicChange,
  onGenerateAgent,
  isGeneratingAgent,
  isSavingAgent,
  isEditingMode = false
}: BusinessLogicSectionProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Business Logic Header */}
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
            3
          </div>
          <h2 className="text-lg font-medium">{t('businessLogic.title')}</h2>
        </div>
      </div>
      
      {/* Business Logic Content */}
      <div className="border-t pt-2 pb-2">
        <div className="relative">
          <TextArea
            value={businessLogic}
            onChange={(e) => onBusinessLogicChange?.(e.target.value)}
            placeholder={t('businessLogic.placeholder')}
            className="w-full resize-none p-3 text-base pr-20"
            style={{ minHeight: '120px' }}
            autoSize={false}
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
    </div>
  )
} 