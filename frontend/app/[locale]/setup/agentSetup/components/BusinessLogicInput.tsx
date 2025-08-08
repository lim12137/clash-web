"use client"

import { Input } from 'antd'
import { useTranslation } from 'react-i18next'

const { TextArea } = Input

interface BusinessLogicInputProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Business Logic Input Component
 */
export default function BusinessLogicInput({ 
  value, 
  onChange
}: BusinessLogicInputProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
          3
        </div>
        <h2 className="text-lg font-medium">{t('businessLogic.title')}</h2>
      </div>
      <div className="flex-1 flex flex-col">
        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('businessLogic.placeholder')}
          className="w-full h-full resize-none p-3 text-base"
          style={{ height: '80px' }}
          autoSize={false}
        />
      </div>
    </div>
  )
} 