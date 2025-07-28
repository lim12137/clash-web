"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { message, Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { TooltipProvider } from '@/components/ui/tooltip'
import BusinessLogicInput from './components/BusinessLogicInput'
import SubAgentPool from './components/SubAgentPool'
import { MemoizedToolPool } from './components/ToolPool'
import ModelConfigPanel from './components/ModelConfigPanel'
import ActionButtons from './components/ActionButtons'
import DeleteConfirmModal from './components/DeleteConfirmModal'
import AgentInfoInput from './components/AgentInfoInput'
import { 
  BusinessLogicConfigProps, 
  Agent, 
  Tool, 
  OpenAIModel 
} from './ConstInterface'
import { 
  getCreatingSubAgentId, 
  fetchAgentList, 
  updateAgent, 
  importAgent, 
  exportAgent, 
  deleteAgent, 
  searchAgentInfo 
} from '@/services/agentConfigService'
import { generatePromptStream, savePrompt } from '@/services/promptService'

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
  setFewShotsContent
}: BusinessLogicConfigProps) {
  const [enabledToolIds, setEnabledToolIds] = useState<number[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPromptGenerating, setIsPromptGenerating] = useState(false)
  const [isPromptSaving, setIsPromptSaving] = useState(false)
  const [localIsGenerating, setLocalIsGenerating] = useState(false)
  
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
    if (!mainAgentId) return;
    
    setIsLoadingTools(true);
    // Clear the tool selection status when loading starts
    setSelectedTools([]);
    setEnabledToolIds([]);
    
    try {
      const result = await fetchAgentList();
      if (result.success) {
        // Update all related states
        setSubAgentList(result.data.subAgentList);
        setMainAgentId(result.data.mainAgentId);
        const newEnabledToolIds = result.data.enabledToolIds || [];
        setEnabledToolIds(newEnabledToolIds);
        
        // Update the status of the newly added fields
        if (result.data.modelName) {
          setMainAgentModel(result.data.modelName as OpenAIModel);
        }
        if (result.data.maxSteps) {
          setMainAgentMaxStep(result.data.maxSteps);
        }
        if (result.data.businessDescription) {
          setBusinessLogic(result.data.businessDescription);
        }
        if (result.data.dutyPrompt) {
          setDutyContent?.(result.data.dutyPrompt);
        }
        if (result.data.constraintPrompt) {
          setConstraintContent?.(result.data.constraintPrompt);
        }
        if (result.data.fewShotsPrompt) {
          setFewShotsContent?.(result.data.fewShotsPrompt);
        }
        
        // Update the selected tools
        if (tools && tools.length > 0) {
          const enabledTools = tools.filter(tool => 
            newEnabledToolIds.includes(Number(tool.id))
          );
          setSelectedTools(enabledTools);
        }
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

  const fetchSubAgentIdAndEnableToolList = async (t: TFunction) => {
    setIsLoadingTools(true);
    // Clear the tool selection status when loading starts
    setSelectedTools([]);
    setEnabledToolIds([]);
    
    try {
      const result = await getCreatingSubAgentId(mainAgentId);
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
        refreshAgentList(t);
      }
    }
  }, [isCreatingNewAgent, isEditingAgent]);

  // Listen for changes in the tool status, update the selected tool
  useEffect(() => {
    if (!tools || !enabledToolIds || isLoadingTools) return;

    const enabledTools = tools.filter(tool => 
      enabledToolIds.includes(Number(tool.id))
    );

    setSelectedTools(prevTools => {
      // Only update when the tool list is确实不同时
      if (JSON.stringify(prevTools) !== JSON.stringify(enabledTools)) {
        return enabledTools;
      }
      return prevTools;
    });
  }, [tools, enabledToolIds, isLoadingTools]);

  // Handle the creation of a new Agent
  const handleCreateNewAgent = async () => {
    // Set to create mode
    setIsEditingAgent(false);
    setEditingAgent(null);
    setIsCreatingNewAgent(true);
    onEditingStateChange?.(false, null);
  };

  // Reset the status when the user cancels the creation of an Agent
  const handleCancelCreating = async () => {
    setIsCreatingNewAgent(false);
    setIsEditingAgent(false);
    setEditingAgent(null);
    // Reset agent info states
    setNewAgentName('');
    setNewAgentDescription('');
    setNewAgentProvideSummary(true);
    setIsNewAgentInfoValid(false);
    // 通知外部编辑状态变化
    onEditingStateChange?.(false, null);
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
          setNewAgentName('');
          setNewAgentDescription('');
          setNewAgentProvideSummary(true);
          setSystemPrompt('');

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
      // 首先设置为编辑模式，避免useEffect清空数据
      setIsEditingAgent(true);
      setEditingAgent(agent); // 先用传入的agent，稍后会用详细数据替换
      setIsCreatingNewAgent(true);
      // 通知外部编辑状态变化
      onEditingStateChange?.(true, agent);
      
      // 调用查询接口获取完整的Agent信息
      const result = await searchAgentInfo(Number(agent.id));
      
      if (!result.success || !result.data) {
        message.error(result.message || t('businessLogic.config.error.agentDetailFailed'));
        // 如果获取失败，重置编辑状态
        setIsEditingAgent(false);
        setEditingAgent(null);
        setIsCreatingNewAgent(false);
        onEditingStateChange?.(false, null);
        return;
      }
      
      const agentDetail = result.data;
      
      console.log(t('debug.console.loadAgentDetails'), agentDetail); // 调试信息
      
      // 更新为完整的Agent数据
      setEditingAgent(agentDetail);
      // 通知外部编辑状态变化（使用完整数据）
      onEditingStateChange?.(true, agentDetail);
      
      // 加载Agent数据到界面
      setNewAgentName(agentDetail.name);
      setNewAgentDescription(agentDetail.description);
      setNewAgentProvideSummary(agentDetail.provide_run_summary);
      setMainAgentModel(agentDetail.model as OpenAIModel);
      setMainAgentMaxStep(agentDetail.max_step);
      setBusinessLogic(agentDetail.business_description || '');
      
      // Load the segmented prompt content
      setDutyContent?.(agentDetail.duty_prompt || '');
      setConstraintContent?.(agentDetail.constraint_prompt || '');
      setFewShotsContent?.(agentDetail.few_shots_prompt || '');
      
      console.log(t('debug.console.setBusinessDescription'), agentDetail.business_description); // 调试信息
      // 加载Agent的工具
      if (agentDetail.tools && agentDetail.tools.length > 0) {
        setSelectedTools(agentDetail.tools);
        // 设置已启用的工具ID
        const toolIds = agentDetail.tools.map((tool: any) => Number(tool.id));
        setEnabledToolIds(toolIds);
        console.log(t('debug.console.loadedTools'), agentDetail.tools); // 调试信息
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
      setIsCreatingNewAgent(false);
      onEditingStateChange?.(false, null);
    }
  };

  // Handle the update of the Agent selection status
  const handleAgentSelect = async (agent: Agent, isSelected: boolean) => {
    if (agent.is_available === false && isSelected) {
      message.error(t('agent.error.disabledAgent'));
      return;
    }

    try {
      const result = await updateAgent(
        Number(agent.id),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        isSelected, // enabled
        undefined, // businessDescription
        undefined, // dutyPrompt
        undefined, // constraintPrompt
        undefined  // fewShotsPrompt
      );

      if (result.success) {
        if (isSelected) {
          setSelectedAgents([...selectedAgents, agent]);
          setEnabledAgentIds([...enabledAgentIds, Number(agent.id)]);
        } else {
          setSelectedAgents(selectedAgents.filter((a) => a.id !== agent.id));
          setEnabledAgentIds(enabledAgentIds.filter(id => id !== Number(agent.id)));
        }
        message.success(t('businessLogic.config.message.agentStatusUpdated', {
          name: agent.name,
          status: isSelected ? t('common.enabled') : t('common.disabled')
        }));
      } else {
        message.error(result.message || t('agent.error.statusUpdateFailed'));
      }
    } catch (error) {
      console.error(t('debug.console.updateAgentStatusFailed'), error);
      message.error(t('agent.error.statusUpdateRetry'));
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

  // Generate system prompt
  const handleGenerateSystemPrompt = async (t: TFunction) => {
    if (!businessLogic || businessLogic.trim() === '') {
      message.warning(t('businessLogic.config.error.businessDescriptionRequired'));
      return;
    }

    const targetAgentId = isEditingAgent && editingAgent ? editingAgent.id : mainAgentId;
    
    if (!targetAgentId) {
      message.warning(t('businessLogic.config.error.noAgentIdForPrompt'));
      return;
    }
    
    try {
      setIsPromptGenerating(true);
      setLocalIsGenerating(true);
      setSystemPrompt('');
      
      // Reset content and progress for three sections
      setDutyContent?.('');
      setConstraintContent?.('');
      setFewShotsContent?.('');
      setGenerationProgress({
        duty: false,
        constraint: false,
        few_shots: false
      });
      
      // Reset ref
      currentPromptRef.current = {
        duty: '',
        constraint: '',
        few_shots: ''
      };
      
      await generatePromptStream(
        {
          agent_id: Number(targetAgentId),
          task_description: businessLogic
        },
        (streamData) => {
          // Update corresponding content and progress based on type
          switch (streamData.type) {
            case 'duty':
              setDutyContent?.(streamData.content);
              setGenerationProgress(prev => ({ ...prev, duty: streamData.is_complete }));
              currentPromptRef.current.duty = streamData.content;
              break;
            case 'constraint':
              setConstraintContent?.(streamData.content);
              setGenerationProgress(prev => ({ ...prev, constraint: streamData.is_complete }));
              currentPromptRef.current.constraint = streamData.content;
              break;
            case 'few_shots':
              setFewShotsContent?.(streamData.content);
              setGenerationProgress(prev => ({ ...prev, few_shots: streamData.is_complete }));
              currentPromptRef.current.few_shots = streamData.content;
              break;
          }
        },
        (err) => {
          message.error(t('businessLogic.config.error.promptGenerateFailed', {
            error: err instanceof Error ? err.message : t('common.unknownError')
          }));
          setIsPromptGenerating(false);
          setLocalIsGenerating(false);
        },
        () => {
          setIsPromptGenerating(false);
          setLocalIsGenerating(false);
          message.success(t('businessLogic.config.message.promptGenerateSuccess'));
        }
      );
    } catch (error) {
      console.error(t('debug.console.generatePromptFailed'), error);
      message.error(t('businessLogic.config.error.promptGenerateFailed', {
        error: error instanceof Error ? error.message : t('common.unknownError')
      }));
      setIsPromptGenerating(false);
      setLocalIsGenerating(false);
    }
  };

  // Save system prompt
  const handleSaveSystemPrompt = async () => {
    const targetAgentId = isEditingAgent && editingAgent ? editingAgent.id : mainAgentId;
    
    if (!targetAgentId) {
      message.warning(t('businessLogic.config.error.noAgentIdForPrompt'));
      return;
    }
    if (!systemPrompt || systemPrompt.trim() === '') {
      message.warning(t('businessLogic.config.message.promptEmpty'));
      return;
    }
    
    try {
      setIsPromptSaving(true);
      await savePrompt({ agent_id: Number(targetAgentId), prompt: systemPrompt });
      message.success(t('businessLogic.config.message.promptSaved'));
    } catch (error) {
      console.error(t('debug.console.savePromptFailed'), error);
      message.error(t('businessLogic.config.error.promptSaveFailed'));
    } finally {
      setIsPromptSaving(false);
    }
  };

  // 刷新工具列表
  const handleToolsRefresh = useCallback(async () => {
    if (onToolsRefresh) {
      await onToolsRefresh();
    }
  }, [onToolsRefresh]);

  const canSaveAsAgent = selectedAgents.length === 0 && 
    ((dutyContent?.trim()?.length || 0) > 0 || (constraintContent?.trim()?.length || 0) > 0 || (fewShotsContent?.trim()?.length || 0) > 0) && 
    isNewAgentInfoValid;

  // Generate more intelligent prompt information according to conditions
  const getButtonTitle = () => {
    if (selectedAgents.length > 0) {
      return t('businessLogic.config.message.noAgentSelected');
    }
    if (!(dutyContent?.trim()) && !(constraintContent?.trim()) && !(fewShotsContent?.trim())) {
      return t('businessLogic.config.message.generatePromptFirst');
    }
    if (!isNewAgentInfoValid) {
      return t('businessLogic.config.message.completeAgentInfo');
    }
    return "";
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full w-full gap-0 justify-between">
        {/* Upper part: Agent pool + Tool pool */}
        <div className="flex gap-4 flex-1 min-h-0 pb-4 pr-4 pl-4">
          {!isCreatingNewAgent && (
            <div className="w-[360px] h-full">
              <SubAgentPool
                selectedAgents={selectedAgents}
                onSelectAgent={handleAgentSelect}
                onEditAgent={(agent) => handleEditAgent(agent, t)}
                onCreateNewAgent={handleCreateNewAgent}
                onImportAgent={() => handleImportAgent(t)}
                onExportAgent={(agent) => handleExportAgent(agent, t)}
                onDeleteAgent={handleDeleteAgent}
                subAgentList={subAgentList}
                loadingAgents={loadingAgents}
                enabledAgentIds={enabledAgentIds}
                isImporting={isImporting}
              />
            </div>
          )}
          
          {isCreatingNewAgent && (
            <div className="w-[360px] h-full">
              <AgentInfoInput
                name={newAgentName}
                description={newAgentDescription}
                provideSummary={newAgentProvideSummary}
                onNameChange={setNewAgentName}
                onDescriptionChange={setNewAgentDescription}
                onProvideSummaryChange={setNewAgentProvideSummary}
                onValidationChange={setIsNewAgentInfoValid}
              />
            </div>
          )}
          
          <div className="flex-1 h-full">
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
              mainAgentId={isEditingAgent && editingAgent ? editingAgent.id : mainAgentId}
              localIsGenerating={localIsGenerating}
              onToolsRefresh={handleToolsRefresh}
            />
          </div>
        </div>

      {/* The second half: business logic description */}
      <div className="flex gap-4 flex-shrink-0 pr-4 pl-4 items-start">
        <div className="flex-1 h-full">
          <BusinessLogicInput 
            value={businessLogic} 
            onChange={setBusinessLogic} 
          />
        </div>
        <div className="flex flex-col gap-4">
          <ModelConfigPanel
            mainAgentModel={mainAgentModel}
            mainAgentMaxStep={mainAgentMaxStep}
            onModelChange={handleModelChange}
            onMaxStepChange={handleMaxStepChange}
          />
          <ActionButtons
            isPromptGenerating={isPromptGenerating}
            isPromptSaving={isPromptSaving}
            isCreatingNewAgent={isCreatingNewAgent}
            canSaveAsAgent={canSaveAsAgent}
            getButtonTitle={getButtonTitle}
            onGeneratePrompt={() => handleGenerateSystemPrompt(t)}
            onSaveAsAgent={handleSaveAsAgent}
            onCancelCreating={handleCancelCreating}
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