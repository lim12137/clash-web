"use client"

import { InfoCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

export default function NonEditingOverlay() {
  const { t } = useTranslation('common')

  return (
    <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50 transition-all duration-300 ease-out animate-in fade-in-0">
      <div className="text-center space-y-4 animate-in fade-in-50 duration-400 delay-50">
        <InfoCircleOutlined className="text-6xl text-gray-400 transition-all duration-300 animate-in zoom-in-75 delay-100" />
        <div className="animate-in slide-in-from-bottom-2 duration-300 delay-150">
          <h3 className="text-lg font-medium text-gray-700 mb-2 transition-all duration-300">
            {t('systemPrompt.nonEditing.title')}
          </h3>
          <p className="text-sm text-gray-500 transition-all duration-300">
            {t('systemPrompt.nonEditing.subtitle')}
          </p>
        </div>
      </div>
    </div>
  )
} 