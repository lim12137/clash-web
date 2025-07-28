"use client"

import { Select, InputNumber } from 'antd'
import { useTranslation } from 'react-i18next'
import { OpenAIModel } from '../ConstInterface'

interface ModelConfigPanelProps {
  mainAgentModel: OpenAIModel;
  mainAgentMaxStep: number;
  onModelChange: (value: OpenAIModel) => void;
  onMaxStepChange: (value: number | null) => void;
}

const ModelOptions = () => {
  const { t } = useTranslation('common');
  return [
    { label: t('model.option.main'), value: OpenAIModel.MainModel },
    { label: t('model.option.sub'), value: OpenAIModel.SubModel },
  ]
}

/**
 * Model Configuration Panel Component
 */
export default function ModelConfigPanel({
  mainAgentModel,
  mainAgentMaxStep,
  onModelChange,
  onMaxStepChange
}: ModelConfigPanelProps) {
  const { t } = useTranslation('common');

  return (
    <div className="w-[280px] flex flex-col self-start">
      <div className="flex flex-col gap-5 flex-1">
        <div>
          <span className="block text-lg font-medium mb-2">{t('businessLogic.config.model')}</span>
          <Select
            value={mainAgentModel}
            onChange={onModelChange}
            className="w-full"
            options={ModelOptions()}
          />
        </div>
        <div>
          <span className="block text-lg font-medium mb-2">{t('businessLogic.config.maxSteps')}</span>
          <InputNumber
            min={1}
            max={20}
            value={mainAgentMaxStep}
            onChange={onMaxStepChange}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
} 