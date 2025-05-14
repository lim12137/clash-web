"use client";
// 定义类型

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  max_step: number;
  provide_run_summary: boolean;
  tools: Tool[];
  prompt: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  source: 'local' | 'mcp';
  initParams: ToolParam[];
}

export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  value?: any;
}
// 新增Agent弹窗Props接口
export interface AgentModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onSave: (name: string, description: string, model: string, max_step: number, provide_run_summary: boolean, prompt: string) => void;
  title: string;
  agent?: Agent | null;
  selectedTools: Tool[];
  systemPrompt?: string;
  readOnly?: boolean;
}
// 业务逻辑输入组件Props接口
export interface BusinessLogicInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedAgents: Agent[];
  systemPrompt: string;
}
// 子代理池组件Props接口
export interface SubAgentPoolProps {
  selectedAgents: Agent[];
  onSelectAgent: (agent: Agent, isSelected: boolean) => void;
  onEditAgent: (agent: Agent) => void;
  onCreateNewAgent: () => void;
}
// 工具池组件Props接口
export interface ToolPoolProps {
  selectedTools: Tool[];
  onSelectTool: (tool: Tool, isSelected: boolean) => void;
  isCreatingNewAgent?: boolean;
}
// 主组件Props接口
export interface BusinessLogicConfigProps {
  businessLogic: string;
  setBusinessLogic: (value: string) => void;
  selectedAgents: Agent[];
  setSelectedAgents: (agents: Agent[]) => void;
  selectedTools: Tool[];
  setSelectedTools: (tools: Tool[]) => void;
  onGenerateSystemPrompt: () => void;
  systemPrompt: string;
  isCreatingNewAgent: boolean;
  setIsCreatingNewAgent: (value: boolean) => void;
  mainAgentModel: string;
  setMainAgentModel: (value: string) => void;
  mainAgentMaxStep: number;
  setMainAgentMaxStep: (value: number) => void;
  mainAgentPrompt: string;
  setMainAgentPrompt: (value: string) => void;
}
