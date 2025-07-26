"use client"

import { Modal, message, Badge, Button } from 'antd'
import { ExpandAltOutlined, SaveOutlined, BugOutlined } from '@ant-design/icons'
import { useState, useRef, useEffect, useCallback } from 'react'
import AdditionalRequestInput from './AdditionalRequestInput'
import { fineTunePrompt, savePrompt } from '@/services/promptService'
import { updateAgent } from '@/services/agentConfigService'
import { useTranslation } from 'react-i18next'

// Milkdown imports
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react'
import { defaultValueCtx, Editor, editorViewCtx, parserCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { nord } from '@milkdown/theme-nord'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import './milkdown-nord.css'

// System prompt display component Props interface
export interface SystemPromptDisplayProps {
  onDebug?: () => void;
  agentId?: number;
  dutyContent?: string;
  constraintContent?: string;
  fewShotsContent?: string;
  onDutyContentChange?: (content: string) => void;
  onConstraintContentChange?: (content: string) => void;
  onFewShotsContentChange?: (content: string) => void;
}

// Debounce utility function
const useDebounce = (callback: (...args: any[]) => void, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay])
}

// Milkdown Editor Component
const PromptEditor = ({ value, onChange, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => {
  const [internalValue, setInternalValue] = useState(value)
  const isUserEditingRef = useRef(false)
  const lastExternalValueRef = useRef(value)
  const debouncedOnChange = useDebounce(onChange, 300)
  
  // 处理用户输入变化
  const handleUserChange = useCallback((newValue: string) => {
    isUserEditingRef.current = true
    setInternalValue(newValue)
    debouncedOnChange(newValue)
    setTimeout(() => {
      isUserEditingRef.current = false
    }, 500)
  }, [debouncedOnChange])
  
  // 处理外部值变化 - API流式输出
  useEffect(() => {
    if (value !== lastExternalValueRef.current && !isUserEditingRef.current) {
      setInternalValue(value)
      lastExternalValueRef.current = value
    }
  }, [value])

  const { get } = useEditor((root) => {
    return Editor
      .make()
      .config(ctx => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, value || '')

        // Configure listener for content changes
        const listenerManager = ctx.get(listenerCtx)
        listenerManager.markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            handleUserChange(markdown)
          }
        })
      })
      .config(nord)
      .use(commonmark)
      .use(listener)
  }, []) // 只在组件挂载时创建一次

  // 当外部值变化时，直接更新编辑器内容，不重新创建编辑器
  useEffect(() => {
    const editor = get()
  
    if (editor && value !== internalValue && !isUserEditingRef.current) {
      try {
        editor.action(ctx => {
          const parser = ctx.get(parserCtx);
          const parsedNode = parser(value || '') || '';
          const newFragment = parsedNode.content; 

          const view = ctx.get(editorViewCtx);
          view.dispatch(
            view.state.tr.replaceWith(
              0,
              view.state.doc.content.size,
              newFragment
            )
          );
        })
        setInternalValue(value || '')
        lastExternalValueRef.current = value || ''
      } catch (error) {
        console.warn('Failed to update editor content directly:', error)
        setInternalValue(value || '')
        lastExternalValueRef.current = value || ''
      }
    }
  }, [value, internalValue, get])

  return (
    <div className="milkdown-editor-container h-full">
      <Milkdown />
    </div>
  )
}

