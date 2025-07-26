"use client"

import { Input, Switch, Typography } from 'antd'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const { Text } = Typography
const { TextArea } = Input

// add variable name specification regular expression
const VARIABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface AgentInfoInputProps {
  name: string;
  description: string;
  provideSummary: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onProvideSummaryChange: (provideSummary: boolean) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function AgentInfoInput({
  name,
  description,
  provideSummary,
  onNameChange,
  onDescriptionChange,
  onProvideSummaryChange,
  onValidationChange
}: AgentInfoInputProps) {
  const [nameError, setNameError] = useState<string>('');
  const [descriptionError, setDescriptionError] = useState<string>('');
  const { t } = useTranslation('common');

  // validation functions
  const validateName = (name: string): { isValid: boolean; message: string } => {
    if (!name.trim()) {
      return { isValid: false, message: t('agent.info.name.error.empty') };
    }
    if (!VARIABLE_NAME_REGEX.test(name)) {
      return { 
        isValid: false, 
        message: t('agent.info.name.error.format')
      };
    }
    return { isValid: true, message: '' };
  };

  const validateDescription = (description: string): { isValid: boolean; message: string } => {
    if (!description.trim()) {
      return { isValid: false, message: t('agent.info.description.error.empty') };
    }
    return { isValid: true, message: '' };
  };

  // validate the form
  useEffect(() => {
    const nameValidation = validateName(name);
    const descriptionValidation = validateDescription(description);
    const isValid = nameValidation.isValid && descriptionValidation.isValid;
    onValidationChange(isValid);
  }, [name, description, onValidationChange]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    onNameChange(newName);
    const validation = validateName(newName);
    setNameError(validation.message);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    onDescriptionChange(newDescription);
    const validation = validateDescription(newDescription);
    setDescriptionError(validation.message);
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center mb-4">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
          1
        </div>
        <h2 className="text-lg font-medium">{t('agent.info.title')}</h2>
      </div>
      <div className="flex-1 flex flex-col gap-7 overflow-y-auto pr-2">
        <div>
          <Text className="block mb-2 font-medium">{t('agent.info.name')} *</Text>
          <Input 
            value={name} 
            onChange={handleNameChange}
            placeholder={t('agent.info.name.placeholder')}
            status={nameError ? 'error' : ''}
          />
          {nameError && <Text type="danger" className="text-xs mt-1 block">{t(nameError)}</Text>}
        </div>
        
        <div>
          <Text className="block mb-2 font-medium">{t('agent.info.description')} *</Text>
          <TextArea
            value={description}
            onChange={handleDescriptionChange}
            placeholder={t('agent.info.description.placeholder')}
            rows={4}
            status={descriptionError ? 'error' : ''}
          />
          {descriptionError && <Text type="danger" className="text-xs mt-1 block">{t(descriptionError)}</Text>}
        </div>
        
        <div>
          <Text className="block mb-2 font-medium">{t('agent.info.provideSummary')}</Text>
          <div className="flex items-center gap-2">
            <Switch 
              checked={provideSummary} 
              onChange={onProvideSummaryChange}
            />
            <Text className="text-sm text-gray-600">
              {provideSummary ? t('agent.info.provideSummary.yes') : t('agent.info.provideSummary.no')}
            </Text>
          </div>
          <Text className="text-xs text-gray-500 mt-1 block">
            {t('agent.info.provideSummary.hint')}
          </Text>
        </div>
      </div>
    </div>
  );
} 