import { Select, InputNumber, Input } from 'antd';

interface MainAgentConfigProps {
  model: string;
  setModel: (value: string) => void;
  maxStep: number;
  setMaxStep: (value: number) => void;
  prompt: string;
  setPrompt: (value: string) => void;
}

const modelOptions = [
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
];

export default function MainAgentConfig({ model, setModel, maxStep, setMaxStep, prompt, setPrompt }: MainAgentConfigProps) {
  return (
    <div className="flex flex-col pt-4 pr-2 pl-2 pb-0">
      <h2 className="text-lg font-medium mb-2">主Agent</h2>
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <span className="block text-sm font-medium mb-1">模型</span>
          <Select
            value={model}
            onChange={setModel}
            className="w-full"
            options={modelOptions}
          />
        </div>
        <div className="flex-1">
          <span className="block text-sm font-medium mb-1">最大步骤数</span>
          <InputNumber
            min={1}
            max={50}
            value={maxStep}
            onChange={v => setMaxStep(v ?? 10)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
} 