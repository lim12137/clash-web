"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { Modal, Badge, Input, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { ThunderboltOutlined, LoadingOutlined } from '@ant-design/icons'
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react'
import { defaultValueCtx, Editor, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { nord } from '@milkdown/theme-nord'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { fineTunePrompt, savePrompt } from '@/services/promptService'
import { updateAgent } from '@/services/agentConfigService'
import AgentConfigurationSection from './AgentConfigurationSection'
import NonEditingOverlay from './NonEditingOverlay'
import './milkdown-nord.css'

// 简化的编辑器组件
export interface SimplePromptEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string
}

export function SimplePromptEditor({ value, onChange, height = '100%' }: SimplePromptEditorProps) {
  const [internalValue, setInternalValue] = useState(value)
  const [editorKey, setEditorKey] = useState(0)
  const isInternalChange = useRef(false)
  
  // 当外部value改变时，更新编辑器
  useEffect(() => {
    if (value !== internalValue) {
      // 仅当更改源自外部时才强制更新编辑器
      if (!isInternalChange.current) {
        setInternalValue(value)
        setEditorKey(prev => prev + 1)
      }
    }
    
    // 每次value或internalValue变化后，如果标记为内部更改，则重置标记。
    // 这能确保在内部编辑后，下一次外部更改能被正确识别。
    if (isInternalChange.current) {
      isInternalChange.current = false
    }
  }, [value, internalValue])
  
  const { get } = useEditor((root) => 
    Editor
      .make()
      .config(ctx => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, internalValue || '')
      })
      .config(nord)
      .use(commonmark)
      .use(listener)
      .config(ctx => {
        const listenerManager = ctx.get(listenerCtx)
        listenerManager.markdownUpdated((ctx, markdown) => {
          isInternalChange.current = true
          setInternalValue(markdown)
          onChange(markdown)
        })
      })
  , [editorKey]) // 只在editorKey改变时重新创建

  return (
    <div className="milkdown-editor-container" style={{ height, overflow: 'hidden' }}>
      <Milkdown key={editorKey} />
    </div>
  )
}

// 展开编辑模态框
interface ExpandEditModalProps {
  open: boolean
  title: string
  content: string
  index: number
  onClose: () => void
  onSave: (content: string) => void
}

function ExpandEditModal({ open, title, content, index, onClose, onSave }: ExpandEditModalProps) {
  const { t } = useTranslation('common')
  const [editContent, setEditContent] = useState(content)

  const handleSave = () => {
    onSave(editContent)
    onClose()
  }

  const getBadgeProps = (index: number) => {
    switch(index) {
      case 1: return { status: 'success' as const }
      case 2: return { status: 'warning' as const }
      case 3: return { color: '#1677ff' }
      case 4: return { status: 'default' as const }
      default: return { status: 'default' as const }
    }
  }

  const calculateModalHeight = (content: string) => {
    const lineCount = content.split('\n').length
    const contentLength = content.length
    const heightByLines = 25 + Math.floor(lineCount / 8) * 5
    const heightByContent = 25 + Math.floor(contentLength / 200) * 3
    const calculatedHeight = Math.max(heightByLines, heightByContent)
    return Math.max(25, Math.min(85, calculatedHeight))
  }

  return (
    <Modal
      title={
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Badge {...getBadgeProps(index)} className="mr-3" />
            <span className="text-base font-medium">{title}</span>
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md text-sm bg-blue-500 text-white hover:bg-blue-600"
            style={{ border: "none" }}
          >
            {t('systemPrompt.expandEdit.close')}
          </button>
        </div>
      }
      open={open}
      closeIcon={null}
      onCancel={handleSave}
      footer={null}
      width={1000}
      styles={{
        body: { padding: '20px' },
        content: { top: 20 }
      }}
    >
      <div 
        className="flex flex-col"
        style={{ height: `${calculateModalHeight(editContent)}vh` }}
      >
        <div className="flex-1 border border-gray-200 rounded-md overflow-y-auto">
          <SimplePromptEditor
            value={editContent}
            onChange={(newContent) => {
              setEditContent(newContent)
            }}
          />
        </div>
      </div>
    </Modal>
  )
}

