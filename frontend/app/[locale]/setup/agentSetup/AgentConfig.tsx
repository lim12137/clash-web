"use client"

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import BusinessLogicConfig from './AgentManagementConfig'
import SystemPromptDisplay from './components/SystemPromptDisplay'
import DebugConfig from './DebugConfig'
import GuideSteps from './components/GuideSteps'
import { Row, Col, Drawer, message } from 'antd'
import { fetchTools, fetchAgentList, fetchAgentDetail, exportAgent, deleteAgent, updateAgent } from '@/services/agentConfigService'
import { generatePromptStream } from '@/services/promptService'
import { OpenAIModel } from '@/app/setup/agentSetup/ConstInterface'
import { updateToolList } from '@/services/mcpService'
import { 
  SETUP_PAGE_CONTAINER, 
  THREE_COLUMN_LAYOUT,
  STANDARD_CARD,
  CARD_HEADER 
} from '@/lib/layoutConstants'
import '../../i18n'

// Layout Height Constant Configuration
const LAYOUT_CONFIG = {
  CARD_HEADER_PADDING: "10px 24px",
  CARD_BODY_PADDING: "12px 20px",
  DRAWER_WIDTH: "40%",
}

/**
 * Agent configuration main component
 */
export default function AgentConfig() {
  const { t } = useTranslation('common')
  const [businessLogic, setBusinessLogic] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [selectedAgents, setSelectedAgents] = useState<any[]>([])
  const [selectedTools, setSelectedTools] = useState<any[]>([])
  const [testQuestion, setTestQuestion] = useState("")
  const [testAnswer, setTestAnswer] = useState("")
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false)
  const [isCreatingNewAgent, setIsCreatingNewAgent] = useState(false)
  const [mainAgentModel, setMainAgentModel] = useState(OpenAIModel.MainModel)
  const [mainAgentMaxStep, setMainAgentMaxStep] = useState(5)
  const [tools, setTools] = useState<any[]>([])
  const [mainAgentId, setMainAgentId] = useState<string | null>(null)
  const [subAgentList, setSubAgentList] = useState<any[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)

  const [enabledAgentIds, setEnabledAgentIds] = useState<number[]>([])
  const [currentGuideStep, setCurrentGuideStep] = useState<number | undefined>(undefined)
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentDescription, setNewAgentDescription] = useState("")
  const [newAgentProvideSummary, setNewAgentProvideSummary] = useState(true)
  const [isNewAgentInfoValid, setIsNewAgentInfoValid] = useState(false)
  const [isEditingAgent, setIsEditingAgent] = useState(false)
  const [editingAgent, setEditingAgent] = useState<any>(null)
  
  // Add state for three segmented content sections
  const [dutyContent, setDutyContent] = useState("")
  const [constraintContent, setConstraintContent] = useState("")
  const [fewShotsContent, setFewShotsContent] = useState("")

  // Add state for agent name and description
  const [agentName, setAgentName] = useState("")
  const [agentDescription, setAgentDescription] = useState("")

  // Add state for business logic and action buttons
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false)
  const [isSavingAgent, setIsSavingAgent] = useState(false)

  // Only auto scan once flag
  const hasAutoScanned = useRef(false)

  // Handle business logic change
  const handleBusinessLogicChange = (value: string) => {
    setBusinessLogic(value)
  }

  // Handle generate agent
  const handleGenerateAgent = async () => {
    if (!businessLogic || businessLogic.trim() === '') {
      message.warning(t('businessLogic.config.error.businessDescriptionRequired'))
      return
    }

    const currentAgentId = getCurrentAgentId()
    if (!currentAgentId) {
      message.error(t('businessLogic.config.error.noAgentId'))
      return
    }

    setIsGeneratingAgent(true)
    try {
      // 调用后端API生成智能体提示词
      await generatePromptStream(
        {
          agent_id: Number(currentAgentId),
          task_description: businessLogic
        },
        (data) => {
          // 处理流式响应数据
          switch (data.type) {
            case 'duty':
              setDutyContent(data.content)
              break
            case 'constraint':
              setConstraintContent(data.content)
              break
            case 'few_shots':
              setFewShotsContent(data.content)
              break
          }
        },
        (error) => {
          console.error('Generate prompt stream error:', error)
          message.error(t('businessLogic.config.message.generateError'))
        },
        () => {
          message.success(t('businessLogic.config.message.generateSuccess'))
        }
      )
    } catch (error) {
      console.error('Generate agent error:', error)
      message.error(t('businessLogic.config.message.generateError'))
    } finally {
      setIsGeneratingAgent(false)
    }
  }

  // Handle save agent
  const handleSaveAgent = async () => {
    if (!canSaveAgent) {
      message.warning(getButtonTitle())
      return
    }

    const currentAgentId = getCurrentAgentId()
    if (!currentAgentId) {
      message.error(t('businessLogic.config.error.noAgentId'))
      return
    }

    setIsSavingAgent(true)
    try {
      // 调用实际的保存API
      const result = await updateAgent(
        Number(currentAgentId),
        agentName,
        agentDescription,
        mainAgentModel,
        mainAgentMaxStep,
        true, // provide_run_summary
        true, // enabled - 保存到agent池时启用
        businessLogic,
        dutyContent,
        constraintContent,
        fewShotsContent
      )

      if (result.success) {
        const actionText = isCreatingNewAgent ? t('agent.action.create') : t('agent.action.modify')
        message.success(t('businessLogic.config.message.agentCreated', { name: agentName, action: actionText }))

        // 重置状态
        setIsCreatingNewAgent(false)
        setIsEditingAgent(false)
        setEditingAgent(null)
        setBusinessLogic('')
        setDutyContent('')
        setConstraintContent('')
        setFewShotsContent('')
        setAgentName('')
        setAgentDescription('')
        setSelectedTools([])

        // 通知父组件状态变化
        handleEditingStateChange(false, null)

        // 刷新agent列表
        fetchAgents()
      } else {
        message.error(result.message || t('businessLogic.config.error.saveFailed'))
      }
    } catch (error) {
      console.error('Save agent error:', error)
      message.error(t('businessLogic.config.error.saveFailed'))
    } finally {
      setIsSavingAgent(false)
    }
  }

  // Handle export agent
  const handleExportAgent = async () => {
    if (!editingAgent) {
      message.warning(t('agent.error.noAgentSelected'))
      return
    }

    try {
      const result = await exportAgent(editingAgent)
      if (result.success) {
        message.success(t('businessLogic.config.error.agentExportSuccess'))
      } else {
        message.error(result.message || t('businessLogic.config.error.agentExportFailed'))
      }
    } catch (error) {
      console.error(t('debug.console.exportAgentFailed'), error)
      message.error(t('businessLogic.config.error.agentExportFailed'))
    }
  }

  // Handle delete agent
  const handleDeleteAgent = async () => {
    if (!editingAgent) {
      message.warning(t('agent.error.noAgentSelected'))
      return
    }

    try {
      const result = await deleteAgent(Number(editingAgent.id))
      if (result.success) {
        message.success(t('businessLogic.config.message.agentDeleteSuccess', { name: editingAgent.name }))
        // Reset editing state
        setIsEditingAgent(false)
        setEditingAgent(null)
        setBusinessLogic("")
        setDutyContent("")
        setConstraintContent("")
        setFewShotsContent("")
        setAgentName("")
        setAgentDescription("")
        // Refresh agent list
        fetchAgents()
      } else {
        message.error(result.message || t('businessLogic.config.message.agentDeleteFailed'))
      }
    } catch (error) {
      console.error(t('debug.console.deleteAgentFailed'), error)
      message.error(t('businessLogic.config.message.agentDeleteFailed'))
    }
  }

  // Get button title
  const getButtonTitle = () => {
    if (!businessLogic || businessLogic.trim() === '') {
      return t('businessLogic.config.message.businessDescriptionRequired')
    }
    if (!(dutyContent?.trim()) && !(constraintContent?.trim()) && !(fewShotsContent?.trim())) {
      return t('businessLogic.config.message.generatePromptFirst')
    }
    if (!agentName || agentName.trim() === '') {
      return t('businessLogic.config.message.completeAgentInfo')
    }
    return ""
  }

  // Check if can save agent
  const canSaveAgent = !!(businessLogic?.trim() && agentName?.trim() && (dutyContent?.trim() || constraintContent?.trim() || fewShotsContent?.trim()))

  // Load tools when page is loaded
  useEffect(() => {
    const loadTools = async () => {
      try {
        const result = await fetchTools()
        if (result.success) {
          setTools(result.data)
          // If the tool list is empty and auto scan hasn't been triggered, trigger scan once
          if (result.data.length === 0 && !hasAutoScanned.current) {
            hasAutoScanned.current = true
            // Mark as auto scanned
            const scanResult = await updateToolList()
            if (!scanResult.success) {
              message.error(t('toolManagement.message.refreshFailed'))
              return
            }
            message.success(t('toolManagement.message.refreshSuccess'))
            // After scan, fetch the tool list again
            const reFetch = await fetchTools()
            if (reFetch.success) {
              setTools(reFetch.data)
            }
          }
        } else {
          message.error(result.message)
        }
      } catch (error) {
        console.error(t('agent.error.loadTools'), error)
        message.error(t('agent.error.loadToolsRetry'))
      }
    }
    
    loadTools()
  }, [t])

  // get agent list
  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const result = await fetchAgentList();
      if (result.success) {
        // fetchAgentList now returns AgentBasicInfo[], so we just set the subAgentList
        setSubAgentList(result.data);
        // Clear other states since we don't have detailed info yet
        setMainAgentId(null);
        // 不再手动清空enabledAgentIds，完全依赖后端返回的sub_agent_id_list
        setMainAgentModel(OpenAIModel.MainModel);
        setMainAgentMaxStep(5);
        setBusinessLogic('');
        setDutyContent('');
        setConstraintContent('');
        setFewShotsContent('');
        // Clear agent name and description only when not in editing mode
        if (!isEditingAgent) {
          setAgentName('');
          setAgentDescription('');
        }
      } else {
        message.error(result.message || t('agent.error.fetchAgentList'));
      }
    } catch (error) {
      console.error(t('agent.error.fetchAgentList'), error);
      message.error(t('agent.error.fetchAgentListRetry'));
    } finally {
      setLoadingAgents(false);
    }
  };
  

  // get agent list when component is loaded
  useEffect(() => {
    fetchAgents();
  }, []);

  // add event listener to respond to the data request from the main page
  useEffect(() => {
    const handleGetAgentConfigData = () => {
      // Check if there is system prompt content
      let hasSystemPrompt = false;
      
      // If any of the segmented prompts has content, consider it as having system prompt
      if (dutyContent && dutyContent.trim() !== '') {
        hasSystemPrompt = true;
      } else if (constraintContent && constraintContent.trim() !== '') {
        hasSystemPrompt = true;
      } else if (fewShotsContent && fewShotsContent.trim() !== '') {
        hasSystemPrompt = true;
      }
      
      // send the current configuration data to the main page
      window.dispatchEvent(new CustomEvent('agentConfigDataResponse', {
        detail: {
          businessLogic: businessLogic,
          systemPrompt: hasSystemPrompt ? 'has_content' : ''
        }
      }));
    };

    window.addEventListener('getAgentConfigData', handleGetAgentConfigData);

    return () => {
      window.removeEventListener('getAgentConfigData', handleGetAgentConfigData);
    };
  }, [businessLogic, dutyContent, constraintContent, fewShotsContent]);



  // 移除前端缓存逻辑，完全依赖后端返回的sub_agent_id_list
  // 不再需要根据enabledAgentIds来设置selectedAgents

  // Monitor the status change of creating a new agent, and reset the relevant status
  useEffect(() => {
    // Reset all states to initial values
    setBusinessLogic('');
    setSystemPrompt('');
    setSelectedAgents([]);
    setSelectedTools([]);
    setTestQuestion('');
    setTestAnswer('');
    setCurrentGuideStep(undefined);
    // Reset agent info states
    setNewAgentName('');
    setNewAgentDescription('');
    setNewAgentProvideSummary(true);
    setIsNewAgentInfoValid(false);
    // Reset agent name and description only when not in editing mode
    if (!isEditingAgent) {
      setAgentName('');
      setAgentDescription('');
    }
    // Reset the main agent configuration related status
    if (!isCreatingNewAgent) {
      setMainAgentModel(OpenAIModel.MainModel);
      setMainAgentMaxStep(5);
    }
  }, [isCreatingNewAgent]);

  const handleEditingStateChange = (isEditing: boolean, agent: any) => {
    console.log('handleEditingStateChange called:', isEditing, agent);
    setIsEditingAgent(isEditing)
    setEditingAgent(agent)
    
    // 当开始编辑agent时，设置agent的名称和描述到右侧的名称描述框
    if (isEditing && agent) {
      console.log('Setting agent name and description:', agent.name, agent.description);
      setAgentName(agent.name || '')
      setAgentDescription(agent.description || '')
    } else if (!isEditing) {
      // 当停止编辑时，清空名称描述框
      console.log('Clearing agent name and description');
      setAgentName('')
      setAgentDescription('')
    }
  }

  const getCurrentAgentId = () => {
    if (isEditingAgent && editingAgent) {
      return parseInt(editingAgent.id)
    }
    return mainAgentId ? parseInt(mainAgentId) : undefined
  }

  // Handle model change with proper type conversion
  const handleModelChange = (value: string) => {
    setMainAgentModel(value as OpenAIModel)
  }

  // Handle max step change with proper type conversion
  const handleMaxStepChange = (value: number | null) => {
    if (value !== null) {
      setMainAgentMaxStep(value)
    }
  }

  // Refresh tool list
  const handleToolsRefresh = async () => {
    try {
      const result = await fetchTools()
      if (result.success) {
        setTools(result.data)
        message.success(t('agentConfig.tools.refreshSuccess'))
      } else {
        message.error(t('agentConfig.tools.refreshFailed'))
      }
    } catch (error) {
      console.error(t('agentConfig.debug.refreshToolsFailed'), error)
      message.error(t('agentConfig.tools.refreshFailed'))
    }
  }

  return (
    <div className="w-full h-full mx-auto" style={{ 
      maxWidth: SETUP_PAGE_CONTAINER.MAX_WIDTH,
      padding: `0 ${SETUP_PAGE_CONTAINER.HORIZONTAL_PADDING}`
    }}>
      <div className="w-full h-full">
        <Row gutter={THREE_COLUMN_LAYOUT.GUTTER} className="h-full">
          {/* Left Timeline Guide */}
          <Col xs={24} md={24} lg={4} xl={4} className="h-full">
            <div className="bg-white border border-gray-200 rounded-md flex flex-col overflow-hidden" style={{
              height: SETUP_PAGE_CONTAINER.MAIN_CONTENT_HEIGHT,
              padding: STANDARD_CARD.PADDING,
              overflowY: "auto",
              overflowX: "hidden"
            }}>
                <GuideSteps
                  isCreatingNewAgent={isCreatingNewAgent}
                  systemPrompt={systemPrompt}
                  businessLogic={businessLogic}
                  selectedTools={selectedTools}
                  selectedAgents={selectedAgents}
                  mainAgentId={mainAgentId}
                  currentStep={currentGuideStep}
                  agentName={newAgentName}
                  agentDescription={newAgentDescription}
                  agentProvideSummary={newAgentProvideSummary}
                />
            </div>
          </Col>

          {/* Middle Panel - Business Logic Configuration */}
          <Col xs={24} md={24} lg={13} xl={13}>
            <div className="bg-white border border-gray-200 rounded-md flex flex-col overflow-hidden" style={{
              height: SETUP_PAGE_CONTAINER.MAIN_CONTENT_HEIGHT,
              padding: STANDARD_CARD.PADDING,
              overflowY: "auto",
              overflowX: "hidden"
            }}>
                <BusinessLogicConfig 
                  businessLogic={businessLogic}
                  setBusinessLogic={setBusinessLogic}
                  selectedAgents={selectedAgents}
                  setSelectedAgents={setSelectedAgents}
                  selectedTools={selectedTools}
                  setSelectedTools={setSelectedTools}
                  systemPrompt={systemPrompt}
                  setSystemPrompt={setSystemPrompt}
                  isCreatingNewAgent={isCreatingNewAgent}
                  setIsCreatingNewAgent={setIsCreatingNewAgent}
                  mainAgentModel={mainAgentModel}
                  setMainAgentModel={setMainAgentModel}
                  mainAgentMaxStep={mainAgentMaxStep}
                  setMainAgentMaxStep={setMainAgentMaxStep}
                  tools={tools}
                  subAgentList={subAgentList}
                  loadingAgents={loadingAgents}
                  mainAgentId={mainAgentId}
                  setMainAgentId={setMainAgentId}
                  setSubAgentList={setSubAgentList}
                  enabledAgentIds={enabledAgentIds}
                  setEnabledAgentIds={setEnabledAgentIds}
                  newAgentName={newAgentName}
                  newAgentDescription={newAgentDescription}
                  newAgentProvideSummary={newAgentProvideSummary}
                  setNewAgentName={setNewAgentName}
                  setNewAgentDescription={setNewAgentDescription}
                  setNewAgentProvideSummary={setNewAgentProvideSummary}
                  isNewAgentInfoValid={isNewAgentInfoValid}
                  setIsNewAgentInfoValid={setIsNewAgentInfoValid}
                  onEditingStateChange={handleEditingStateChange}
                  onToolsRefresh={handleToolsRefresh}
                  dutyContent={dutyContent}
                  setDutyContent={setDutyContent}
                  constraintContent={constraintContent}
                  setConstraintContent={setConstraintContent}
                  fewShotsContent={fewShotsContent}
                  setFewShotsContent={setFewShotsContent}
                  agentName={agentName}
                  setAgentName={setAgentName}
                  agentDescription={agentDescription}
                  setAgentDescription={setAgentDescription}
                  isGeneratingAgent={isGeneratingAgent}
                />
            </div>
          </Col>
          
          {/* Right Panel - System Prompt Word Configuration */}
          <Col xs={24} md={24} lg={7} xl={7}>
            <div className="bg-white border border-gray-200 rounded-md flex flex-col overflow-hidden" style={{
              height: SETUP_PAGE_CONTAINER.MAIN_CONTENT_HEIGHT,
              padding: STANDARD_CARD.PADDING,
              overflowY: "auto",
              overflowX: "hidden"
            }}>
                <SystemPromptDisplay
                  onDebug={() => {
                    setIsDebugDrawerOpen(true);
                    setCurrentGuideStep(isCreatingNewAgent ? 5 : 5);
                  }}
                  agentId={getCurrentAgentId()}
                  businessLogic={businessLogic}
                  dutyContent={dutyContent}
                  constraintContent={constraintContent}
                  fewShotsContent={fewShotsContent}
                  onDutyContentChange={setDutyContent}
                  onConstraintContentChange={setConstraintContent}
                  onFewShotsContentChange={setFewShotsContent}
                  agentName={agentName}
                  agentDescription={agentDescription}
                  onAgentNameChange={setAgentName}
                  onAgentDescriptionChange={setAgentDescription}
                  isEditingMode={isEditingAgent || isCreatingNewAgent}
                  mainAgentModel={mainAgentModel}
                  mainAgentMaxStep={mainAgentMaxStep}
                  onModelChange={handleModelChange}
                  onMaxStepChange={handleMaxStepChange}
                  // Add new props for business logic and action buttons
                  onBusinessLogicChange={handleBusinessLogicChange}
                  onGenerateAgent={handleGenerateAgent}
                  onSaveAgent={handleSaveAgent}
                  isGeneratingAgent={isGeneratingAgent}
                  isSavingAgent={isSavingAgent}
                  isCreatingNewAgent={isCreatingNewAgent}
                  canSaveAgent={canSaveAgent}
                  getButtonTitle={getButtonTitle}
                  onExportAgent={handleExportAgent}
                  onDeleteAgent={handleDeleteAgent}
                  editingAgent={editingAgent}
                />
            </div>
          </Col>
        </Row>
      </div>

      {/* Commissioning drawer */}
      <Drawer
        title={t('agent.debug.title')}
        placement="right"
        onClose={() => setIsDebugDrawerOpen(false)}
        open={isDebugDrawerOpen}
        width={LAYOUT_CONFIG.DRAWER_WIDTH}
        styles={{
          body: {
            padding: 0,
            height: '100%',
            overflow: 'hidden'
          }
        }}
      >
        <div className="h-full">
          <DebugConfig 
            testQuestion={testQuestion}
            setTestQuestion={setTestQuestion}
            testAnswer={testAnswer}
            setTestAnswer={setTestAnswer}
            agentId={getCurrentAgentId()}
          />
        </div>
      </Drawer>
    </div>
  )
} 