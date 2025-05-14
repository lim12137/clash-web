"use client"

import { useState, useEffect } from 'react'
import { Typography, Input, Button, Switch, Modal, message, Select, InputNumber } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import ToolConfigModal from './components/ToolConfigModal'
import { mockAgents, mockTools } from './mockData'
import { AgentModalProps, Tool, BusinessLogicInputProps, SubAgentPoolProps, ToolPoolProps, BusinessLogicConfigProps, Agent } from './ConstInterface'
import { ScrollArea } from '@/components/ui/scrollArea'

const { Text } = Typography
const { TextArea } = Input

const modelOptions = [
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
];

/**
 * Agent Modal Component
 */
function AgentModal({ 
  isOpen, 
  onCancel, 
  onSave, 
  title, 
  agent, 
  selectedTools, 
  systemPrompt,
  readOnly = false 
}: AgentModalProps) {
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [model, setModel] = useState(agent?.model || "gpt-4-turbo");
  const [maxStep, setMaxStep] = useState(agent?.max_step || 5);
  const [provideSummary, setProvideSummary] = useState<boolean>(agent?.provide_run_summary ?? false);
  const [prompt, setPrompt] = useState(agent?.prompt || systemPrompt || "");
  const [currentTools, setCurrentTools] = useState<Tool[]>(() => {
    if (agent?.tools) {
      return agent.tools;
    }
    return selectedTools.map(tool => ({
      ...tool,
      initParams: tool.initParams.map(param => ({
        ...param,
        value: param.value
      }))
    }));
  });
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);

  useEffect(() => {
    // 当模态框打开或agent/systemPrompt/selectedTools变化时更新状态
    if (isOpen) {
      if (agent) {
        setName(agent.name);
        setDescription(agent.description);
        setModel(agent.model);
        setMaxStep(agent.max_step);
        setProvideSummary(agent.provide_run_summary);
        setPrompt(agent.prompt);
        setCurrentTools(agent.tools);
      } else {
        setName("");
        setDescription("");
        setModel("gpt-4-turbo");
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
  }, [isOpen, agent, systemPrompt, selectedTools]);

  const handleSave = () => {
    const agentData = {
      name,
      description,
      model,
      maxStep,
      provideSummary,
      prompt,
      tools: currentTools
    };
    onSave(agentData.name, agentData.description, agentData.model, agentData.maxStep, agentData.provideSummary, agentData.prompt);
  };

  const showToolModal = (tool: Tool) => {
    setCurrentTool(tool);
    setIsToolModalOpen(true);
  };

  const handleToolSave = (updatedTool: Tool) => {
    const newTools = currentTools.map(t => 
      t.id === updatedTool.id ? updatedTool : t
    );
    setCurrentTools(newTools);
    setIsToolModalOpen(false);
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
                      onClick={() => !readOnly && showToolModal(tool)}
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
      />
    </Modal>
  );
}

/**
 * Business Logic Input Component
 */
function BusinessLogicInput({ value, onChange, selectedAgents, systemPrompt }: BusinessLogicInputProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-medium mb-2">业务描述</h2>
      <div className="flex-1 flex flex-col">
        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请描述您的业务场景和需求..."
          className="w-full h-full resize-none p-3 text-sm"
          style={{ height: '100%' }}
          autoSize={false}
        />
      </div>
    </div>
  )
}

/**
 * Sub Agent Pool Component
 */
