"use client";

// model enum class
// TODO: this enum should not be put here
export enum OpenAIModel {
  MainModel = 'main_model',
  SubModel = 'sub_model'
}

export interface Agent {
  id: string;
  name: string;
  display_name?: string;
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
  sub_agent_id_list?: number[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  source: 'local' | 'mcp' | 'langchain';
  initParams: ToolParam[];
  is_available?: boolean;
  create_time?: string;
  usage?: string;
}

export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'OpenAIModel' | 'Optional';
  required: boolean;
  value?: any;
  description?: string;
}