// 微调模态框
interface FineTuneModalProps {
  open: boolean
  onClose: () => void
  onFineTune: (request: string) => Promise<string>
  onSave: (prompt: string) => Promise<void>
}

function FineTuneModal({ open, onClose, onFineTune, onSave }: FineTuneModalProps) {
  const { t } = useTranslation('common')
  const [request, setRequest] = useState('')
  const [tunedPrompt, setTunedPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFineTune = async () => {
    if (!request.trim()) {
      message.warning(t('systemPrompt.message.emptyTuning'))
      return
    }

    setIsLoading(true)
    try {
      const result = await onFineTune(request)
      setTunedPrompt(result)
      message.success(t('systemPrompt.message.tune.success'))
    } catch (error) {
      console.error('Fine tune error:', error)
      message.error(`${t('systemPrompt.message.tune.error')} ${error instanceof Error ? error.message : t('error.unknown')}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      await onSave(tunedPrompt)
      setTunedPrompt('')
      setRequest('')
      onClose()
      message.success(t('systemPrompt.message.save.success'))
    } catch (error) {
      console.error('Save error:', error)
      message.error(t('systemPrompt.message.save.error'))
    }
  }

  const handleClose = () => {
    setTunedPrompt('')
    setRequest('')
    onClose()
  }

  return (
    <Modal
      title={t('systemPrompt.fineTune.title')}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('systemPrompt.fineTune.requestLabel')}
          </label>
          <Input.TextArea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={t('systemPrompt.fineTune.requestPlaceholder')}
            rows={3}
          />
        </div>
        
        <button
          onClick={handleFineTune}
          disabled={isLoading || !request.trim()}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <LoadingOutlined spin className="mr-2" />
              {t('systemPrompt.fineTune.processing')}
            </>
          ) : (
            t('systemPrompt.fineTune.submit')
          )}
        </button>

        {tunedPrompt && (
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('systemPrompt.fineTune.result')}
            </label>
            <div className="border border-gray-200 rounded-md p-4 bg-gray-50 max-h-60 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm">{tunedPrompt}</pre>
            </div>
            <button
              onClick={handleSave}
              className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              {t('systemPrompt.fineTune.saveResult')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// 主要的提示词管理器组件
export interface PromptManagerProps {
  // 基础数据
  agentId?: number
  businessLogic?: string
  dutyContent?: string
  constraintContent?: string
  fewShotsContent?: string
  
  // Agent 信息
  agentName?: string
  agentDescription?: string
  mainAgentModel?: string
  mainAgentMaxStep?: number
  
  // 编辑状态
  isEditingMode?: boolean
  isGeneratingAgent?: boolean
  isSavingAgent?: boolean
  isCreatingNewAgent?: boolean
  canSaveAgent?: boolean
  
  // 回调函数
  onBusinessLogicChange?: (content: string) => void
  onDutyContentChange?: (content: string) => void
  onConstraintContentChange?: (content: string) => void
  onFewShotsContentChange?: (content: string) => void
  onAgentNameChange?: (name: string) => void
  onAgentDescriptionChange?: (description: string) => void
  onModelChange?: (value: string) => void
  onMaxStepChange?: (value: number | null) => void
  onGenerateAgent?: () => void
  onSaveAgent?: () => void
  onDebug?: () => void
  onExportAgent?: () => void
  onDeleteAgent?: () => void
  onDeleteSuccess?: () => void
  getButtonTitle?: () => string
  
  // 编辑中的agent
  editingAgent?: any
}

export default function PromptManager({
  agentId,
  businessLogic = '',
  dutyContent = '',
  constraintContent = '',
  fewShotsContent = '',
  agentName = '',
  agentDescription = '',
  mainAgentModel = '',
  mainAgentMaxStep = 5,
  isEditingMode = false,
  isGeneratingAgent = false,
  isSavingAgent = false,
  isCreatingNewAgent = false,
  canSaveAgent = false,
  onBusinessLogicChange,
  onDutyContentChange,
  onConstraintContentChange,
  onFewShotsContentChange,
  onAgentNameChange,
  onAgentDescriptionChange,
  onModelChange,
  onMaxStepChange,
  onGenerateAgent,
  onSaveAgent,
  onDebug,
  onExportAgent,
  onDeleteAgent,
  onDeleteSuccess,
  getButtonTitle,
  editingAgent
}: PromptManagerProps) {
  const { t } = useTranslation('common')
  
  // 模态框状态
  const [expandModalOpen, setExpandModalOpen] = useState(false)
  const [expandTitle, setExpandTitle] = useState('')
  const [expandContent, setExpandContent] = useState('')
  const [expandIndex, setExpandIndex] = useState(0)
  const [fineTuneModalOpen, setFineTuneModalOpen] = useState(false)

  // 处理展开编辑
  const handleExpandCard = (title: string, content: string, index: number) => {
    console.log('handleExpandCard called:', { title, content, index })
    setExpandTitle(title)
    setExpandContent(content)
    setExpandIndex(index)
    setExpandModalOpen(true)
  }

  // 处理展开编辑保存
  const handleExpandSave = (newContent: string) => {
    console.log('handleExpandSave called:', { newContent, expandIndex })
    switch (expandIndex) {
      case 2:
        onDutyContentChange?.(newContent)
        break
      case 3:
        onConstraintContentChange?.(newContent)
        break
      case 4:
        onFewShotsContentChange?.(newContent)
        break
    }
  }

  // 处理微调
  const handleFineTune = async (request: string): Promise<string> => {
    const hasPromptContent = dutyContent?.trim() || constraintContent?.trim() || fewShotsContent?.trim()
    if (!hasPromptContent) {
      throw new Error(t('systemPrompt.message.empty'))
    }

    if (!agentId) {
      throw new Error(t('systemPrompt.message.noAgentId'))
    }

    const result = await fineTunePrompt({
      agent_id: agentId,
      system_prompt: `${dutyContent}\n\n${constraintContent}\n\n${fewShotsContent}`,
      command: request
    })

    return result
  }

  // 处理保存微调结果
  const handleSaveFineTuned = async (prompt: string): Promise<void> => {
    if (!agentId) {
      throw new Error(t('systemPrompt.message.noAgentId'))
    }

    await savePrompt({
      agent_id: agentId,
      prompt: prompt
    })
  }

  // 处理手动保存
  const handleSavePrompt = async () => {
    if (!agentId) return
    
    try {
      const result = await updateAgent(
        Number(agentId),
        agentName,
        agentDescription,
        mainAgentModel,
        mainAgentMaxStep,
        false,
        undefined,
        businessLogic,
        dutyContent,
        constraintContent,
        fewShotsContent
      )
      
      if (result.success) {
        onDutyContentChange?.(dutyContent)
        onConstraintContentChange?.(constraintContent)
        onFewShotsContentChange?.(fewShotsContent)
        message.success(t('systemPrompt.message.save.success'))
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      console.error(t('systemPrompt.message.save.error'), error)
      message.error(t('systemPrompt.message.save.error'))
    }
  }

  return (
    <MilkdownProvider>
      <div className="flex flex-col h-full relative">
      <style jsx global>{`
        @media (max-width: 768px) {
          .system-prompt-container {
            overflow-y: auto !important;
            max-height: none !important;
          }
          .system-prompt-content {
            min-height: auto !important;
            max-height: none !important;
          }
        }
        @media (max-width: 1024px) {
          .system-prompt-business-logic {
            min-height: 100px !important;
            max-height: 150px !important;
          }
        }
      `}</style>
      
      {/* 非编辑模式遮罩 */}
      {!isEditingMode && <NonEditingOverlay />}

      {/* 主标题 */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
            3
          </div>
          <h2 className="text-lg font-medium">{t('guide.steps.describeBusinessLogic.title')}</h2>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="flex-1 flex flex-col border-t pt-2 system-prompt-container overflow-hidden">
        {/* 业务逻辑描述部分 */}
        <div className="flex-shrink-0 mb-4">
          <div className="mb-2">
            <h3 className="text-sm font-medium text-gray-700 mb-2">{t('businessLogic.title')}</h3>
          </div>
          <div className="relative">
            <Input.TextArea
              value={businessLogic}
              onChange={(e) => onBusinessLogicChange?.(e.target.value)}
              placeholder={t('businessLogic.placeholder')}
              className="w-full resize-none p-3 text-sm transition-all duration-300 system-prompt-business-logic"
              style={{ 
                minHeight: '120px',
                maxHeight: '200px',
                paddingRight: '12px',
                paddingBottom: '40px'  // 为按钮预留空间
              }}
              autoSize={{ 
                minRows: 3, 
                maxRows: 5 
              }}
              disabled={!isEditingMode}
            />
            {/* 生成按钮 */}
            <div className="absolute bottom-2 right-2">
              <button
                onClick={onGenerateAgent}
                disabled={isGeneratingAgent || isSavingAgent}
                className="px-3 py-1.5 rounded-md flex items-center justify-center text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ border: 'none' }}
              >
                {isGeneratingAgent ? (
                  <>
                    <LoadingOutlined spin className="mr-1" />
                    {t('businessLogic.config.button.generating')}
                  </>
                ) : (
                  <>
                    <ThunderboltOutlined className="mr-1" />
                    {t('businessLogic.config.button.generatePrompt')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Agent配置部分 */}
        <div className="flex-1 min-h-0 system-prompt-content">
          <AgentConfigurationSection
            agentId={agentId}
            dutyContent={dutyContent}
            constraintContent={constraintContent}
            fewShotsContent={fewShotsContent}
            onDutyContentChange={onDutyContentChange}
            onConstraintContentChange={onConstraintContentChange}
            onFewShotsContentChange={onFewShotsContentChange}
            agentName={agentName}
            agentDescription={agentDescription}
            onAgentNameChange={onAgentNameChange}
            onAgentDescriptionChange={onAgentDescriptionChange}
            isEditingMode={isEditingMode}
            mainAgentModel={mainAgentModel}
            mainAgentMaxStep={mainAgentMaxStep}
            onModelChange={onModelChange}
            onMaxStepChange={onMaxStepChange}
            onSavePrompt={handleSavePrompt}
            onExpandCard={handleExpandCard}
            isGeneratingAgent={isGeneratingAgent}
            onDebug={onDebug}
            onExportAgent={onExportAgent}
            onDeleteAgent={onDeleteAgent}
            onDeleteSuccess={onDeleteSuccess}
            onSaveAgent={onSaveAgent}
            isCreatingNewAgent={isCreatingNewAgent}
            editingAgent={editingAgent}
            canSaveAgent={canSaveAgent}
            isSavingAgent={isSavingAgent}
            getButtonTitle={getButtonTitle}
          />
        </div>
      </div>

      {/* 展开编辑模态框 */}
      <ExpandEditModal
        key={
          expandIndex === 2 ? dutyContent :
          expandIndex === 3 ? constraintContent :
          expandIndex === 4 ? fewShotsContent : 'default'
        }
        title={expandIndex === 1 ? t('systemPrompt.expandEdit.backgroundInfo') : expandIndex === 2 ? t('systemPrompt.card.duty.title') : expandIndex === 3 ? t('systemPrompt.card.constraint.title') : t('systemPrompt.card.fewShots.title')}
        open={expandModalOpen}
        content={
          expandIndex === 1 ? businessLogic :
          expandIndex === 2 ? dutyContent :
          expandIndex === 3 ? constraintContent :
          fewShotsContent
        }
        index={expandIndex}
        onClose={() => setExpandModalOpen(false)}
        onSave={handleExpandSave}
      />

      {/* 微调模态框 */}
      <FineTuneModal
        open={fineTuneModalOpen}
        onClose={() => setFineTuneModalOpen(false)}
        onFineTune={handleFineTune}
        onSave={handleSaveFineTuned}
      />
    </div>
    </MilkdownProvider>
  )
} 