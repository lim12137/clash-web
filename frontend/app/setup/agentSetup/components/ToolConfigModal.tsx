"use client"

import { useState, useEffect } from 'react'
import { Modal, Button, Input, Switch } from 'antd'
import { Tool, ToolParam } from '../ConstInterface'

const { TextArea } = Input

interface ToolConfigModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onSave: (tool: Tool) => void;
  tool: Tool | null;
}

export default function ToolConfigModal({ isOpen, onCancel, onSave, tool }: ToolConfigModalProps) {
  const [initParams, setInitParams] = useState<ToolParam[]>([]);

  useEffect(() => {
    if (tool) {
      setInitParams([...tool.initParams]);
    }
  }, [tool]);

  const updateParamValue = (index: number, value: any) => {
    const newParams = [...initParams];
    newParams[index] = { ...newParams[index], value };
    setInitParams(newParams);
  };

  const renderParamInput = (param: ToolParam, index: number) => {
    switch (param.type) {
      case 'string':
        return (
          <Input 
            value={param.value} 
            onChange={(e) => updateParamValue(index, e.target.value)}
            placeholder={`请输入${param.name}`}
          />
        );
      case 'number':
        return (
          <Input 
            type="number" 
            value={param.value}
            onChange={(e) => updateParamValue(index, Number(e.target.value))}
            placeholder={`请输入${param.name}`}
          />
        );
      case 'boolean':
        return (
          <Switch 
            checked={!!param.value} 
            onChange={(checked) => updateParamValue(index, checked)}
          />
        );
      case 'object':
        return (
          <TextArea
            value={param.value ? JSON.stringify(param.value, null, 2) : ''}
            onChange={(e) => {
              try {
                const value = e.target.value ? JSON.parse(e.target.value) : {};
                updateParamValue(index, value);
              } catch (error) {
                // JSON解析错误时不更新
              }
            }}
            placeholder={`请输入${param.name} (JSON格式)`}
            rows={4}
          />
        );
      case 'array':
        return (
          <TextArea
            value={param.value ? JSON.stringify(param.value, null, 2) : ''}
            onChange={(e) => {
              try {
                const value = e.target.value ? JSON.parse(e.target.value) : [];
                updateParamValue(index, value);
              } catch (error) {
                // JSON解析错误时不更新
              }
            }}
            placeholder={`请输入${param.name} (JSON格式)`}
            rows={4}
          />
        );
      default:
        return <Input value={param.value} readOnly />;
    }
  };

  const handleSave = () => {
    if (tool) {
      onSave({
        ...tool,
        initParams: initParams
      });
    }
  };

  return (
    <Modal
      title="工具配置"
      open={isOpen}
      onCancel={onCancel}
      footer={(
        <div className="flex justify-end gap-2">
          <button 
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md flex items-center justify-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md flex items-center justify-center text-sm bg-blue-500 text-white hover:bg-blue-600"
            style={{ border: "none" }}
          >
            保存
          </button>
        </div>
      )}
      width={700}
    >
      {tool && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <div>
              <div className="text-lg font-medium">{tool.name}</div>
              <div className="text-sm text-gray-500">{tool.description}</div>
            </div>
            <div className="ml-auto">
              <div className={`px-2 py-1 rounded-full text-xs ${
                tool.source === 'local' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {tool.source === 'local' ? '本地工具' : 'MCP工具'}
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-base font-medium mb-3">初始化参数</h3>
            <div className="space-y-4">
              {initParams.map((param, index) => (
                <div key={param.name} className="flex flex-col">
                  <div className="flex items-center mb-1">
                    <div className="font-medium text-sm">{param.name}</div>
                    <div className="text-xs ml-2 px-1.5 py-0.5 rounded bg-gray-100">
                      {param.type}
                    </div>
                    {param.required && (
                      <div className="text-xs ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        必填
                      </div>
                    )}
                  </div>
                  <div>
                    {renderParamInput(param, index)}
                  </div>
                </div>
              ))}
              
              {initParams.length === 0 && (
                <div className="text-gray-500 text-center py-4">
                  该工具没有可配置的参数
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
} 