// Card component
const PromptCard = ({ title, content, index, onChange, onExpand }: {
  title: string;
  content: string;
  index: number;
  onChange?: (value: string) => void;
  onExpand?: (title: string, content: string, index: number) => void;
}) => {
  const { t } = useTranslation('common');

  const getBadgeProps = (index: number): { status?: 'success' | 'warning' | 'error' | 'default', color?: string } => {
    switch(index) {
      case 1:
        return { status: 'success' };  // 绿色
      case 2:
        return { status: 'warning' };  // 黄色
      case 3:
        return { color: '#1677ff' };   // 蓝色
      default:
        return { status: 'default' };
    }
  };

  return (
    <div className="h-full flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200">
      {/* Card header */}
      <div className="bg-gray-50 text-gray-700 px-4 py-2 rounded-t-lg border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Badge
              {...getBadgeProps(index)}
              className="mr-3"
            />
            <h3 className="text-base font-medium">{title}</h3>
          </div>
          <button
            onClick={() => onExpand?.(title, content, index)}
            className="text-gray-500 hover:text-gray-700 transition-colors duration-200 p-1 rounded"
            title={t('systemPrompt.button.expand')}
          >
            <ExpandAltOutlined />
          </button>
        </div>
      </div>
      
      {/* Card content */}
      <div className="flex-1 min-h-0 pt-1 pb-1 px-3">
        <div 
          className="h-full overflow-y-auto"
          style={{
            scrollbarWidth: 'none',  /* Firefox */
            msOverflowStyle: 'none',  /* IE and Edge */
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;  /* Chrome, Safari, Opera */
            }
          `}</style>
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
const PADDING_X = 16; // px

export default function SystemPromptDisplay({ 
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
  const [expandModalOpen, setExpandModalOpen] = useState(false)
  const [expandTitle, setExpandTitle] = useState("")
  const [expandContent, setExpandContent] = useState("")
  const [expandIndex, setExpandIndex] = useState(0)
  
  // Add local state to track content of three sections
  const [localDutyContent, setLocalDutyContent] = useState(dutyContent)
  const [localConstraintContent, setLocalConstraintContent] = useState(constraintContent)
  const [localFewShotsContent, setLocalFewShotsContent] = useState(fewShotsContent)
  
  // Add references to original content
  const originalDutyContentRef = useRef(dutyContent)
  const originalConstraintContentRef = useRef(constraintContent)
  const originalFewShotsContentRef = useRef(fewShotsContent)
  
  const { t } = useTranslation('common')

  // Calculate dynamic modal height based on content
  const calculateModalHeight = (content: string) => {
    const lineCount = content.split('\n').length;
    const contentLength = content.length;
    
    // 基于行数和内容长度的高度计算，范围 25vh - 85vh
    const minHeight = 25;
    const maxHeight = 85;
    
    // 结合行数和内容长度来计算高度
    const heightByLines = minHeight + Math.floor(lineCount / 8) * 5;
    const heightByContent = minHeight + Math.floor(contentLength / 200) * 3;

    const calculatedHeight = Math.max(heightByLines, heightByContent);
    return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
  };

  // Handle expand card content
  const handleExpandCard = (title: string, content: string, index: number) => {
    setExpandTitle(title)
    setExpandContent(content)
    setExpandIndex(index)
    setExpandModalOpen(true)
  }

  // Handle save expanded content
  const handleSaveExpandedContent = () => {
    // 立即更新本地状态和调用回调
    switch (expandIndex) {
      case 1:
        setLocalDutyContent(expandContent);
        onDutyContentChange?.(expandContent);
        break;
      case 2:
        setLocalConstraintContent(expandContent);
        onConstraintContentChange?.(expandContent);
        break;
      case 3:
        setLocalFewShotsContent(expandContent);
        onFewShotsContentChange?.(expandContent);
        break;
    }

    Promise.resolve().then(() => {
      setExpandModalOpen(false);
    });
  }

  // Handle close expanded modal
  const handleCloseExpandedModal = () => {
    // 关闭前先保存修改的内容
    switch (expandIndex) {
      case 1:
        setLocalDutyContent(expandContent);
        onDutyContentChange?.(expandContent);
        break;
      case 2:
        setLocalConstraintContent(expandContent);
        onConstraintContentChange?.(expandContent);
        break;
      case 3:
        setLocalFewShotsContent(expandContent);
        onFewShotsContentChange?.(expandContent);
        break;
    }
    setExpandModalOpen(false)
  }

  // Update local state and original references
  useEffect(() => {
    if (dutyContent !== localDutyContent) {
      setLocalDutyContent(dutyContent);
    }
    if (constraintContent !== localConstraintContent) {
      setLocalConstraintContent(constraintContent);
    }
    if (fewShotsContent !== localFewShotsContent) {
      setLocalFewShotsContent(fewShotsContent);
    }
  }, [dutyContent, constraintContent, fewShotsContent, localDutyContent, localConstraintContent, localFewShotsContent]);

  // Render card view - always render 3 cards with equal height
  const renderCardView = () => {
    return (
      <div className="grid grid-rows-3 h-full gap-4">
        <PromptCard
          title={t('systemPrompt.card.duty.title')}
          content={localDutyContent}
          index={1}
          onChange={(value) => {
            setLocalDutyContent(value);
            onDutyContentChange?.(value);
          }}
          onExpand={handleExpandCard}
        />
        <PromptCard
          title={t('systemPrompt.card.constraint.title')}
          content={localConstraintContent}
          index={2}
          onChange={(value) => {
            setLocalConstraintContent(value);
            onConstraintContentChange?.(value);
          }}
          onExpand={handleExpandCard}
        />
        <PromptCard
          title={t('systemPrompt.card.fewShots.title')}
          content={localFewShotsContent}
          index={3}
          onChange={(value) => {
            setLocalFewShotsContent(value);
            onFewShotsContentChange?.(value);
          }}
          onExpand={handleExpandCard}
        />
      </div>
    );
  };

  // Handle fine-tuning request
  const handleSendAdditionalRequest = async (request: string) => {
    // Check if any of the prompt parts have content
    const hasPromptContent = localDutyContent?.trim() || localConstraintContent?.trim() || localFewShotsContent?.trim();
    if (!hasPromptContent) {
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
        system_prompt: `${localDutyContent}\n\n${localConstraintContent}\n\n${localFewShotsContent}`,
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
    if (!agentId) return;
    
    try {
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
        localDutyContent, // duty_prompt
        localConstraintContent, // constraint_prompt
        localFewShotsContent // few_shots_prompt
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
      
      message.success(t('systemPrompt.message.save.success'));
    } catch (error) {
      console.error(t('systemPrompt.message.save.error'), error);
      message.error(t('systemPrompt.message.save.error'));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 flex-shrink-0 px-2">
        <div className="flex items-center">
          <h2 className="text-lg font-medium">{t('agent.title')}</h2>
        </div>
        <div className="flex gap-1">
          <Button
            type="text"
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSavePrompt}
            disabled={!agentId}
            className="text-green-500 hover:text-green-600 hover:bg-green-50"
            title={t('systemPrompt.button.save')}
          >
            {t('systemPrompt.button.save')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<BugOutlined />}
            onClick={onDebug}
            className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
            title={t('systemPrompt.button.debug')}
          >
            {t('systemPrompt.button.debug')}
          </Button>
        </div>
      </div>
      <div className="border-t border-gray-200 mx-2 mb-2"></div>
      <div 
        className="flex-1 overflow-y-auto px-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
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
                <Button
                  type="text"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSaveTunedPrompt}
                  className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                  title={t('systemPrompt.modal.button.save')}
                >
                  {t('systemPrompt.modal.button.save')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
      
      {/* Expand Card Content Modal */}
      <Modal
        title={
          <div className="flex justify-end items-center pr-4 -mb-2">
            <button
              onClick={handleCloseExpandedModal}
              className="px-4 py-1.5 rounded-md flex items-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
              style={{ border: "none" }}
            >
              {t('systemPrompt.button.close')}
            </button>
          </div>
        }
        open={expandModalOpen}
        closeIcon={null}
        onCancel={handleCloseExpandedModal}
        footer={null}
        width={1000}
        styles={{
          body: { padding: '20px' },
          content: { top: 20 }
        }}
      >
        <div 
          className="flex flex-col"
          style={{ height: `${calculateModalHeight(expandContent)}vh` }}
        >
          <div className="flex-1 border border-gray-200 rounded-md overflow-y-auto">
            <MilkdownProvider>
              <PromptEditor
                value={expandContent}
                onChange={setExpandContent}
              />
            </MilkdownProvider>
          </div>
        </div>
      </Modal>
    </div>
  )
} 