function SubAgentPool({ selectedAgents, onSelectAgent, onEditAgent, onCreateNewAgent }: SubAgentPoolProps) {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <h2 className="text-lg font-medium mb-2">Agent</h2>
      <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
        <div className="grid grid-cols-1 gap-3 pr-2">
          <div 
            className="border rounded-md p-3 flex flex-col justify-center items-center cursor-pointer transition-colors duration-200 h-[80px] hover:border-blue-300 hover:bg-blue-50"
            onClick={onCreateNewAgent}
          >
            <div className="flex items-center justify-center h-full text-blue-500">
              <span className="text-lg mr-2">+</span>
              <span className="text-sm">新建Agent</span>
            </div>
          </div>
          
          {mockAgents.map((agent) => (
            <div 
              key={agent.id} 
              className={`border rounded-md p-3 flex flex-col justify-center cursor-pointer transition-colors duration-200 h-[80px] ${
                selectedAgents.some(a => a.id === agent.id) ? 'bg-blue-100 border-blue-400' : 'hover:border-blue-300'
              }`}
              onClick={() => onSelectAgent(
                agent, 
                !selectedAgents.some(a => a.id === agent.id)
              )}
            >
              <div className="flex items-center h-full">
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium text-sm truncate" title={agent.name}>{agent.name}</div>
                  <div 
                    className="text-xs text-gray-500 line-clamp-2" 
                    title={agent.description}
                  >
                    {agent.description}
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAgent(agent);
                  }}
                  className="ml-2 flex-shrink-0 flex items-center justify-center text-gray-500 hover:text-blue-500 bg-transparent"
                  style={{ border: "none", padding: "4px" }}
                >
                  <SettingOutlined style={{ fontSize: '16px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * Tool Pool Component
 */
function ToolPool({ selectedTools, onSelectTool, isCreatingNewAgent }: ToolPoolProps) {
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);

  const showToolModal = (tool: Tool, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTool(tool);
    setIsToolModalOpen(true);
  };

  const handleToolSave = (updatedTool: Tool) => {
    // 更新工具池中的工具配置
    const index = mockTools.findIndex(t => t.id === updatedTool.id);
    if (index !== -1) {
      mockTools[index] = updatedTool;
    }
    setIsToolModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium">工具</h2>
      </div>
      <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
        <div className={`grid ${isCreatingNewAgent ? 'grid-cols-4' : 'grid-cols-2'} gap-3 pr-2`}>
          {mockTools.map((tool) => (
            <div 
              key={tool.id} 
              className={`border rounded-md p-3 flex flex-col justify-center cursor-pointer transition-colors duration-200 h-[80px] ${
                selectedTools.some(t => t.id === tool.id) ? 'bg-blue-100 border-blue-400' : 'hover:border-blue-300'
              }`}
              onClick={(e) => onSelectTool(
                tool, 
                !selectedTools.some(t => t.id === tool.id)
              )}
            >
              <div className="flex items-center h-full">
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium text-sm truncate" title={tool.name}>{tool.name}</div>
                  <div 
                    className="text-xs text-gray-500 line-clamp-2" 
                    title={tool.description}
                  >
                    {tool.description}
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={(e) => showToolModal(tool, e)}
                  className="ml-2 flex-shrink-0 flex items-center justify-center text-gray-500 hover:text-blue-500 bg-transparent"
                  style={{ border: "none", padding: "4px" }}
                >
                  <SettingOutlined style={{ fontSize: '16px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <ToolConfigModal
        isOpen={isToolModalOpen}
        onCancel={() => setIsToolModalOpen(false)}
        onSave={handleToolSave}
        tool={currentTool}
      />
    </div>
  )
}

/**
 * Business Logic Configuration Main Component
 */
export default function BusinessLogicConfig({
  businessLogic,
  setBusinessLogic,
  selectedAgents,
  setSelectedAgents,
  selectedTools,
  setSelectedTools,
  onGenerateSystemPrompt,
  systemPrompt,
  isCreatingNewAgent,
  setIsCreatingNewAgent,
  mainAgentModel,
  setMainAgentModel,
  mainAgentMaxStep,
  setMainAgentMaxStep,
  mainAgentPrompt,
  setMainAgentPrompt
}: BusinessLogicConfigProps) {
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 监听创建新Agent状态变化，并在状态切换时重置配置
  useEffect(() => {
    // 当切换到创建新Agent状态时
    if (isCreatingNewAgent) {
      // 清空已选的Agent和业务描述
      setSelectedAgents([]);
      setBusinessLogic('');
      // 重置工具选择状态
      setSelectedTools([]);
    } else {
      // 从创建Agent状态切换回主Agent配置时
      setBusinessLogic('');
      setSelectedTools([]);
      // 重置主Agent配置
      setMainAgentModel('gpt-4-turbo');
      setMainAgentMaxStep(10);
      setMainAgentPrompt('');
    }
  }, [isCreatingNewAgent, setSelectedAgents, setBusinessLogic, setSelectedTools, setMainAgentModel, setMainAgentMaxStep, setMainAgentPrompt]);

  const handleSaveAsAgent = () => {
    if (systemPrompt.trim()) {
      setIsAgentModalOpen(true);
    }
  };

  const handleSaveNewAgent = (name: string, description: string, model: string, max_step: number, provide_run_summary: boolean, prompt: string) => {
    if (name.trim()) {
      // 创建新的代理，使用独立的工具配置
      const newAgent: Agent = {
        id: `custom_${Date.now()}`, // 生成唯一ID
        name: name,
        description: description || businessLogic.substring(0, 50) + (businessLogic.length > 50 ? "..." : ""),
        model: model,
        max_step: max_step,
        provide_run_summary: provide_run_summary,
        tools: selectedTools.map(tool => ({
          ...tool,
          initParams: tool.initParams.map(param => ({
            ...param,
            value: param.value // 复制默认值
          }))
        })),
        prompt: prompt
      };
      
      // 将新代理添加到mockAgents（实际应用中应该保存到后端）
      mockAgents.unshift(newAgent);
      
      // 关闭弹窗
      setIsAgentModalOpen(false);
      
      // 显示成功消息
      message.success(`Agent:"${name}"创建成功`);
      
      // 保存后重置状态
      setBusinessLogic('');
      setSelectedTools([]);
      setIsCreatingNewAgent(false);
    }
  };

  const handleEditAgent = (agent: Agent) => {
    setCurrentAgent(agent);
    setIsEditModalOpen(true);
  };

  const handleUpdateAgent = (name: string, description: string, model: string, max_step: number, provide_run_summary: boolean, prompt: string) => {
    if (currentAgent && name.trim()) {
      // 更新代理，保持独立的工具配置
      const index = mockAgents.findIndex(a => a.id === currentAgent.id);
      if (index !== -1) {
        mockAgents[index] = {
          ...currentAgent,
          name,
          description,
          model,
          max_step,
          provide_run_summary,
          tools: currentAgent.tools, // 保持原有的工具配置
          prompt
        };
      }
      
      // 关闭弹窗
      setIsEditModalOpen(false);
      
      // 显示成功消息
      message.success(`子代理"${name}"更新成功`);
    }
  };

  // 在用户取消创建Agent时重置状态
  const handleCancelCreating = () => {
    setIsCreatingNewAgent(false);
    setBusinessLogic('');
    setSelectedTools([]);
    setMainAgentModel('gpt-4-turbo');
    setMainAgentMaxStep(10);
    setMainAgentPrompt('');
  };

  // 处理模态框关闭
  const handleModalClose = () => {
    setIsAgentModalOpen(false);
  };

  const canSaveAsAgent = selectedAgents.length === 0 && systemPrompt.trim().length > 0;
  
  // 根据条件生成更智能的提示信息
  const getButtonTitle = () => {
    if (selectedAgents.length > 0) {
      return "请确保未选择Agent";
    }
    if (systemPrompt.trim().length === 0) {
      return "请先生成系统提示词";
    }
    return "";
  };

  return (
    <div className="flex flex-col h-full w-full gap-0 justify-between">
      {/* 上半部分：Agent池+工具池 */}
      <div className="flex gap-4 flex-1 min-h-0 pb-4 pr-4 pl-4">
        <div className={`w-[360px] h-full ${isCreatingNewAgent ? 'hidden' : ''}`}>
          <SubAgentPool
            selectedAgents={selectedAgents}
            onSelectAgent={(agent, isSelected) => {
              if (isSelected) {
                setSelectedAgents([...selectedAgents, agent]);
              } else {
                setSelectedAgents(selectedAgents.filter((a) => a.id !== agent.id));
              }
            }}
            onEditAgent={handleEditAgent}
            onCreateNewAgent={() => setIsCreatingNewAgent(true)}
          />
        </div>
        <div className={`${isCreatingNewAgent ? 'w-full' : 'flex-1'} h-full`}>
          <ToolPool
            selectedTools={selectedTools}
            onSelectTool={(tool, isSelected) => {
              if (isSelected) {
                setSelectedTools([...selectedTools, tool]);
              } else {
                setSelectedTools(selectedTools.filter((t) => t.id !== tool.id));
              }
            }}
            isCreatingNewAgent={isCreatingNewAgent}
          />
        </div>
      </div>
      {/* 下半部分：业务逻辑描述 */}
      <div className="flex gap-4 h-[240px] pb-4 pr-4 pl-4">
        <div className="flex-1 h-full">
          <BusinessLogicInput 
            value={businessLogic} 
            onChange={setBusinessLogic} 
            selectedAgents={selectedAgents}
            systemPrompt={systemPrompt}
          />
        </div>
        <div className="w-[280px] h-[200px] flex flex-col">
          <div className="flex flex-col gap-5 flex-1">
            <div>
              <span className="block text-lg font-medium mb-2">模型</span>
              <Select
                value={mainAgentModel}
                onChange={setMainAgentModel}
                className="w-full"
                options={modelOptions}
              />
            </div>
            <div>
              <span className="block text-lg font-medium mb-2">最大步骤数</span>
              <InputNumber
                min={1}
                max={50}
                value={mainAgentMaxStep}
                onChange={v => setMainAgentMaxStep(v ?? 10)}
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2 w-full mt-2">
              {isCreatingNewAgent && (
                <>
                  <button
                    onClick={handleCancelCreating}
                    className="px-4 py-1.5 rounded-md flex items-center justify-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
                    style={{ border: "none" }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveAsAgent}
                    disabled={!canSaveAsAgent}
                    title={getButtonTitle()}
                    className="px-4 py-1.5 rounded-md flex items-center justify-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ border: "none" }}
                  >
                    保存到Agent仓库
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 新增Agent弹窗 */}
      <AgentModal 
        isOpen={isAgentModalOpen}
        onCancel={handleModalClose}
        onSave={(name, description, model, max_step, provide_run_summary, prompt) => {
          handleSaveNewAgent(name, description, model, max_step, provide_run_summary, prompt);
        }}
        title="保存到Agent仓库"
        selectedTools={selectedTools}
        systemPrompt={systemPrompt}
      />

      {/* 编辑Agent弹窗 */}
      <AgentModal 
        isOpen={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onSave={handleUpdateAgent}
        title="配置Agent"
        agent={currentAgent}
        selectedTools={selectedTools}
        readOnly={false}
      />
    </div>
  )
} 