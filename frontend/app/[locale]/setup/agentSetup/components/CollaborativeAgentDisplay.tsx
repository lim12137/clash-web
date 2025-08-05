"use client"

import { useState, useEffect } from 'react'
import { Tag, Button, Select, message } from 'antd'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { Agent } from '../ConstInterface'
import { addRelatedAgent, deleteRelatedAgent } from '@/services/agentConfigService'

const { Option } = Select

interface CollaborativeAgentDisplayProps {
  availableAgents: Agent[]
  selectedAgentIds: number[]
  parentAgentId?: number
  onAgentIdsChange: (newAgentIds: number[]) => void
  isEditingMode: boolean
  isGeneratingAgent: boolean
  className?: string
  style?: React.CSSProperties
}

export default function CollaborativeAgentDisplay({
  availableAgents,
  selectedAgentIds,
  parentAgentId,
  onAgentIdsChange,
  isEditingMode,
  isGeneratingAgent,
  className,
  style
}: CollaborativeAgentDisplayProps) {
  const { t } = useTranslation('common')
  const [isDropdownVisible, setIsDropdownVisible] = useState(false)
  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // 检查点击的是否是下拉框内的元素
      if (isDropdownVisible && !target.closest('.collaborative-dropdown')) {
        setIsDropdownVisible(false)
      }
    }

    if (isDropdownVisible) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownVisible])

  // 获取已选择的Agent详细信息
  const selectedAgents = availableAgents.filter(agent => 
    selectedAgentIds.includes(Number(agent.id))
  )

  // 获取可选择的Agent（排除已选择的和自己）
  const availableAgentsToSelect = availableAgents.filter(agent => 
    !selectedAgentIds.includes(Number(agent.id)) && 
    agent.is_available !== false &&
    Number(agent.id) !== parentAgentId
  )



  // 处理添加协作Agent
  const handleAddCollaborativeAgent = async (agentIdToAdd?: string) => {
    const targetAgentId = agentIdToAdd || selectedAgentToAdd
    
    if (!targetAgentId) {
      message.warning(t('collaborativeAgent.message.selectAgentFirst'))
      return
    }
    
    if (!parentAgentId) {
      message.warning(t('collaborativeAgent.message.noParentAgent'))
      return
    }

    setIsLoading(true)
    try {
      const result = await addRelatedAgent(parentAgentId, Number(targetAgentId))
      if (result.success) {
        // 添加成功后更新本地状态
        const newSelectedAgentIds = [...selectedAgentIds, Number(targetAgentId)]
        onAgentIdsChange(newSelectedAgentIds)
        message.success(t('collaborativeAgent.message.addSuccess'))
        setIsDropdownVisible(false)
        setSelectedAgentToAdd(null)
      } else {
        if (result.status === 500) {
          message.error(t('collaborativeAgent.message.circularDependency'))
        } else {
          message.error(result.message || t('collaborativeAgent.message.addFailed'))
        }
      }
    } catch (error) {
      console.error('添加协作Agent失败:', error)
      message.error(t('collaborativeAgent.message.addFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  // 处理删除协作Agent
  const handleRemoveCollaborativeAgent = async (agentId: number) => {
    if (!parentAgentId) {
      message.error(t('collaborativeAgent.message.noParentAgent'))
      return
    }

    try {
      const result = await deleteRelatedAgent(parentAgentId, agentId)
      if (result.success) {
        // 删除成功后更新本地状态
        const newSelectedAgentIds = selectedAgentIds.filter(id => id !== agentId)
        onAgentIdsChange(newSelectedAgentIds)
        message.success(t('collaborativeAgent.message.removeSuccess'))
      } else {
        message.error(result.message || t('collaborativeAgent.message.removeFailed'))
      }
    } catch (error) {
      console.error('删除协作Agent失败:', error)
      message.error(t('collaborativeAgent.message.removeFailed'))
    }
  }

  // 处理添加按钮点击
  const handleAddButtonClick = (event: React.MouseEvent) => {
    if (!isEditingMode) {
      message.warning(t('collaborativeAgent.message.notInEditMode'))
      return
    }
    if (isGeneratingAgent) {
      message.warning(t('collaborativeAgent.message.generatingInProgress'))
      return
    }
    
    if (!isDropdownVisible) {
      // 计算下拉框位置
      const rect = event.currentTarget.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      })
    }
    
    setIsDropdownVisible(!isDropdownVisible)
  }

  // 渲染下拉框组件
  const renderDropdown = () => {
    if (!isDropdownVisible) return null
    
    return (
      <div 
        className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto collaborative-dropdown"
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`
        }}
      >
        {availableAgentsToSelect.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-2 px-3">
            {t('collaborativeAgent.select.noOptions')}
          </div>
        ) : (
          <div className="py-1">
            {availableAgentsToSelect.map((agent) => (
              <div
                key={agent.id}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                onClick={() => {
                  handleAddCollaborativeAgent(agent.id)
                }}
              >
                {agent.name}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col w-full max-w-[calc(100%-1rem)] ${className}`} style={style}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-md font-medium text-gray-700">{t('collaborativeAgent.title')}</h4>
      </div>
      
      {/* 标签展示区域 - 固定高度避免布局跳变 */}
      <div className="bg-gray-50 rounded-md border-2 border-gray-200 p-4 overflow-y-auto relative shadow-sm h-[100px] lg:h-[120px] w-[98%]">
        <div className={`flex flex-wrap gap-2 min-h-[32px] transition-opacity duration-300 ${
          isEditingMode ? 'opacity-100' : 'opacity-0'
        }`}>
          {/* 添加按钮始终存在，只是在非编辑模式下不可见 */}
          <div className="relative">
            <button
              type="button"
              onClick={handleAddButtonClick}
              disabled={isGeneratingAgent || !isEditingMode}
              className={`flex items-center justify-center w-8 h-8 border-2 border-dashed transition-colors duration-200 ${
                isGeneratingAgent || !isEditingMode
                  ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                  : 'border-blue-400 text-blue-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'
              }`}
              title={isEditingMode ? t('collaborativeAgent.button.add') : ''}
            >
              <PlusOutlined className="text-sm" />
            </button>
            {/* 下拉框只在编辑模式下渲染 */}
            {isEditingMode && renderDropdown()}
          </div>
          {selectedAgents.map((agent) => (
            <Tag
              key={agent.id}
              color="blue"
              className="px-3 py-1 text-sm"
              closable={isEditingMode && !isGeneratingAgent}
              onClose={() => handleRemoveCollaborativeAgent(Number(agent.id))}
              closeIcon={<CloseOutlined className="text-xs" />}
            >
              {agent.name}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  )
} 