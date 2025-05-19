"use client"

import { useState, useEffect } from 'react'
import { Modal, Input, Switch, Select, InputNumber, Tag } from 'antd'
import { Tool, ToolParam, OpenAIModel } from '../ConstInterface'


interface ToolConfigModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onSave: (tool: Tool) => void;
  tool: Tool | null;
}

export default function ToolConfigModal({ isOpen, onCancel, onSave, tool }: ToolConfigModalProps) {
  const [currentParams, setCurrentParams] = useState<ToolParam[]>([]);

  useEffect(() => {
    if (tool) {
      setCurrentParams(tool.initParams.map(param => ({ ...param })));
    } else {
      setCurrentParams([]);
    }
  }, [tool]);

  const handleParamChange = (index: number, value: any) => {
    const newParams = [...currentParams];
    newParams[index] = { ...newParams[index], value };
    setCurrentParams(newParams);
  };

  const handleSave = () => {
    if (tool) {
      onSave({
        ...tool,
        initParams: currentParams
      });
    }
  };

  // Determine the number of text box rows based on the string length, up to 5 rows
  const getTextAreaRows = (value: string): number => {
    if (!value) return 1;
    const length = value.length;
    if (length < 15) return 1;
    if (length < 30) return 2;
    if (length < 45) return 3;
    if (length < 60) return 4;
    return 5;
  };

  const renderParamInput = (param: ToolParam, index: number) => {
    switch (param.type) {
      case 'OpenAIModel':
        return (
          <Select
            value={param.value as string}
            onChange={(value) => handleParamChange(index, value)}
            placeholder="请选择模型"
            style={{ width: '100%' }}
            options={[
              { label: '主模型', value: OpenAIModel.MainModel },
              { label: '副模型', value: OpenAIModel.SubModel }
            ]}
          />
        );
      case 'string':
        const stringValue = param.value as string;
        // If the string length exceeds 15, use TextArea
        if (stringValue && stringValue.length > 15) {
          return (
            <Input.TextArea
              value={stringValue}
              onChange={(e) => handleParamChange(index, e.target.value)}
              placeholder={`请输入${param.name}`}
              rows={getTextAreaRows(stringValue)}
              style={{ resize: 'vertical' }}
            />
          );
        }
        return (
          <Input
            value={stringValue}
            onChange={(e) => handleParamChange(index, e.target.value)}
            placeholder={`请输入${param.name}`}
          />
        );
      case 'number':
        return (
          <InputNumber
            value={param.value as number}
            onChange={(value) => handleParamChange(index, value)}
            className="w-full"
          />
        );
      case 'boolean':
        return (
          <Switch
            checked={param.value as boolean}
            onChange={(checked) => handleParamChange(index, checked)}
          />
        );
      case 'array':
        const arrayValue = Array.isArray(param.value) ? JSON.stringify(param.value, null, 2) : param.value as string;
        return (
          <Input.TextArea
            value={arrayValue}
            onChange={(e) => {
              try {
                const value = JSON.parse(e.target.value);
                handleParamChange(index, value);
              } catch {
                handleParamChange(index, e.target.value);
              }
            }}
            placeholder="请输入JSON数组"
            rows={getTextAreaRows(arrayValue)}
            style={{ resize: 'vertical' }}
          />
        );
      case 'object':
        const objectValue = typeof param.value === 'object' ? JSON.stringify(param.value, null, 2) : param.value as string;
        return (
          <Input.TextArea
            value={objectValue}
            onChange={(e) => {
              try {
                const value = JSON.parse(e.target.value);
                handleParamChange(index, value);
              } catch {
                handleParamChange(index, e.target.value);
              }
            }}
            placeholder="请输入JSON对象"
            rows={getTextAreaRows(objectValue)}
            style={{ resize: 'vertical' }}
          />
        );
      default:
        return <Input value={param.value as string} onChange={(e) => handleParamChange(index, e.target.value)} />;
    }
  };

  if (!tool) return null;

  return (
    <Modal
      title={
        <div className="flex justify-between items-center w-full pr-8">
          <span>{`${tool.name}`}</span>
          <Tag color={tool.source === 'mcp' ? 'blue' : 'green'}>
            {tool.source === 'mcp' ? 'MCP' : '本地工具'}
          </Tag>
        </div>
      }
      open={isOpen}
      onCancel={onCancel}
      onOk={handleSave}
      width={600}
    >
      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-4">{tool.description}</p>
        <div className="text-sm font-medium mb-2">参数配置</div>
        <div style={{ maxHeight: '500px', overflow: 'auto' }}>
          <div className="space-y-4 pr-2">
            {currentParams.map((param, index) => (
              <div key={param.name} className="border-b pb-4 mb-4 last:border-b-0 last:mb-0">
                <div className="flex items-start gap-4">
                  <div className="flex-1 pt-1">
                    {param.description ? (
                      <div className="text-sm text-gray-600">{param.description}{param.required && <span className="text-red-500 ml-1">*</span>}</div>
                    ) : (
                      <div className="text-sm text-gray-600">{param.name}{param.required && <span className="text-red-500 ml-1">*</span>}</div>
                    )}
                  </div>
                  <div className="flex-1">
                    {renderParamInput(param, index)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
} 