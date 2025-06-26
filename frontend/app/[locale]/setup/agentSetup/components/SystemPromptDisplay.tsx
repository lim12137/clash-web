"use client"

import { Modal, message } from 'antd'
import { useState, useRef, useEffect } from 'react'
import AdditionalRequestInput from './AdditionalRequestInput'
import { fineTunePrompt, savePrompt } from '@/services/promptService'
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

/**
 * System Prompt Display Component
 */
export default function SystemPromptDisplay({ 
  prompt, 
  onPromptChange,
  onDebug, 
  agentId, 
}: SystemPromptDisplayProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tunedPrompt, setTunedPrompt] = useState("")
  const [isTuning, setIsTuning] = useState(false)
  const originalPromptRef = useRef(prompt)
  const [localPrompt, setLocalPrompt] = useState(prompt)
  const { t } = useTranslation('common')

  useEffect(() => { 
    setLocalPrompt(prompt); 
    if (originalPromptRef.current === "" && prompt) {
      originalPromptRef.current = prompt;
    }
  }, [prompt]);

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

  // Handle manual save
  const handleSavePrompt = async () => {
    if (agentId && localPrompt !== originalPromptRef.current) {
      try {
        await savePrompt({ agent_id: agentId, prompt: localPrompt });
        originalPromptRef.current = localPrompt;
        onPromptChange(localPrompt);
        message.success(t('systemPrompt.message.save.success'));
      } catch (error) {
        console.error(t('systemPrompt.message.save.error'), error);
        message.error(t('systemPrompt.message.save.error'));
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-medium">{t('systemPrompt.title')}</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSavePrompt}
            disabled={!agentId || localPrompt === originalPromptRef.current}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: "none" }}
          >
            {t('systemPrompt.button.save')}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            {t('systemPrompt.button.tune')}
          </button>
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
        className="border border-gray-200 rounded-md"
        style={{ height: 'calc(100% - 60px)', overflowY: 'auto' }}
      >
        <MilkdownProvider>
          <PromptEditor
            value={prompt}
            onChange={setLocalPrompt}
          />
        </MilkdownProvider>
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