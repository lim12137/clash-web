"use client"

import { useState, useEffect } from 'react'
import { Typography, Input, Button, Switch, Modal, message } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import ToolConfigModal from './components/ToolConfigModal'
import { mockAgents, mockTools } from './mockData'
import { AgentModalProps, Tool, BusinessLogicInputProps, SubAgentPoolProps, ToolPoolProps, BusinessLogicConfigProps, Agent } from './ConstInterface'

const { Text } = Typography
const { TextArea } = Input

/**
 * Agent弹窗组件
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
  }, [agent, systemPrompt, selectedTools]);

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

  const modelOptions = [
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4-1106-preview', value: 'gpt-4-1106-preview' },
    { label: 'GPT-4-0125-preview', value: 'gpt-4-0125-preview' },
    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
    { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
    { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
  ];

  return (
    <Modal
      title={title}
      open={isOpen}
      onCancel={onCancel}
      footer={readOnly ? [
        <Button key="cancel" onClick={onCancel}>
          关闭
        </Button>
      ] : [
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          onClick={handleSave}
          disabled={!name.trim()}
        >
          保存
        </Button>,
      ]}
      width={700}
    >
      <div className="flex flex-col gap-4">
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
        
        {/* 显示使用的工具 */}
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
        
        {/* 显示系统提示词 */}
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
 * 业务逻辑输入组件
 */
function BusinessLogicInput({ value, onChange, onGenerate, selectedAgents, onSaveAsAgent, systemPrompt }: BusinessLogicInputProps) {
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
    <div className="flex flex-col p-4 h-[40%]">
      <h2 className="text-lg font-medium mb-2">业务逻辑描述</h2>
      <div className="flex flex-col flex-1">
        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请描述您的业务场景和需求..."
          className="w-full resize-none p-3 text-sm flex-1"
          rows={5}
        />
        <div className="flex justify-between gap-2 mt-2">
          <Button
            onClick={onSaveAsAgent}
            disabled={!canSaveAsAgent}
            title={getButtonTitle()}
            className="flex-1"
          >
            保存到Agent池
          </Button>
          <Button 
            type="primary" 
            onClick={onGenerate}
            className="flex-1"
          >
            生成系统提示词
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * 子代理池组件
 */
function SubAgentPool({ selectedAgents, onSelectAgent, onEditAgent }: SubAgentPoolProps) {
  return (
    <div className="flex flex-col p-4 overflow-hidden h-[30%]">
      <h2 className="text-lg font-medium mb-2">Agent池</h2>
      <div className="grid grid-cols-2 gap-1 overflow-y-auto custom-scrollbar h-[200px] border-t pt-2 pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 shadow-[inset_0_5px_5px_-5px_rgba(0,0,0,0.2)]">
        {mockAgents.map((agent) => (
          <div 
            key={agent.id} 
            className={`border rounded-md p-3 flex flex-col cursor-pointer transition-colors duration-200 ${
              selectedAgents.some(a => a.id === agent.id) ? 'bg-blue-100 border-blue-400' : 'hover:border-blue-300'
            }`}
            onClick={() => onSelectAgent(
              agent, 
              !selectedAgents.some(a => a.id === agent.id)
            )}
          >
            <div className="flex justify-between items-center">
              <div className="w-full overflow-hidden">
                <div className="font-medium truncate" title={agent.name}>{agent.name}</div>
                <div 
                  className="text-xs text-gray-500 line-clamp-3" 
                  title={agent.description}
                  style={{ minHeight: '48px' }}
                >
                  {agent.description}
                </div>
              </div>
              <Button 
                type="text" 
                icon={<SettingOutlined style={{ fontSize: '18px' }} />} 
                size="middle"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditAgent(agent);
                }}
                className="text-gray-500 hover:text-blue-500 flex items-center justify-center ml-2 flex-shrink-0"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 工具池组件
 */
function ToolPool({ selectedTools, onSelectTool }: ToolPoolProps) {
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
    <div className="flex flex-col p-4 overflow-hidden h-[30%]">
      <h2 className="text-lg font-medium mb-2">工具池</h2>
      <div className="grid grid-cols-3 gap-2 overflow-y-auto custom-scrollbar h-[200px] border-t pt-2 pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 shadow-[inset_0_5px_5px_-5px_rgba(0,0,0,0.2)]">
        {mockTools.map((tool) => (
          <div 
            key={tool.id} 
            className={`border rounded-md p-2 flex flex-col cursor-pointer transition-colors duration-200 ${
              selectedTools.some(t => t.id === tool.id) ? 'bg-blue-100 border-blue-400' : 'hover:border-blue-300'
            }`}
            onClick={(e) => onSelectTool(
              tool, 
              !selectedTools.some(t => t.id === tool.id)
            )}
          >
            <div className="flex justify-between items-center">
              <div className="w-full overflow-hidden">
                <div className="font-medium text-sm truncate" title={tool.name}>{tool.name}</div>
                <div 
                  className="text-xs text-gray-500 line-clamp-2" 
                  title={tool.description}
                  style={{ minHeight: '32px' }}
                >
                  {tool.description}
                </div>
              </div>
              <Button 
                type="text" 
                icon={<SettingOutlined style={{ fontSize: '16px' }} />} 
                size="small"
                onClick={(e) => showToolModal(tool, e)}
                className="text-gray-500 hover:text-blue-500 flex items-center justify-center ml-2 flex-shrink-0"
              />
            </div>
          </div>
        ))}
      </div>

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
 * 业务逻辑配置主组件
 */
export default function BusinessLogicConfig({
  businessLogic,
  setBusinessLogic,
  selectedAgents,
  setSelectedAgents,
  selectedTools,
  setSelectedTools,
  onGenerateSystemPrompt,
  systemPrompt
}: BusinessLogicConfigProps) {
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  return (
    <div className="flex flex-col w-full gap-2 overflow-hidden mt-[-16px]">
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
      />
      <ToolPool
        selectedTools={selectedTools}
        onSelectTool={(tool, isSelected) => {
          if (isSelected) {
            setSelectedTools([...selectedTools, tool]);
          } else {
            setSelectedTools(selectedTools.filter((t) => t.id !== tool.id));
          }
        }}
      />
      <BusinessLogicInput 
        value={businessLogic} 
        onChange={setBusinessLogic} 
        onGenerate={onGenerateSystemPrompt}
        selectedAgents={selectedAgents}
        onSaveAsAgent={handleSaveAsAgent}
        systemPrompt={systemPrompt}
      />
      
      {/* 新增Agent弹窗 */}
      <AgentModal 
        isOpen={isAgentModalOpen}
        onCancel={() => setIsAgentModalOpen(false)}
        onSave={handleSaveNewAgent}
        title="保存到Agent池"
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