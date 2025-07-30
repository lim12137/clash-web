"use client"

import { InfoCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

export default function NonEditingOverlay() {
  const { t } = useTranslation('common')

  return (
    <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-10">
      <div className="text-center space-y-4">
        <InfoCircleOutlined className="text-6xl text-gray-400" />
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {t('systemPrompt.nonEditing.title')}
          </h3>
          <p className="text-sm text-gray-500">
            {t('systemPrompt.nonEditing.subtitle')}
          </p>
        </div>
      </div>
    </div>
  )
} 