"use client"

import { Modal, message } from 'antd'
import { useState, useRef, useEffect } from 'react'
import AdditionalRequestInput from './AdditionalRequestInput'
import { fineTunePrompt, savePrompt } from '@/services/promptService'
import { updateAgent } from '@/services/agentConfigService'
import { useTranslation } from 'react-i18next'

// Milkdown imports
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react'
import { defaultValueCtx, Editor, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { nord } from '@milkdown/theme-nord'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import './milkdown-nord.css'

// System prompt display component Props interface
export interface SystemPromptDisplayProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onDebug?: () => void;
  agentId?: number;
  dutyContent?: string;
  constraintContent?: string;
  fewShotsContent?: string;
  onDutyContentChange?: (content: string) => void;
  onConstraintContentChange?: (content: string) => void;
  onFewShotsContentChange?: (content: string) => void;
}

// Milkdown Editor Component
const PromptEditor = ({ value, onChange, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => {
  const { get } = useEditor((root) => {
    return Editor
      .make()
      .config(ctx => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, value || '')

        // Configure listener for content changes
        const listenerManager = ctx.get(listenerCtx)
        listenerManager.markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown && onChange) {
            onChange(markdown)
          }
        })
      })
      .config(nord)
      .use(commonmark)
      .use(listener)
  }, [value])

  return (
    <div className="milkdown-editor-container h-full">
      <Milkdown />
    </div>
  )
}

// Card component
const PromptCard = ({ title, content, index, onChange }: {
  title: string;
  content: string;
  index: number;
  onChange?: (value: string) => void;
}) => {
  if (!content.trim()) return null;

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200">
      {/* Card header */}
      <div className="bg-gray-50 text-gray-700 px-4 py-3 rounded-t-lg border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
            {index}
          </div>
          <h3 className="text-lg font-medium">{title}</h3>
        </div>
      </div>
      
      {/* Card content */}
      <div className="flex-1 pt-1 pb-1 px-3">
        <div className="h-full overflow-y-auto">
          <MilkdownProvider>
            <PromptEditor
              value={content}
              onChange={onChange || (() => {})}
            />
          </MilkdownProvider>
        </div>
      </div>
    </div>
  );
};

/**
 * System Prompt Display Component
 */
