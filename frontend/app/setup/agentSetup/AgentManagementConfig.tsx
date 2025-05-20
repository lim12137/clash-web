"use client"

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Typography, Input, Button, Switch, Modal, message, Select, InputNumber } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import ToolConfigModal from './components/ToolConfigModal'
import AgentModalComponent from './components/AgentModal'
import { mockAgents, mockTools } from './mockData'
import { AgentModalProps, Tool, BusinessLogicInputProps, SubAgentPoolProps, ToolPoolProps, BusinessLogicConfigProps, Agent, OpenAIModel } from './ConstInterface'
import { ScrollArea } from '@/components/ui/scrollArea'
import { getCreatingSubAgentId, fetchAgentList, updateToolConfig, searchToolConfig } from '@/services/agentConfigService'

const { Text } = Typography
const { TextArea } = Input

const modelOptions = [
  { label: '主模型', value: OpenAIModel.MainModel },
  { label: '副模型', value: OpenAIModel.SubModel },
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

  // 使用 useMemo 缓存工具列表，避免不必要的重新计算
  const displayTools = useMemo(() => {
    return tools.length > 0 ? tools : mockTools;
  }, [tools]);

  // 使用 useMemo 缓存选中状态的工具ID集合，提高查找效率
  const selectedToolIds = useMemo(() => {
    return new Set(selectedTools.map(tool => tool.id));
  }, [selectedTools]);

  // 使用 useCallback 缓存工具选择处理函数
  const handleToolSelect = useCallback(async (tool: Tool, isSelected: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { shouldProceed, params } = await handleToolSelectCommon(
      tool,
      isSelected,
      mainAgentId,
      (tool, isSelected) => onSelectTool(tool, isSelected)
    );

    if (!shouldProceed && params) {
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
  }, [mainAgentId, onSelectTool]);

  // 使用 useCallback 缓存工具配置点击处理函数
  const handleConfigClick = useCallback((tool: Tool, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTool(tool);
    setIsToolModalOpen(true);
  }, []);

  // 使用 useCallback 缓存工具保存处理函数
  const handleToolSave = useCallback((updatedTool: Tool) => {
    if (pendingToolSelection) {
      const { tool, isSelected } = pendingToolSelection;
      const missingRequiredFields = updatedTool.initParams
        .filter(param => param.required && (param.value === undefined || param.value === '' || param.value === null))
        .map(param => param.name);

      if (missingRequiredFields.length > 0) {
        message.error(`以下必填字段未填写: ${missingRequiredFields.join(', ')}`);
        return;
      }

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
  }, [pendingToolSelection, handleToolSelect]);

  // 使用 useCallback 缓存模态框关闭处理函数
  const handleModalClose = useCallback(() => {
    setIsToolModalOpen(false);
    setPendingToolSelection(null);
  }, []);

  // 使用 memo 优化工具项的渲染
  const ToolItem = memo(({ tool }: { tool: Tool }) => {
    const isSelected = selectedToolIds.has(tool.id);
    
    return (
      <div 
        className={`border rounded-md p-3 flex flex-col justify-center cursor-pointer transition-colors duration-200 h-[80px] ${
          isSelected ? 'bg-blue-100 border-blue-400' : 'hover:border-blue-300'
        }`}
        onClick={(e) => handleToolSelect(tool, !isSelected, e)}
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
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium">工具</h2>
        {loadingTools && <span className="text-sm text-gray-500">加载中...</span>}
      </div>
      <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
        {loadingTools ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-500">加载工具中...</span>
          </div>
        ) : (
          <div className={`grid ${isCreatingNewAgent ? 'grid-cols-4' : 'grid-cols-2'} gap-3 pr-2`}>
            {displayTools.map((tool) => (
              <ToolItem key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </ScrollArea>

      <ToolConfigModal
        isOpen={isToolModalOpen}
        onCancel={handleModalClose}
        onSave={handleToolSave}
        tool={currentTool}
        mainAgentId={parseInt(mainAgentId || '0')}
        selectedTools={selectedTools}
      />
    </div>
  );
}

// 使用 memo 优化 ToolPool 组件的渲染
export const MemoizedToolPool = memo(ToolPool);

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
  const [enabledToolIds, setEnabledToolIds] = useState<number[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  // 提取获取工具状态的公共函数
  const fetchAgentToolsState = async (agentId: string | null) => {
    if (!agentId) return;
    
    setIsLoadingTools(true);
    // 在加载开始时清空工具选中状态
    setSelectedTools([]);
    setEnabledToolIds([]);
    
    try {
      const result = await fetchAgentList();
      if (result.success) {
        const newEnabledToolIds = result.data.enabledToolIds || [];
        setEnabledToolIds(newEnabledToolIds);
        setMainAgentId(result.data.mainAgentId);
      } else {
        message.error(result.message || '获取工具状态失败');
      }
    } catch (error) {
      console.error('获取工具状态失败:', error);
      message.error('获取工具状态失败，请稍后重试');
    } finally {
      setIsLoadingTools(false);
    }
  };

  const fetchSubAgentIdAndEnableToolList = async () => {
    setIsLoadingTools(true);
    // 在加载开始时清空工具选中状态
    setSelectedTools([]);
    setEnabledToolIds([]);
    
    try {
      const result = await getCreatingSubAgentId(mainAgentId);
      if (result.success && result.data) {
        const newEnabledToolIds = result.data.enabledToolIds || [];
        setMainAgentId(result.data.agentId);
        setEnabledToolIds(newEnabledToolIds);
      } else {
        message.error(result.message || '获取新Agent ID失败');
      }
    } catch (error) {
      console.error('创建新Agent失败:', error);
      message.error('创建新Agent失败，请稍后重试');
    } finally {
      setIsLoadingTools(false);
    }
  };

  // 监听创建新Agent状态变化
  useEffect(() => {
    if (isCreatingNewAgent) {
      // 切换到创建新Agent状态时，清空相关状态
      setSelectedAgents([]);
      setBusinessLogic('');
      fetchSubAgentIdAndEnableToolList();
    } else {
      // 退出创建新Agent状态时，重置主Agent配置并重新获取工具状态
      setBusinessLogic('');
      setMainAgentModel(OpenAIModel.MainModel);
      setMainAgentMaxStep(10);
      setMainAgentPrompt('');
      fetchAgentToolsState(mainAgentId);
    }
  }, [isCreatingNewAgent]);

  // 监听工具状态变化，更新选中的工具
  useEffect(() => {
    if (!tools || !enabledToolIds || isLoadingTools) return;

    const enabledTools = tools.filter(tool => 
      enabledToolIds.includes(Number(tool.id))
    );

    setSelectedTools(prevTools => {
      // 只有当工具列表确实不同时才更新
      if (JSON.stringify(prevTools) !== JSON.stringify(enabledTools)) {
        return enabledTools;
      }
      return prevTools;
    });
  }, [tools, enabledToolIds, isLoadingTools]);

  // 处理创建新Agent
  const handleCreateNewAgent = async () => {
    setIsCreatingNewAgent(true);
  };

  // 重置状态当用户取消创建agent
  const handleCancelCreating = async () => {
    setIsCreatingNewAgent(false);
  };

  // 保存新Agent后的处理
  const handleSaveNewAgent = async (name: string, description: string, model: string, max_step: number, provide_run_summary: boolean, prompt: string) => {
    if (name.trim()) {
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
            value: param.value
          }))
        })),
        prompt: prompt
      };
      
      mockAgents.unshift(newAgent);
      setIsAgentModalOpen(false);
      message.success(`Agent:"${name}"创建成功`);
      
      // 先退出创建模式
      setIsCreatingNewAgent(false);
      // 重置状态
      setBusinessLogic('');
      setSelectedTools([]);
      // 最后重新获取工具状态
      if (mainAgentId) {
        await fetchAgentToolsState(mainAgentId);
      }
    }
  };

  const handleSaveAsAgent = () => {
    if (systemPrompt.trim()) {
      setIsAgentModalOpen(true);
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
          <MemoizedToolPool
            selectedTools={isLoadingTools ? [] : selectedTools}
            onSelectTool={(tool, isSelected) => {
              if (isLoadingTools) return;
              setSelectedTools(prevTools => {
                if (isSelected) {
                  return [...prevTools, tool];
                } else {
                  return prevTools.filter(t => t.id !== tool.id);
                }
              });
            }}
            isCreatingNewAgent={isCreatingNewAgent}
            tools={tools}
            loadingTools={isLoadingTools}
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
      <AgentModalComponent 
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
      <AgentModalComponent 
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