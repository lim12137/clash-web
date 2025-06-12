"use client"

import { Input, Switch, Typography } from 'antd'
import { useState, useEffect } from 'react'

const { Text } = Typography
const { TextArea } = Input

// 添加变量命名规范的正则表达式
const VARIABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// 添加验证函数
const validateName = (name: string): { isValid: boolean; message: string } => {
  if (!name.trim()) {
    return { isValid: false, message: '名称不能为空' };
  }
  if (!VARIABLE_NAME_REGEX.test(name)) {
    return { 
      isValid: false, 
      message: '名称只能包含字母、数字和下划线，且必须以字母或下划线开头' 
    };
  }
  return { isValid: true, message: '' };
};

const validateDescription = (description: string): { isValid: boolean; message: string } => {
  if (!description.trim()) {
    return { isValid: false, message: '描述不能为空' };
  }
  return { isValid: true, message: '' };
};

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

  // 校验表单有效性
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
      <h2 className="text-lg font-medium mb-4">Agent信息</h2>
      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-2">
        <div>
          <Text className="block mb-2 font-medium">名称 *</Text>
          <Input 
            value={name} 
            onChange={handleNameChange}
            placeholder="请输入Agent名称"
            status={nameError ? 'error' : ''}
          />
          {nameError && <Text type="danger" className="text-xs mt-1 block">{nameError}</Text>}
        </div>
        
        <div>
          <Text className="block mb-2 font-medium">描述 *</Text>
          <TextArea
            value={description}
            onChange={handleDescriptionChange}
            placeholder="请输入Agent描述"
            rows={4}
            status={descriptionError ? 'error' : ''}
          />
          {descriptionError && <Text type="danger" className="text-xs mt-1 block">{descriptionError}</Text>}
        </div>
        
        <div>
          <Text className="block mb-2 font-medium">提供运行摘要</Text>
          <div className="flex items-center gap-2">
            <Switch 
              checked={provideSummary} 
              onChange={onProvideSummaryChange}
            />
            <Text className="text-sm text-gray-600">
              {provideSummary ? '是' : '否'}
            </Text>
          </div>
          <Text className="text-xs text-gray-500 mt-1 block">
            开启后Agent执行完成时会提供运行摘要
          </Text>
        </div>
      </div>
    </div>
  );
} 