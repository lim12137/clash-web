"use client"

import { Modal, Button } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import AdditionalRequestInput from './AdditionalRequestInput'
import { SimplePromptEditor } from './PromptManager'

export interface FineTuneModalProps {
  open: boolean;
  onClose: () => void;
  onSendRequest: (request: string) => Promise<void>;
  isTuning: boolean;
  tunedPrompt: string;
  onSaveTunedPrompt: () => Promise<void>;
}

export default function FineTuneModal({
  open,
  onClose,
  onSendRequest,
  isTuning,
  tunedPrompt,
  onSaveTunedPrompt
}: FineTuneModalProps) {
  const { t } = useTranslation('common')

  return (
    <Modal
      title={t('systemPrompt.modal.title')}
      open={open}
      onCancel={() => {
        onClose()
      }}
      footer={null}
      width={800}
      style={{ top: 20 }}
    >
      <div className="flex flex-col">
        <AdditionalRequestInput 
          onSend={onSendRequest} 
          isTuning={isTuning}
        />

        {tunedPrompt && !isTuning && (
          <div className="mt-4">
            <div className="font-medium text-gray-700 mb-2">{t('systemPrompt.modal.result')}</div>
            <div className="border border-gray-200 rounded-md" style={{ height: '400px', overflowY: 'auto' }}>
              <SimplePromptEditor
                value={tunedPrompt}
                onChange={() => {}}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="text"
                size="small"
                icon={<SaveOutlined />}
                onClick={onSaveTunedPrompt}
                className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                title={t('systemPrompt.modal.button.save')}
              >
                {t('systemPrompt.modal.button.save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
} 