"use client"

import { useState, useEffect } from 'react'
import { Typography, Input, Button, Switch, Modal, message, Select, InputNumber } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import ToolConfigModal from './components/ToolConfigModal'
import { mockAgents, mockTools } from './mockData'
import { AgentModalProps, Tool, BusinessLogicInputProps, SubAgentPoolProps, ToolPoolProps, BusinessLogicConfigProps, Agent } from './ConstInterface'
import { ScrollArea } from '@/components/ui/scrollArea'
import { getCreatingSubAgentId, fetchAgentList, updateToolConfig, searchToolConfig } from '@/services/agentConfigService'

const { Text } = Typography
const { TextArea } = Input

const modelOptions = [
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
];

// 提取公共的 handleToolSelect 逻辑
const handleToolSelectCommon = async (
  tool: Tool,
  isSelected: boolean,
  mainAgentId: string | null | undefined,
  onSuccess?: (tool: Tool, isSelected: boolean) => void
) => {
  if (!mainAgentId) {
    message.error('主代理ID未设置，无法更新工具状态');
    return { shouldProceed: false, params: {} };
  }

  try {
    // step 1: get tool config from database
    const searchResult = await searchToolConfig(parseInt(tool.id), parseInt(mainAgentId));
    if (!searchResult.success) {
      message.error('获取工具配置失败');
      return { shouldProceed: false, params: {} };
    }

    let params: Record<string, any> = {};

    // use config from database or default config
    if (searchResult.data?.params) {
      params = searchResult.data.params || {};
    } else {
      // if there is no saved config, use default value
      params = (tool.initParams || []).reduce((acc, param) => {
        if (param && param.name) {
          acc[param.name] = param.value;
        }
        return acc;
      }, {} as Record<string, any>);
    }

    // step 2: if the tool is enabled, check required fields
    if (isSelected && tool.initParams && tool.initParams.length > 0) {
      const missingRequiredFields = tool.initParams
        .filter(param => param && param.required && (params[param.name] === undefined || params[param.name] === '' || params[param.name] === null))
        .map(param => param.name);

      if (missingRequiredFields.length > 0) {
        return { shouldProceed: false, params };
      }
    }

    // step 3: if all checks pass, update tool config
    const updateResult = await updateToolConfig(
      parseInt(tool.id),
      parseInt(mainAgentId),
      params,
      isSelected
    );

    if (updateResult.success) {
      if (onSuccess) {
        onSuccess(tool, isSelected);
      }
      message.success(`工具"${tool.name}"${isSelected ? '已启用' : '已禁用'}`);
      return { shouldProceed: true, params };
    } else {
      message.error(updateResult.message || '更新工具状态失败');
      return { shouldProceed: false, params };
    }
  } catch (error) {
    message.error('更新工具状态失败，请稍后重试');
    return { shouldProceed: false, params: {} };
  }
};

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
  readOnly = false,
  mainAgentId
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
  const [pendingToolSelection, setPendingToolSelection] = useState<{tool: Tool, isSelected: boolean} | null>(null);

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

  const handleToolSelect = async (tool: Tool, isSelected: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { shouldProceed, params } = await handleToolSelectCommon(
      tool,
      isSelected,
      mainAgentId,
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
      // if there are required fields not filled, open config modal
      setCurrentTool({
        ...tool,
        initParams: tool.initParams.map(param => ({
          ...param,
          value: params[param.name] || param.value
        }))
      });
      setPendingToolSelection({ tool, isSelected });
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

  // handle tool config button click
  const handleConfigClick = (tool: Tool) => {
    setCurrentTool(tool);
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
        mainAgentId={parseInt(mainAgentId || '0')}
        selectedTools={currentTools}
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
function SubAgentPool({ selectedAgents, onSelectAgent, onEditAgent, onCreateNewAgent, subAgentList = [], loadingAgents = false }: SubAgentPoolProps) {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium">Agent</h2>
        {loadingAgents && <span className="text-sm text-gray-500">加载中...</span>}
      </div>
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
          
          {subAgentList.map((agent) => (
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
function ToolPool({ 
  selectedTools, 
  onSelectTool, 
  isCreatingNewAgent, 
  tools = [], 
  loadingTools = false,
  mainAgentId
}: ToolPoolProps) {
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  const [pendingToolSelection, setPendingToolSelection] = useState<{tool: Tool, isSelected: boolean} | null>(null);

  // 处理工具选中状态变更
  const handleToolSelect = async (tool: Tool, isSelected: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { shouldProceed, params } = await handleToolSelectCommon(
      tool,
      isSelected,
      mainAgentId,
      (tool, isSelected) => onSelectTool(tool, isSelected)
    );

    if (!shouldProceed && params) {
      // 如果有必填字段未填写，打开配置模态框
      setCurrentTool({
        ...tool,
        initParams: tool.initParams.map(param => ({
          ...param,
          value: params[param.name] || param.value
        }))
      });
      setPendingToolSelection({ tool, isSelected });
      setIsToolModalOpen(true);
    }
  };

  // 处理工具配置按钮点击
  const handleConfigClick = (tool: Tool, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTool(tool);
    setIsToolModalOpen(true);
  };

  const handleToolSave = (updatedTool: Tool) => {
    // 如果有待处理的工具选择，检查必填字段
    if (pendingToolSelection) {
      const { tool, isSelected } = pendingToolSelection;
      const missingRequiredFields = updatedTool.initParams
        .filter(param => param.required && (param.value === undefined || param.value === '' || param.value === null))
        .map(param => param.name);

      if (missingRequiredFields.length > 0) {
        message.error(`以下必填字段未填写: ${missingRequiredFields.join(', ')}`);
        return;
      }

      // 所有必填字段都已填写，继续启用工具
      // 创建一个模拟的点击事件
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

  const displayTools = tools.length > 0 ? tools : mockTools;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium">工具</h2>
        {loadingTools && <span className="text-sm text-gray-500">加载中...</span>}
      </div>
      <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
        <div className={`grid ${isCreatingNewAgent ? 'grid-cols-4' : 'grid-cols-2'} gap-3 pr-2`}>
          {displayTools.map((tool) => (
            <div 
              key={tool.id} 
              className={`border rounded-md p-3 flex flex-col justify-center cursor-pointer transition-colors duration-200 h-[80px] ${
                selectedTools.some(t => t.id === tool.id) ? 'bg-blue-100 border-blue-400' : 'hover:border-blue-300'
              }`}
              onClick={(e) => handleToolSelect(
                tool, 
                !selectedTools.some(t => t.id === tool.id),
                e
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
                  onClick={(e) => handleConfigClick(tool, e)}
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
        onCancel={() => {
          setIsToolModalOpen(false);
          setPendingToolSelection(null);
        }}
        onSave={handleToolSave}
        tool={currentTool}
        mainAgentId={parseInt(mainAgentId || '0')}
        selectedTools={selectedTools}
      />
    </div>
  );
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
  setMainAgentPrompt,
  tools,
  loadingTools,
  subAgentList = [],
  loadingAgents = false,
  mainAgentId,
  setMainAgentId
}: BusinessLogicConfigProps) {
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Listen to create new agent status changes, and reset the configuration when the status switches
  useEffect(() => {
    // When switching to the Create New Agent state
    if (isCreatingNewAgent) {
      // Clear the selected agent and business description
      setSelectedAgents([]);
      setBusinessLogic('');
      // Reset tool selection status
      setSelectedTools([]);
    } else {
      // When switching back to the main agent configuration from the Create Agent state
      setBusinessLogic('');
      setSelectedTools([]);
      // Reset Master Agent Configuration
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
      // Create a new agent and configure it with a separate tool
      const newAgent: Agent = {
        id: `custom_${Date.now()}`,
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
      
      // Add a new agent to mockAgents (it should be saved to the back end in practical applications)
      mockAgents.unshift(newAgent);
      
      // Close pop-up window
      setIsAgentModalOpen(false);
      
      // Display success message
      message.success(`Agent:"${name}"创建成功`);
      
      // Reset status after saving
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
      // Update the agent and maintain independent tool configuration
      const index = mockAgents.findIndex(a => a.id === currentAgent.id);
      if (index !== -1) {
        mockAgents[index] = {
          ...currentAgent,
          name,
          description,
          model,
          max_step,
          provide_run_summary,
          tools: currentAgent.tools, // Keep the original tool configuration
          prompt
        };
      }
      
      // Close pop-up window
      setIsEditModalOpen(false);
      
      // Display success message
      message.success(`子代理"${name}"更新成功`);
    }
  };

  // Reset state when user cancels agent creation
  const handleCancelCreating = async () => {
    try {
      const result = await fetchAgentList();
      if (result.success) {
        setMainAgentId(result.data.mainAgentId);
        setIsCreatingNewAgent(false);
        setBusinessLogic('');
        setSelectedTools([]);
        setMainAgentModel('gpt-4-turbo');
        setMainAgentMaxStep(10);
        setMainAgentPrompt('');
      } else {
        message.error(result.message || '重置Agent状态失败');
      }
    } catch (error) {
      console.error('重置Agent状态失败:', error);
      message.error('重置Agent状态失败，请稍后重试');
    }
  };

  // Processing mode box closed
  const handleModalClose = () => {
    setIsAgentModalOpen(false);
  };

  const canSaveAsAgent = selectedAgents.length === 0 && systemPrompt.trim().length > 0;
  
  // Generate more intelligent prompt information according to conditions
  const getButtonTitle = () => {
    if (selectedAgents.length > 0) {
      return "请确保未选择Agent";
    }
    if (systemPrompt.trim().length === 0) {
      return "请先生成系统提示词";
    }
    return "";
  };

  // 处理创建新Agent
  const handleCreateNewAgent = async () => {
    try {
      const result = await getCreatingSubAgentId(mainAgentId);
      if (result.success && result.data) {
        setMainAgentId(result.data);
        setIsCreatingNewAgent(true);
      } else {
        message.error(result.message || '获取新Agent ID失败');
      }
    } catch (error) {
      console.error('创建新Agent失败:', error);
      message.error('创建新Agent失败，请稍后重试');
    }
  };

  return (
    <div className="flex flex-col h-full w-full gap-0 justify-between">
      {/* Upper part: Agent pool + Tool pool */}
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
            onCreateNewAgent={handleCreateNewAgent}
            subAgentList={subAgentList}
            loadingAgents={loadingAgents}
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
            tools={tools}
            loadingTools={loadingTools}
            mainAgentId={mainAgentId}
          />
        </div>
      </div>

      {/* The second half: business logic description */}
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
                    保存到Agent池
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Agent pop-up window */}
      <AgentModal 
        isOpen={isAgentModalOpen}
        onCancel={handleModalClose}
        onSave={(name, description, model, max_step, provide_run_summary, prompt) => {
          handleSaveNewAgent(name, description, model, max_step, provide_run_summary, prompt);
        }}
        title="保存到Agent池"
        selectedTools={selectedTools}
        systemPrompt={systemPrompt}
        mainAgentId={mainAgentId}
      />

      {/* Edit Agent pop-up window */}
      <AgentModal 
        isOpen={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onSave={handleUpdateAgent}
        title="配置Agent"
        agent={currentAgent}
        selectedTools={selectedTools}
        readOnly={false}
        mainAgentId={mainAgentId}
      />
    </div>
  )
}