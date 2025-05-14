"use client"

import { useState, useEffect } from 'react'
import { Modal, Input, Switch, Select, InputNumber } from 'antd'
import { Tool, ToolParam } from '../ConstInterface'
import { ScrollArea } from '@/components/ui/scrollArea'

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

  const renderParamInput = (param: ToolParam, index: number) => {
    switch (param.type) {
      case 'string':
        return (
          <Input
            value={param.value as string}
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
      case 'object':
        return (
          <Input.TextArea
            value={typeof param.value === 'object' ? JSON.stringify(param.value, null, 2) : param.value as string}
            onChange={(e) => {
              try {
                const value = JSON.parse(e.target.value);
                handleParamChange(index, value);
              } catch {
                handleParamChange(index, e.target.value);
              }
            }}
            placeholder="请输入JSON对象"
            rows={4}
          />
        );
      default:
        return <Input value={param.value as string} onChange={(e) => handleParamChange(index, e.target.value)} />;
    }
  };

  if (!tool) return null;

  return (
    <Modal
      title={`配置工具: ${tool.name}`}
      open={isOpen}
      onCancel={onCancel}
      onOk={handleSave}
      width={600}
    >
      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-4">{tool.description}</p>
        <div className="text-sm font-medium mb-2">参数配置</div>
        <ScrollArea className="max-h-[400px] pr-2">
          <div className="space-y-4">
            {currentParams.map((param, index) => (
              <div key={param.name} className="border-b pb-4 last:border-b-0">
                <div className="flex items-center mb-2">
                  <div className="font-medium">{param.name}</div>
                  {param.required && <span className="text-red-500 ml-1">*</span>}
                </div>
                {renderParamInput(param, index)}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Modal>
  );
} 