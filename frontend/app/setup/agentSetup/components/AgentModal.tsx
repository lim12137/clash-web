"use client"

import { useState, useEffect } from 'react'
import { Typography, Input, Button, Switch, Modal, message, Select } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { ScrollArea } from '@/components/ui/scrollArea'
import ToolConfigModal from './ToolConfigModal'
import { AgentModalProps, Tool, OpenAIModel, Agent } from '../ConstInterface'
import { handleToolSelectCommon } from '../utils/toolUtils'
import { updateAgent } from '@/services/agentConfigService'

const { Text } = Typography
const { TextArea } = Input

const modelOptions = [
  { label: '主模型', value: OpenAIModel.MainModel },
  { label: '副模型', value: OpenAIModel.SubModel },
];

export default function AgentModal({ 
  isOpen, 
  onCancel, 
  onSave, 
  onRefresh,
  title, 
  agent, 
  selectedTools, 
  systemPrompt,
  readOnly = false,
  agentId
}: AgentModalProps) {
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [model, setModel] = useState(agent?.model || OpenAIModel.MainModel);
  const [maxStep, setMaxStep] = useState(agent?.max_step || 10);
  const [provideSummary, setProvideSummary] = useState(agent?.provide_run_summary ?? true);
  const [prompt, setPrompt] = useState(agent?.prompt || systemPrompt || "");
  const [currentTools, setCurrentTools] = useState<Tool[]>([]);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  const [pendingToolSelection, setPendingToolSelection] = useState<{tool: Tool, isSelected: boolean} | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (agent) {
        // 编辑模式：先设置基本信息
        setName(agent.name);
        setDescription(agent.description);
        setModel(agent.model);
        setMaxStep(agent.max_step);
        setProvideSummary(agent.provide_run_summary);
        setPrompt(agent.prompt);

        // 直接使用 agent 中的工具配置
        const fetchToolConfigs = () => {
          setCurrentTools(agent.tools);
        };

        fetchToolConfigs();
      } else {
        // 创建模式：使用传入的 selectedTools
        setName("");
        setDescription("");
        setModel(OpenAIModel.MainModel);
        setMaxStep(10);
        setProvideSummary(true);
        setPrompt(systemPrompt || "");
        setCurrentTools(selectedTools.map(tool => ({
          ...tool,
          initParams: tool.initParams.map(param => ({
            ...param,
            value: param.value
          }))
        })));
      }
    }
  }, [isOpen, agent, systemPrompt, selectedTools, agentId]);

  const handleSave = async () => {
    if (!agentId) {
      message.error('Agent ID 不存在');
      return;
    }

    try {
      const result = await updateAgent(
        parseInt(agentId),
        name,
        description,
        model,
        maxStep,
        provideSummary,
        prompt
      );

      if (result.success) {
        message.success('保存成功');
        onSave(name, description, model, maxStep, provideSummary, prompt);
        onRefresh?.();
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      console.error('保存 Agent 失败:', error);
      message.error('保存失败，请稍后重试');
    }
  };

  const handleToolSelect = async (tool: Tool, isSelected: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { shouldProceed, params } = await handleToolSelectCommon(
      tool,
      isSelected,
      agentId,
      (tool, isSelected) => {
        setCurrentTools(prevTools => {
          if (isSelected) {
            return [...prevTools, tool];
          } else {
            return prevTools.filter(t => t.id !== tool.id);
          }
        });
      }
    );

    if (!shouldProceed && params) {
      // 确保使用从后端获取的参数值
      const updatedTool = {
        ...tool,
        initParams: tool.initParams.map(param => {
          // 如果后端返回了参数值，优先使用后端值
          // 如果后端没有返回该参数值，则使用默认值
          const paramValue = params[param.name] !== undefined ? params[param.name] : param.value;
          return {
            ...param,
            value: paramValue
          };
        })
      };
      
      console.log('Tool params from backend:', params);
      console.log('Updated tool with params:', updatedTool);
      
      setCurrentTool(updatedTool);
      setPendingToolSelection({ tool: updatedTool, isSelected });
      setIsToolModalOpen(true);
    }
  };

  const handleToolSave = (updatedTool: Tool) => {
    // if there is pending tool selection, check required fields
    if (pendingToolSelection) {
      const { tool, isSelected } = pendingToolSelection;
      const missingRequiredFields = updatedTool.initParams
        .filter(param => param.required && (param.value === undefined || param.value === '' || param.value === null))
        .map(param => param.name);

      if (missingRequiredFields.length > 0) {
        message.error(`以下必填字段未填写: ${missingRequiredFields.join(', ')}`);
        return;
      }

      // all required fields are filled, continue to enable tool
      // create a mock click event
      const mockEvent = {
        stopPropagation: () => {},
        preventDefault: () => {},
        nativeEvent: new MouseEvent('click'),
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist: () => {}
      } as React.MouseEvent;
      
      handleToolSelect(updatedTool, isSelected, mockEvent);
    }
    
    setIsToolModalOpen(false);
    setPendingToolSelection(null);
  };

  // 修改 handleConfigClick 函数，确保在点击配置按钮时也获取最新参数
  const handleConfigClick = async (tool: Tool) => {
    try {
      // 获取工具的最新配置
      const { shouldProceed, params } = await handleToolSelectCommon(
        tool,
        true, // 假设工具是启用的
        agentId,
        () => {} // 不需要更新工具列表
      );

      if (params) {
        const updatedTool = {
          ...tool,
          initParams: tool.initParams.map(param => {
            const paramValue = params[param.name] !== undefined ? params[param.name] : param.value;
            return {
              ...param,
              value: paramValue
            };
          })
        };
        
        console.log('Tool params from backend (config click):', params);
        console.log('Updated tool with params (config click):', updatedTool);
        
        setCurrentTool(updatedTool);
      } else {
        setCurrentTool(tool);
      }
    } catch (error) {
      console.error('获取工具配置失败:', error);
      message.error('获取工具配置失败，使用默认配置');
      setCurrentTool(tool);
    }
    setIsToolModalOpen(true);
  };

  return (
    <Modal
      title={title}
      open={isOpen}
      onCancel={onCancel}
      footer={readOnly ? (
        <div className="flex justify-end gap-2">
          <button 
            key="cancel" 
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md flex items-center justify-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            关闭
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button 
            key="cancel" 
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md flex items-center justify-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            取消
          </button>
          <button 
            key="submit" 
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-1.5 rounded-md flex items-center justify-center text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: "none" }}
          >
            保存
          </button>
        </div>
      )}
      width={700}
    >
      <ScrollArea className="max-h-[70vh]">
        <div className="flex flex-col gap-4 pr-2">
          <div>
            <Text>名称</Text>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入代理名称"
              disabled={readOnly}
            />
          </div>
          <div>
            <Text>描述</Text>
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入代理描述"
              rows={3}
              disabled={readOnly}
            />
          </div>
          
          <div>
            <Text>模型</Text>
            <div className={readOnly ? 'opacity-70' : ''}>
              <select 
                className="w-full border rounded-md p-2"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={readOnly}
              >
                {modelOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <Text>最大步骤数</Text>
              <Input 
                type="number" 
                min={1} 
                max={50}
                value={maxStep} 
                onChange={(e) => setMaxStep(parseInt(e.target.value) || 10)}
                disabled={readOnly}
              />
            </div>
            <div className="flex-1">
              <Text>是否提供运行摘要</Text>
              <div className="mt-2">
                <Switch 
                  checked={provideSummary} 
                  onChange={(checked) => setProvideSummary(checked)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
          
          {/* Tools Used */}
          <div>
            <Text>使用的工具</Text>
            <div className="border rounded-md p-3 bg-gray-50 min-h-[80px] text-sm">
              {currentTools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {currentTools.map(tool => (
                    <div 
                      key={tool.id} 
                      className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs flex items-center cursor-pointer hover:bg-blue-200"
                      onClick={() => !readOnly && handleConfigClick(tool)}
                    >
                      {tool.name}
                    </div>
                  ))}
                </div>
              ) : (
                <Text className="text-gray-400">未选择任何工具</Text>
              )}
            </div>
          </div>
          
          {/* System Prompt */}
          <div>
            <Text>系统提示词</Text>
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入系统提示词"
              rows={6}
              disabled={readOnly}
              className="w-full"
            />
          </div>
        </div>
      </ScrollArea>

      <ToolConfigModal
        isOpen={isToolModalOpen}
        onCancel={() => setIsToolModalOpen(false)}
        onSave={handleToolSave}
        tool={currentTool}
        mainAgentId={parseInt(agentId || '0')}
        selectedTools={currentTools}
      />
    </Modal>
  );
} 