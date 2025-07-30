"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { message, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { TooltipProvider } from '@/components/ui/tooltip'
import SubAgentPool from './components/SubAgentPool'
import { MemoizedToolPool } from './components/ToolPool'
import DeleteConfirmModal from './components/DeleteConfirmModal'
// import AgentInfoInput from './components/AgentInfoInput'
import { 
  BusinessLogicConfigProps, 
  Agent, 
  Tool, 
  OpenAIModel,
  AgentBasicInfo
} from './ConstInterface'
import { 
  getCreatingSubAgentId, 
  fetchAgentList, 
  fetchAgentDetail,
  updateAgent, 
  importAgent, 
  exportAgent, 
  deleteAgent, 
  searchAgentInfo 
} from '@/services/agentConfigService'

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
  systemPrompt,
  setSystemPrompt,
  isCreatingNewAgent,
  setIsCreatingNewAgent,
  mainAgentModel,
  setMainAgentModel,
  mainAgentMaxStep,
  setMainAgentMaxStep,
  tools,
  subAgentList = [],
  loadingAgents = false,
  mainAgentId,
  setMainAgentId,
  setSubAgentList,
  enabledAgentIds,
  setEnabledAgentIds,
  newAgentName,
  newAgentDescription,
  newAgentProvideSummary,
  setNewAgentName,
  setNewAgentDescription,
  setNewAgentProvideSummary,
  isNewAgentInfoValid,
  setIsNewAgentInfoValid,
  onEditingStateChange,
  onToolsRefresh,
  dutyContent,
  setDutyContent,
  constraintContent,
  setConstraintContent,
  fewShotsContent,
  setFewShotsContent,
  // Add new props for agent name and description
  agentName,
  setAgentName,
  agentDescription,
  setAgentDescription,
  // Add new prop for generating agent state
  isGeneratingAgent = false
}: BusinessLogicConfigProps) {
  console.log('BusinessLogicConfig props received:', { agentName, agentDescription, setAgentName: !!setAgentName, setAgentDescription: !!setAgentDescription });
  
  const [enabledToolIds, setEnabledToolIds] = useState<number[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  // 使用父组件传递的生成状态，而不是本地状态
  // const [localIsGenerating, setLocalIsGenerating] = useState(false)
  
  const [generationProgress, setGenerationProgress] = useState({
    duty: false,
    constraint: false,
    few_shots: false
  })
  
  // Use refs to keep track of the content of the current prompt.
  const currentPromptRef = useRef({
    duty: '',
    constraint: '',
    few_shots: ''
  })
  
  // Delete confirmation popup status
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  // Edit agent related status
  const [isEditingAgent, setIsEditingAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const { t } = useTranslation('common');

  // Common refresh agent list function, moved to the front to avoid hoisting issues
  const refreshAgentList = async (t: TFunction) => {
    setIsLoadingTools(true);
    // Clear the tool selection status when loading starts
    setSelectedTools([]);
    setEnabledToolIds([]);
    
    try {
      const result = await fetchAgentList();
      if (result.success) {
        // Update agent list with basic info only
        setSubAgentList(result.data);
        message.success(t('businessLogic.config.message.agentListLoaded'));
      } else {
        message.error(result.message || t('businessLogic.config.error.agentListFailed'));
      }
    } catch (error) {
      console.error(t('debug.console.fetchAgentListFailed'), error);
      message.error(t('businessLogic.config.error.agentListFailed'));
    } finally {
      setIsLoadingTools(false);
    }
  };

  // Handle agent selection and load detailed configuration
  // 移除前端缓存逻辑，完全依赖后端返回的sub_agent_id_list
  const handleAgentSelectionOnly = (agent: Agent, isSelected: boolean) => {
    // 不再进行前端缓存，完全依赖后端返回的sub_agent_id_list
    // 这个函数现在只是一个占位符，实际的状态管理由后端控制
    console.log('Agent selection changed:', agent.name, isSelected);
  };

  // 刷新agent状态的函数
  const handleRefreshAgentState = async () => {
    if (isEditingAgent && editingAgent) {
      try {
        // 添加一个小延迟，确保后端操作完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 重新获取当前编辑agent的详细信息
        const result = await searchAgentInfo(Number(editingAgent.id));
        if (result.success && result.data) {
          const agentDetail = result.data;
          
          // 更新enabledAgentIds
          if (agentDetail.sub_agent_id_list && agentDetail.sub_agent_id_list.length > 0) {
            const newEnabledAgentIds = agentDetail.sub_agent_id_list.map((id: any) => Number(id));
            setEnabledAgentIds(newEnabledAgentIds);
          } else {
            setEnabledAgentIds([]);
          }
        }
      } catch (error) {
        console.error('刷新agent状态失败:', error);
      }
    }
  };

  // 直接更新enabledAgentIds的函数
  const handleUpdateEnabledAgentIds = (newEnabledAgentIds: number[]) => {
    setEnabledAgentIds(newEnabledAgentIds);
  };

  const handleAgentSelectAndLoadDetail = async (agent: Agent, isSelected: boolean) => {
    if (agent.is_available === false && isSelected) {
      message.error(t('agent.error.disabledAgent'));
      return;
    }

    if (isSelected) {
      // Load detailed agent configuration when selected
      try {
        const result = await fetchAgentDetail(Number(agent.id));
        if (result.success && result.data) {
          const agentDetail = result.data;
          
          // Update all related states with detailed configuration
          setMainAgentId(agentDetail.id);
          setMainAgentModel(agentDetail.model as OpenAIModel);
          setMainAgentMaxStep(agentDetail.max_step);
          setBusinessLogic(agentDetail.business_description || '');
          
          // Set agent name and description
          setAgentName?.(agentDetail.name || '');
          setAgentDescription?.(agentDetail.description || '');
          
          // Load the segmented prompt content
          setDutyContent?.(agentDetail.duty_prompt || '');
          setConstraintContent?.(agentDetail.constraint_prompt || '');
          setFewShotsContent?.(agentDetail.few_shots_prompt || '');
          
          // Load agent tools
          if (agentDetail.tools && agentDetail.tools.length > 0) {
            setSelectedTools(agentDetail.tools);
            const toolIds = agentDetail.tools.map((tool: any) => Number(tool.id));
            setEnabledToolIds(toolIds);
          } else {
            setSelectedTools([]);
            setEnabledToolIds([]);
          }
          
          // Update selected agents list
          setSelectedAgents([agentDetail]);
          // 使用后端返回的sub_agent_id_list设置enabledAgentIds
          if (agentDetail.sub_agent_id_list && agentDetail.sub_agent_id_list.length > 0) {
            setEnabledAgentIds(agentDetail.sub_agent_id_list.map((id: any) => Number(id)));
          } else {
            setEnabledAgentIds([]);
          }
          
          message.success(t('businessLogic.config.message.agentDetailLoaded'));
        } else {
          message.error(result.message || t('businessLogic.config.error.agentDetailFailed'));
        }
      } catch (error) {
        console.error('加载Agent详情失败:', error);
        message.error(t('businessLogic.config.error.agentDetailFailed'));
      }
    } else {
      // Clear configuration when deselected
      setSelectedAgents([]);
      // 清空enabledAgentIds
      setEnabledAgentIds([]);
      setSelectedTools([]);
      setEnabledToolIds([]);
      setMainAgentId(null);
      setBusinessLogic('');
      setDutyContent?.('');
      setConstraintContent?.('');
      setFewShotsContent?.('');
      // Clear agent name and description
      setAgentName?.('');
      setAgentDescription?.('');
    }
  };

  const fetchSubAgentIdAndEnableToolList = async (t: TFunction) => {
    setIsLoadingTools(true);
    // Clear the tool selection status when loading starts
    setSelectedTools([]);
    setEnabledToolIds([]);
    
    try {
      const result = await getCreatingSubAgentId();
      if (result.success && result.data) {
        const { agentId, enabledToolIds, modelName, maxSteps, businessDescription, dutyPrompt, constraintPrompt, fewShotsPrompt } = result.data;
        
        // Update the main agent ID
        setMainAgentId(agentId);
        // Update the enabled tool ID list
        setEnabledToolIds(enabledToolIds);
        // Update the model
        if (modelName) {
          setMainAgentModel(modelName as OpenAIModel);
        }
        // Update the maximum number of steps
        if (maxSteps) {
          setMainAgentMaxStep(maxSteps);
        }
        // Update the business description
        if (businessDescription) {
          setBusinessLogic(businessDescription);
        }
        // Update the duty prompt
        if (setDutyContent) {
          setDutyContent(dutyPrompt || '');
        }
        // Update the constraint prompt
        if (setConstraintContent) {
          setConstraintContent(constraintPrompt || '');
        }
        // Update the few shots prompt
        if (setFewShotsContent) {
          setFewShotsContent(fewShotsPrompt || '');
        }
      } else {
        message.error(result.message || t('businessLogic.config.error.agentIdFailed'));
      }
    } catch (error) {
      console.error('创建新Agent失败:', error);
      message.error(t('businessLogic.config.error.agentIdFailed'));
    } finally {
      setIsLoadingTools(false);
    }
  };

  // Listen for changes in the creation of a new Agent
  useEffect(() => {
    if (isCreatingNewAgent) {
      // When switching to the creation of a new Agent, clear the relevant status
      setSelectedAgents([]);
      
      if (!isEditingAgent) {
        // Only clear and get new Agent configuration in creating mode
        setBusinessLogic('');
        setSystemPrompt(''); // Also clear the system prompt
        fetchSubAgentIdAndEnableToolList(t);
        // Reset new agent info states when entering creating mode
        setNewAgentName('');
        setNewAgentDescription('');
        setNewAgentProvideSummary(true);
        setIsNewAgentInfoValid(false);
      } else {
        // In edit mode, data is loaded in handleEditAgent, here validate the form
        setIsNewAgentInfoValid(true); // Assume data is valid when editing
        console.log('Edit mode useEffect - Do not clear data'); // Debug information
      }
    } else {
      // When exiting the creation of a new Agent, reset the main Agent configuration and refresh the list
      if (!isEditingAgent) {
        setBusinessLogic('');
        setSystemPrompt(''); // Also clear the system prompt
        setMainAgentModel(OpenAIModel.MainModel);
        setMainAgentMaxStep(5);
        // 延迟刷新agent列表，避免跳变
        setTimeout(() => {
          refreshAgentList(t);
        }, 200);
      }
    }
  }, [isCreatingNewAgent, isEditingAgent]);

  // Listen for changes in the tool status, update the selected tool
  useEffect(() => {
    if (!tools || !enabledToolIds || isLoadingTools) return;

    const enabledTools = tools.filter(tool => 
      enabledToolIds.includes(Number(tool.id))
    );

    setSelectedTools(enabledTools);
  }, [tools, enabledToolIds, isLoadingTools]);

  // Handle the creation of a new Agent
  const handleCreateNewAgent = async () => {
    // Set to create mode
    setIsEditingAgent(false);
    setEditingAgent(null);
    setIsCreatingNewAgent(true);
    // 清空右侧名称描述框
    setAgentName?.('');
    setAgentDescription?.('');
    // 清空业务逻辑和工具选择
    setBusinessLogic('');
    setSelectedTools([]);
    setEnabledToolIds([]);
    // 清空分段提示内容
    setDutyContent?.('');
    setConstraintContent?.('');
    setFewShotsContent?.('');
    // 重置agent信息状态
    setNewAgentName('');
    setNewAgentDescription('');
    setNewAgentProvideSummary(true);
    setIsNewAgentInfoValid(false);
    onEditingStateChange?.(false, null);
  };

  // Reset the status when the user cancels the creation of an Agent
  const handleCancelCreating = async () => {
    // 先通知外部编辑状态变化，避免UI跳变
    onEditingStateChange?.(false, null);
    
    // 延迟重置状态，让UI先完成状态切换
    setTimeout(() => {
      setIsCreatingNewAgent(false);
      setIsEditingAgent(false);
      setEditingAgent(null);
      
      // Reset agent info states
      setNewAgentName('');
      setNewAgentDescription('');
      setNewAgentProvideSummary(true);
      setIsNewAgentInfoValid(false);
      
      // 清空右侧名称描述框
      setAgentName?.('');
      setAgentDescription?.('');
      
      // 清空业务逻辑
      setBusinessLogic('');
      
      // 清空分段提示内容
      setDutyContent?.('');
      setConstraintContent?.('');
      setFewShotsContent?.('');
      
      // 延迟清空工具选择，避免工具池跳变
      setTimeout(() => {
        setSelectedTools([]);
        setEnabledToolIds([]);
      }, 300);
    }, 100);
  };

  // Handle the creation of a new Agent
  const handleSaveNewAgent = async (name: string, description: string, model: string, max_step: number, provide_run_summary: boolean, prompt: string, business_description: string) => {
    if (name.trim() && mainAgentId) {
      try {
        let result;
        
        if (isEditingAgent && editingAgent) {
          result = await updateAgent(
            Number(editingAgent.id),
            name,
            description,
            model,
            max_step,
            provide_run_summary,
            undefined,
            business_description,
            dutyContent,
            constraintContent,
            fewShotsContent
          );
        } else {
          result = await updateAgent(
            Number(mainAgentId),
            name,
            description,
            model,
            max_step,
            provide_run_summary,
            undefined,
            business_description,
            dutyContent,
            constraintContent,
            fewShotsContent
          );
        }

        if (result.success) {
          const actionText = isEditingAgent ? t('agent.action.modify') : t('agent.action.create');
          message.success(t('businessLogic.config.message.agentCreated', { name, action: actionText }));

          setIsCreatingNewAgent(false);
          setIsEditingAgent(false);
          setEditingAgent(null);
          onEditingStateChange?.(false, null);

          setBusinessLogic('');
          setSelectedTools([]);
          setEnabledToolIds([]);
          setNewAgentName('');
          setNewAgentDescription('');
          setNewAgentProvideSummary(true);
          setSystemPrompt('');
          // 清空右侧名称描述框
          setAgentName?.('');
          setAgentDescription?.('');
          // 清空分段提示内容
          setDutyContent?.('');
          setConstraintContent?.('');
          setFewShotsContent?.('');

          refreshAgentList(t);
        } else {
          message.error(result.message || t('businessLogic.config.error.saveFailed'));
        }
      } catch (error) {
        console.error('Error saving agent:', error);
        message.error(t('businessLogic.config.error.saveRetry'));
      }
    } else {
      if (!name.trim()) {
        message.error(t('businessLogic.config.error.nameEmpty'));
      }
      if (!mainAgentId) {
        message.error(t('businessLogic.config.error.noAgentId'));
      }
    }
  };

  const handleSaveAsAgent = () => {
    if (!isNewAgentInfoValid) {
      message.warning(t('businessLogic.config.message.completeAgentInfo'));
      return;
    }
    // Check if any of the prompt parts have content
    const hasPromptContent = dutyContent?.trim() || constraintContent?.trim() || fewShotsContent?.trim();
    if (!hasPromptContent) {
      message.warning(t('businessLogic.config.message.generatePromptFirst'));
      return;
    }
    handleSaveNewAgent(
      newAgentName, 
      newAgentDescription, 
      mainAgentModel, 
      mainAgentMaxStep, 
      newAgentProvideSummary,
      systemPrompt,
      businessLogic
    );
  };

  const handleEditAgent = async (agent: Agent, t: TFunction) => {
    try {
      // 调用查询接口获取完整的Agent信息
      const result = await searchAgentInfo(Number(agent.id));
      
      if (!result.success || !result.data) {
        message.error(result.message || t('businessLogic.config.error.agentDetailFailed'));
        return;
      }
      
      const agentDetail = result.data;
      
      // 获取信息成功后再设置编辑状态和高亮
      setIsEditingAgent(true);
      setEditingAgent(agentDetail);
      // 编辑现有agent时，不设置isCreatingNewAgent为true
      
      // 先设置右侧名称描述框的数据，确保立即显示
      console.log('Setting agent name and description in handleEditAgent:', agentDetail.name, agentDetail.description);
      console.log('setAgentName function exists:', !!setAgentName);
      console.log('setAgentDescription function exists:', !!setAgentDescription);
      
      setAgentName?.(agentDetail.name || '');
      setAgentDescription?.(agentDetail.description || '');
      console.log('setAgentName and setAgentDescription called');
      
      // 通知外部编辑状态变化（使用完整数据）
      onEditingStateChange?.(true, agentDetail);
      
      // 加载Agent数据到界面
      setNewAgentName(agentDetail.name);
      setNewAgentDescription(agentDetail.description);
      setNewAgentProvideSummary(agentDetail.provide_run_summary);
      setMainAgentModel(agentDetail.model as OpenAIModel);
      setMainAgentMaxStep(agentDetail.max_step);
      setBusinessLogic(agentDetail.business_description || '');
      
      // 使用后端返回的sub_agent_id_list设置启用的agent列表
      if (agentDetail.sub_agent_id_list && agentDetail.sub_agent_id_list.length > 0) {
        setEnabledAgentIds(agentDetail.sub_agent_id_list.map((id: any) => Number(id)));
      } else {
        setEnabledAgentIds([]);
      }
      
      // Load the segmented prompt content
      setDutyContent?.(agentDetail.duty_prompt || '');
      setConstraintContent?.(agentDetail.constraint_prompt || '');
      setFewShotsContent?.(agentDetail.few_shots_prompt || '');
      
      // 加载Agent的工具
      if (agentDetail.tools && agentDetail.tools.length > 0) {
        setSelectedTools(agentDetail.tools);
        // 设置已启用的工具ID
        const toolIds = agentDetail.tools.map((tool: any) => Number(tool.id));
        setEnabledToolIds(toolIds);
      } else {
        setSelectedTools([]);
        setEnabledToolIds([]);
      }
      
      message.success(t('businessLogic.config.message.agentInfoLoaded'));
    } catch (error) {
      console.error(t('debug.console.loadAgentDetailsFailed'), error);
      message.error(t('businessLogic.config.error.agentDetailFailed'));
      // 如果出错，重置编辑状态
      setIsEditingAgent(false);
      setEditingAgent(null);
      // 注意：不重置isCreatingNewAgent，保持agent池显示
      onEditingStateChange?.(false, null);
    }
  };



  // Handle the update of the model
  const handleModelChange = async (value: OpenAIModel) => {
    const targetAgentId = isEditingAgent && editingAgent ? editingAgent.id : mainAgentId;
    
    if (!targetAgentId) {
      message.error(t('businessLogic.config.error.noAgentId'));
      return;
    }

    try {
      const result = await updateAgent(
        Number(targetAgentId),
        undefined,
        undefined,
        value,
        undefined,
        undefined,
        undefined,
        undefined
      );

      if (result.success) {
        setMainAgentModel(value);
        message.success(t('businessLogic.config.message.modelUpdateSuccess'));
      } else {
        message.error(result.message || t('businessLogic.config.error.modelUpdateFailed'));
      }
    } catch (error) {
      console.error(t('debug.console.updateModelFailed'), error);
      message.error(t('businessLogic.config.error.modelUpdateRetry'));
    }
  };

  // Handle the update of the maximum number of steps
  const handleMaxStepChange = async (value: number | null) => {
    const targetAgentId = isEditingAgent && editingAgent ? editingAgent.id : mainAgentId;
    
    if (!targetAgentId) {
      message.error(t('businessLogic.config.error.noAgentId'));
      return;
    }

    const newValue = value ?? 5;
    
    try {
      const result = await updateAgent(
        Number(targetAgentId),
        undefined,
        undefined,
        undefined,
        newValue,
        undefined,
        undefined,
        undefined
      );

      if (result.success) {
        setMainAgentMaxStep(newValue);
        message.success(t('businessLogic.config.message.maxStepsUpdateSuccess'));
      } else {
        message.error(result.message || t('businessLogic.config.error.maxStepsUpdateFailed'));
      }
    } catch (error) {
      console.error(t('debug.console.updateMaxStepsFailed'), error);
      message.error(t('businessLogic.config.error.maxStepsUpdateRetry'));
    }
  };

  // Handle importing agent
  const handleImportAgent = (t: TFunction) => {
    if (!mainAgentId) {
      message.error(t('businessLogic.config.error.noAgentId'));
      return;
    }

    // Create a hidden file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Check file type
      if (!file.name.endsWith('.json')) {
        message.error(t('businessLogic.config.error.invalidFileType'));
        return;
      }

      setIsImporting(true);
      try {
        // Read file content
        const fileContent = await file.text();
        let agentInfo;

        try {
          agentInfo = JSON.parse(fileContent);
        } catch (parseError) {
          message.error(t('businessLogic.config.error.invalidFileType'));
          setIsImporting(false);
          return;
        }

        // Call import API
        const result = await importAgent(mainAgentId, agentInfo);

        if (result.success) {
          message.success(t('businessLogic.config.error.agentImportSuccess'));
          // Refresh agent list
          refreshAgentList(t);
        } else {
          message.error(result.message || t('businessLogic.config.error.agentImportFailed'));
        }
      } catch (error) {
        console.error(t('debug.console.importAgentFailed'), error);
        message.error(t('businessLogic.config.error.agentImportFailed'));
      } finally {
        setIsImporting(false);
      }
    };

    fileInput.click();
  };

  // Handle exporting agent
  const handleExportAgent = async (agent: Agent, t: TFunction) => {
    try {
      const result = await exportAgent(Number(agent.id));
      if (result.success) {
        // 处理后端返回的字符串或对象
        let exportData = result.data;
        if (typeof exportData === 'string') {
          try {
            exportData = JSON.parse(exportData);
          } catch (e) {
            // 如果解析失败，说明本身就是字符串，直接导出
          }
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${agent.name}_config.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        message.success(t('businessLogic.config.message.agentExportSuccess'));
      } else {
        message.error(result.message || t('businessLogic.config.error.agentExportFailed'));
      }
    } catch (error) {
      console.error(t('debug.console.exportAgentFailed'), error);
      message.error(t('businessLogic.config.error.agentExportFailed'));
    }
  };

  // Handle deleting agent
  const handleDeleteAgent = async (agent: Agent) => {
    // Show confirmation dialog
    setAgentToDelete(agent);
    setIsDeleteConfirmOpen(true);
  };

  // Handle confirmed deletion
  const handleConfirmDelete = async (t: TFunction) => {
    if (!agentToDelete) return;

    try {
      const result = await deleteAgent(Number(agentToDelete.id));
      if (result.success) {
        message.success(t('businessLogic.config.error.agentDeleteSuccess', { name: agentToDelete.name }));
        // Refresh agent list
        refreshAgentList(t);
      } else {
        message.error(result.message || t('businessLogic.config.error.agentDeleteFailed'));
      }
    } catch (error) {
      console.error(t('debug.console.deleteAgentFailed'), error);
      message.error(t('businessLogic.config.error.agentDeleteFailed'));
    } finally {
      setIsDeleteConfirmOpen(false);
      setAgentToDelete(null);
    }
  };

  // Handle exit edit mode
  const handleExitEdit = () => {
    setIsEditingAgent(false);
    setEditingAgent(null);
    setIsCreatingNewAgent(false);
    setNewAgentName('');
    setNewAgentDescription('');
    setNewAgentProvideSummary(true);
    setIsNewAgentInfoValid(false);
    setBusinessLogic('');
    setDutyContent('');
    setConstraintContent('');
    setFewShotsContent('');
    setAgentName?.('');
    setAgentDescription?.('');
    // Reset selected tools
    setSelectedTools([]);
    setEnabledToolIds([]);
    // Notify parent component about editing state change
    onEditingStateChange?.(false, null);
  };

  // 刷新工具列表
  const handleToolsRefresh = useCallback(async () => {
    if (onToolsRefresh) {
      await onToolsRefresh();
    }
  }, [onToolsRefresh]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full w-full gap-0 justify-between relative">
        {/* Lower part: Agent pool + Tool pool */}
        <div className="flex gap-4 flex-1 min-h-0 pb-4 pr-4 pl-4">
          {/* Left column: Always show SubAgentPool */}
          <div className="w-[360px] h-full">
            <SubAgentPool
              selectedAgents={selectedAgents}
              onSelectAgent={() => {}} // 保留原有接口但不使用
              onSelectAgentAndLoadDetail={handleAgentSelectAndLoadDetail}
              onEditAgent={(agent) => handleEditAgent(agent, t)}
              onCreateNewAgent={handleCreateNewAgent}
              onImportAgent={() => handleImportAgent(t)}
              onExportAgent={(agent) => handleExportAgent(agent, t)}
              onDeleteAgent={handleDeleteAgent}
              subAgentList={subAgentList}
              loadingAgents={loadingAgents}
              enabledAgentIds={enabledAgentIds}
              isImporting={isImporting}
              isEditingAgent={isEditingAgent}
              editingAgent={editingAgent}
              parentAgentId={isEditingAgent && editingAgent ? Number(editingAgent.id) : (isCreatingNewAgent && mainAgentId ? Number(mainAgentId) : undefined)}
              onAgentSelectionOnly={handleAgentSelectionOnly}
              onRefreshAgentState={handleRefreshAgentState}
              onUpdateEnabledAgentIds={handleUpdateEnabledAgentIds}
              isCreatingNewAgent={isCreatingNewAgent}
              onExitEdit={handleExitEdit}
              isGeneratingAgent={isGeneratingAgent}
            />
          </div>
          
          <div className="flex-1 h-full">
            <MemoizedToolPool
              selectedTools={isLoadingTools ? [] : selectedTools}
              onSelectTool={(tool, isSelected) => {
                if (isLoadingTools) return;
                if (isSelected) {
                  setSelectedTools([...selectedTools, tool]);
                } else {
                  setSelectedTools(selectedTools.filter(t => t.id !== tool.id));
                }
              }}
              isCreatingNewAgent={isCreatingNewAgent}
              tools={tools}
              loadingTools={isLoadingTools}
              mainAgentId={isEditingAgent && editingAgent ? editingAgent.id : mainAgentId}
              localIsGenerating={isGeneratingAgent}
              onToolsRefresh={handleToolsRefresh}
              isEditingMode={isEditingAgent || isCreatingNewAgent}
              isGeneratingAgent={isGeneratingAgent}
            />
          </div>
        </div>

      {/* Delete confirmation popup */}
      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        agentToDelete={agentToDelete}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => handleConfirmDelete(t)}
      />
    </div>
  </TooltipProvider>
  )
} 