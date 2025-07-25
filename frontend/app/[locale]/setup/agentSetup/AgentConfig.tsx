"use client"

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import BusinessLogicConfig from './AgentManagementConfig'
import SystemPromptDisplay from './components/SystemPromptDisplay'
import DebugConfig from './DebugConfig'
import GuideSteps from './components/GuideSteps'
import { Row, Col, Drawer, message } from 'antd'
import { fetchTools, fetchAgentList } from '@/services/agentConfigService'
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
  const [enabledToolIds, setEnabledToolIds] = useState<number[]>([])
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

  // Only auto scan once flag
  const hasAutoScanned = useRef(false)

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
        setSubAgentList(result.data.subAgentList);
        setMainAgentId(result.data.mainAgentId ? String(result.data.mainAgentId) : null);
        setEnabledToolIds(result.data.enabledToolIds);
        setEnabledAgentIds(result.data.enabledAgentIds);
        
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
          setDutyContent(result.data.dutyPrompt);
        }
        if (result.data.constraintPrompt) {
          setConstraintContent(result.data.constraintPrompt);
        }
        if (result.data.fewShotsPrompt) {
          setFewShotsContent(result.data.fewShotsPrompt);
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

  // When the tool list is loaded, check and set the enabled tools
  useEffect(() => {
    if (tools.length > 0 && enabledToolIds.length > 0) {
      const enabledTools = tools.filter(tool => 
        enabledToolIds.includes(Number(tool.id))
      );
      setSelectedTools(enabledTools);
      setCurrentGuideStep(undefined);
    }
  }, [tools, enabledToolIds]);

  // When the agent list is loaded, check and set the selected agents
  useEffect(() => {
    if (subAgentList.length > 0 && enabledAgentIds.length > 0) {
      const enabledAgents = subAgentList.filter(agent => 
        enabledAgentIds.includes(Number(agent.id))
      );
      setSelectedAgents(enabledAgents);
      setCurrentGuideStep(undefined);
    }
  }, [subAgentList, enabledAgentIds]);

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
    // Reset the main agent configuration related status
    if (!isCreatingNewAgent) {
      setMainAgentModel(OpenAIModel.MainModel);
      setMainAgentMaxStep(5);
    }
  }, [isCreatingNewAgent]);

  const handleEditingStateChange = (isEditing: boolean, agent: any) => {
    setIsEditingAgent(isEditing)
    setEditingAgent(agent)
  }

  const getCurrentAgentId = () => {
    if (isEditingAgent && editingAgent) {
      return parseInt(editingAgent.id)
    }
    return mainAgentId ? parseInt(mainAgentId) : undefined
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
                  dutyContent={dutyContent}
                  constraintContent={constraintContent}
                  fewShotsContent={fewShotsContent}
                  onDutyContentChange={setDutyContent}
                  onConstraintContentChange={setConstraintContent}
                  onFewShotsContentChange={setFewShotsContent}
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