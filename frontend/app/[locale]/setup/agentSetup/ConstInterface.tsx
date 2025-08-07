"use client";

// model enum class
export enum OpenAIModel {
  MainModel = 'main_model',
  SubModel = 'sub_model'
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  max_step: number;
  provide_run_summary: boolean;
  tools: Tool[];
  duty_prompt?: string;
  constraint_prompt?: string;
  few_shots_prompt?: string;
  business_description?: string;
  is_available?: boolean;
  sub_agent_id_list?: number[]; // 添加sub_agent_id_list字段
}

// Basic agent info for list display (without detailed configuration)
export interface AgentBasicInfo {
  id: string;
  name: string;
  description: string;
  is_available: boolean;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  source: 'local' | 'mcp' | 'langchain';
  initParams: ToolParam[];
  is_available?: boolean;
  create_time?: string;
  usage?: string; // 新增：用于标注工具来源的usage字段
}

export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'OpenAIModel' | 'Optional';
  required: boolean;
  value?: any;
  description?: string;
}

// business logic input component props interface
export interface BusinessLogicInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedAgents: Agent[];
  isGenerating?: boolean;
  generationProgress?: {
    duty: boolean;
    constraint: boolean;
    few_shots: boolean;
  };
  dutyContent?: string;
  constraintContent?: string;
  fewShotsContent?: string;
}
// sub agent pool component props interface
export interface SubAgentPoolProps {
  selectedAgents: Agent[];
  onSelectAgent: (agent: Agent, isSelected: boolean) => void;
  onSelectAgentAndLoadDetail?: (agent: Agent, isSelected: boolean) => void;
  onEditAgent: (agent: Agent) => void;
  onCreateNewAgent: () => void;
  onImportAgent: () => void;
  onExportAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  subAgentList?: Agent[];
  loadingAgents?: boolean;
  enabledAgentIds?: number[];
  isImporting?: boolean;
  isEditingAgent?: boolean; // 新增：控制是否处于编辑模式
  editingAgent?: Agent | null; // 新增：当前正在编辑的agent
  parentAgentId?: number; // 新增：父agent ID，用于关联关系
  onAgentSelectionOnly?: (agent: Agent, isSelected: boolean) => void; // 新增：只更新选择状态，不调用search_info
  onRefreshAgentState?: () => void; // 新增：刷新agent状态的回调函数
  onUpdateEnabledAgentIds?: (newEnabledAgentIds: number[]) => void; // 新增：直接更新enabledAgentIds的回调函数
  isCreatingNewAgent?: boolean; // 新增：控制是否处于新建agent模式
}
// tool pool component props interface
export interface ToolPoolProps {
  selectedTools: Tool[];
  onSelectTool: (tool: Tool, isSelected: boolean) => void;
  isCreatingNewAgent?: boolean;
  tools?: Tool[];
  loadingTools?: boolean;
  mainAgentId?: string | null;
  localIsGenerating?: boolean;
  onToolsRefresh?: () => void;
}
// main component props interface
export interface BusinessLogicConfigProps {
  businessLogic: string;
  setBusinessLogic: (value: string) => void;
  selectedAgents: Agent[];
  setSelectedAgents: (agents: Agent[]) => void;
  selectedTools: Tool[];
  setSelectedTools: (tools: Tool[]) => void;
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  isCreatingNewAgent: boolean;
  setIsCreatingNewAgent: (value: boolean) => void;
  mainAgentModel: OpenAIModel;
  setMainAgentModel: (value: OpenAIModel) => void;
  mainAgentMaxStep: number;
  setMainAgentMaxStep: (value: number) => void;
  tools: Tool[];
  subAgentList?: Agent[];
  loadingAgents?: boolean;
  mainAgentId: string | null;
  setMainAgentId: (value: string | null) => void;
  setSubAgentList: (agents: Agent[]) => void;
  enabledAgentIds: number[];
  setEnabledAgentIds: (ids: number[]) => void;
  newAgentName: string;
  newAgentDescription: string;
  newAgentProvideSummary: boolean;
  setNewAgentName: (value: string) => void;
  setNewAgentDescription: (value: string) => void;
  setNewAgentProvideSummary: (value: boolean) => void;
  isNewAgentInfoValid: boolean;
  setIsNewAgentInfoValid: (value: boolean) => void;
  onEditingStateChange?: (isEditing: boolean, agent: any) => void;
  onToolsRefresh: () => void;
  dutyContent: string;
  setDutyContent: (value: string) => void;
  constraintContent: string;
  setConstraintContent: (value: string) => void;
  fewShotsContent: string;
  setFewShotsContent: (value: string) => void;
  // Add new props for agent name and description
  agentName?: string;
  setAgentName?: (value: string) => void;
  agentDescription?: string;
  setAgentDescription?: (value: string) => void;
  // Add new prop for generating agent state
  isGeneratingAgent?: boolean;
  // SystemPromptDisplay related props
  onDebug?: () => void;
  getCurrentAgentId?: () => number | undefined;
  onModelChange?: (value: string) => void;
  onMaxStepChange?: (value: number | null) => void;
  onBusinessLogicChange?: (value: string) => void;
  onGenerateAgent?: () => void;
  onSaveAgent?: () => void;
  isSavingAgent?: boolean;
  canSaveAgent?: boolean;
  getButtonTitle?: () => string;
  onExportAgent?: () => void;
  onDeleteAgent?: () => void;
  editingAgent?: any;
  onExitCreation?: () => void;
}