export default function SystemPromptDisplay({ 
  prompt, 
  onPromptChange,
  onDebug, 
  agentId,
  dutyContent = '',
  constraintContent = '',
  fewShotsContent = '',
  onDutyContentChange,
  onConstraintContentChange,
  onFewShotsContentChange
}: SystemPromptDisplayProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tunedPrompt, setTunedPrompt] = useState("")
  const [isTuning, setIsTuning] = useState(false)
  const originalPromptRef = useRef(prompt)
  const [localPrompt, setLocalPrompt] = useState(prompt)
  
  // Add local state to track content of three sections
  const [localDutyContent, setLocalDutyContent] = useState(dutyContent)
  const [localConstraintContent, setLocalConstraintContent] = useState(constraintContent)
  const [localFewShotsContent, setLocalFewShotsContent] = useState(fewShotsContent)
  
  // Add references to original content
  const originalDutyContentRef = useRef(dutyContent)
  const originalConstraintContentRef = useRef(constraintContent)
  const originalFewShotsContentRef = useRef(fewShotsContent)
  
  const { t } = useTranslation('common')

  useEffect(() => { 
    setLocalPrompt(prompt); 
    if (originalPromptRef.current === "" && prompt) {
      originalPromptRef.current = prompt;
    }
  }, [prompt]);

  // Update local state and original references
  useEffect(() => {
    setLocalDutyContent(dutyContent);
    setLocalConstraintContent(constraintContent);
    setLocalFewShotsContent(fewShotsContent);
    
    // Update original references
    if (originalDutyContentRef.current === "" && dutyContent) {
      originalDutyContentRef.current = dutyContent;
    }
    if (originalConstraintContentRef.current === "" && constraintContent) {
      originalConstraintContentRef.current = constraintContent;
    }
    if (originalFewShotsContentRef.current === "" && fewShotsContent) {
      originalFewShotsContentRef.current = fewShotsContent;
    }
  }, [dutyContent, constraintContent, fewShotsContent]);

  // Check if there are segmented content sections
  const hasSections = dutyContent || constraintContent || fewShotsContent;

  // Render card view
  const renderCardView = () => {
    if (!hasSections) {
      return (
        <div className="bg-white">
          <MilkdownProvider>
            <PromptEditor
              value={localPrompt}
              onChange={setLocalPrompt}
            />
          </MilkdownProvider>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <PromptCard
          title={t('systemPrompt.card.duty.title')}
          content={localDutyContent}
          index={1}
          onChange={setLocalDutyContent}
        />
        <PromptCard
          title={t('systemPrompt.card.constraint.title')}
          content={localConstraintContent}
          index={2}
          onChange={setLocalConstraintContent}
        />
        <PromptCard
          title={t('systemPrompt.card.fewShots.title')}
          content={localFewShotsContent}
          index={3}
          onChange={setLocalFewShotsContent}
        />
      </div>
    );
  };

  // Handle fine-tuning request
  const handleSendAdditionalRequest = async (request: string) => {
    if (!prompt) {
      message.warning(t('systemPrompt.message.empty'));
      return;
    }
    
    if (!request || request.trim() === '') {
      message.warning(t('systemPrompt.message.emptyTuning'));
      return;
    }

    setIsTuning(true);
    
    try {
      // Use service for fine-tuning
      const result = await fineTunePrompt({
        agent_id: agentId!,
        system_prompt: prompt,
        command: request
      });
      
      setTunedPrompt(result);
      message.success(t('systemPrompt.message.tune.success'));
    } catch (error) {
      console.error(t('systemPrompt.message.tune.error'), error);
      message.error(`${t('systemPrompt.message.tune.error')} ${error instanceof Error ? error.message : t('error.unknown')}`);
    } finally {
      setIsTuning(false);
    }
  };
  
  const handleSaveTunedPrompt = async () => {
    try {
      if (!agentId) {
        message.warning(t('systemPrompt.message.noAgentId'));
        return;
      }
      // Call save interface
      await savePrompt({
        agent_id: agentId,
        prompt: tunedPrompt
      });
      onPromptChange(tunedPrompt);
      setIsModalOpen(false);
      setTunedPrompt("");
      message.success(t('systemPrompt.message.save.success'));
    } catch (error) {
      console.error(t('systemPrompt.message.save.error'), error);
      message.error(t('systemPrompt.message.save.error'));
    }
  };

  // Check if there are content changes
  const hasContentChanges = () => {
    if (hasSections) {
      // Check if content of three sections has changed
      return localDutyContent !== originalDutyContentRef.current ||
             localConstraintContent !== originalConstraintContentRef.current ||
             localFewShotsContent !== originalFewShotsContentRef.current;
    } else {
      // Check if complete prompt has changed
      return localPrompt !== originalPromptRef.current;
    }
  };

  // Handle manual save
  const handleSavePrompt = async () => {
    if (!agentId) return;
    
    try {
      if (hasSections) {
        // Save content of three sections
        const result = await updateAgent(
          Number(agentId),
          undefined, // name
          undefined, // description
          undefined, // modelName
          undefined, // maxSteps
          undefined, // provideRunSummary
          undefined, // enabled
          undefined, // businessDescription
          localDutyContent,
          localConstraintContent,
          localFewShotsContent
        );
        
        if (result.success) {
          // Update original references
          originalDutyContentRef.current = localDutyContent;
          originalConstraintContentRef.current = localConstraintContent;
          originalFewShotsContentRef.current = localFewShotsContent;
          
          // Notify parent component that content has been updated
          onDutyContentChange?.(localDutyContent);
          onConstraintContentChange?.(localConstraintContent);
          onFewShotsContentChange?.(localFewShotsContent);
        } else {
          throw new Error(result.message);
        }
      } else {
        // Save complete prompt
        await savePrompt({ agent_id: agentId, prompt: localPrompt });
        originalPromptRef.current = localPrompt;
        onPromptChange(localPrompt);
      }
      
      message.success(t('systemPrompt.message.save.success'));
    } catch (error) {
      console.error(t('systemPrompt.message.save.error'), error);
      message.error(t('systemPrompt.message.save.error'));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <h2 className="text-lg font-medium"></h2>
        <div className="flex gap-2">
          <button
            onClick={handleSavePrompt}
            disabled={!agentId || !hasContentChanges()}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: "none" }}
          >
            {t('systemPrompt.button.save')}
          </button>
          {/* Hide tune button temporarily*/}
          {/* 
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            {t('systemPrompt.button.tune')}
          </button>
          */}
          <button
            onClick={onDebug}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            {t('systemPrompt.button.debug')}
          </button>
        </div>
      </div>
      <div 
        className="flex-1 border border-gray-200 rounded-md overflow-y-auto"
        style={{
          scrollbarWidth: 'none', /* Firefox */
          msOverflowStyle: 'none', /* Internet Explorer 10+ */
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }
        `}</style>
        {renderCardView()}
      </div>
      <Modal
        title={t('systemPrompt.modal.title')}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setTunedPrompt("")
        }}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <div className="flex flex-col">
          <AdditionalRequestInput 
            onSend={handleSendAdditionalRequest} 
            isTuning={isTuning}
          />

          {tunedPrompt && !isTuning && (
            <div className="mt-4">
              <div className="font-medium text-gray-700 mb-2">{t('systemPrompt.modal.result')}</div>
              <div className="border border-gray-200 rounded-md" style={{ height: '400px', overflowY: 'auto' }}>
                <MilkdownProvider>
                  <PromptEditor
                    value={tunedPrompt}
                    onChange={setTunedPrompt}
                  />
                </MilkdownProvider>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveTunedPrompt}
                  className="px-4 py-1.5 rounded-md flex items-center text-sm bg-blue-500 text-white hover:bg-blue-600"
                  style={{ border: "none" }}
                >
                  {t('systemPrompt.modal.button.save')}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
} 