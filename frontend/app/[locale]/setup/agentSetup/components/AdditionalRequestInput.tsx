"use client"

import { useState } from 'react'
import { Input, Button } from 'antd'
import { useTranslation } from 'react-i18next'


// Additional request input component Props interface
export interface AdditionalRequestInputProps {
  onSend: (request: string) => void;
  isTuning?: boolean;
}

/**
 * Additional request input component
 */
export default function AdditionalRequestInput({ onSend, isTuning = false }: AdditionalRequestInputProps) {
  const [request, setRequest] = useState("")
  const { t } = useTranslation('common');

  const handleSend = async () => {
    if (request.trim()) {
      try {
        await onSend(request)
      } catch (error) {
        console.error(t("setup.promptTuning.error.send"), error)
      }
    }
  }
  
  return (
    <div className="flex flex-col items-end">
      <Input.TextArea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder={t('setup.promptTuning.placeholder')}
        onPressEnter={(e) => {
          if (!e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        rows={7}
        style={{ resize: 'none' }}
        disabled={isTuning}
      />
      <Button 
        type="primary" 
        onClick={handleSend} 
        className="mt-2"
        disabled={isTuning || !request.trim()}
        loading={isTuning}
      >
        {isTuning ? t('setup.promptTuning.button.tuning') : t('setup.promptTuning.button.send')}
      </Button>
    </div>
  )
} 