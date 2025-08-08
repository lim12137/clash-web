"use client"

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, MousePointerClick } from 'lucide-react'
import { fetchAllAgents } from '@/services/agentConfigService'
import { useTranslation } from 'react-i18next'
import { getUrlParam } from '@/lib/utils'

interface Agent {
  agent_id: number
  name: string
  description: string
  is_available: boolean
}

interface AgentSelectorProps {
  selectedAgentId: number | null
  onAgentSelect: (agentId: number | null) => void
  disabled?: boolean
  isInitialMode?: boolean
}

export function AgentSelector({ selectedAgentId, onAgentSelect, disabled = false, isInitialMode = false }: AgentSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, direction: 'down' })
  const [isAutoSelectInit, setIsAutoSelectInit] = useState(false)
  const { t } = useTranslation('common')
  const buttonRef = useRef<HTMLDivElement>(null)

  // 可自定义的下拉框宽度（单位：px）
  // 你可以根据需要修改这个数值来调整选择框的宽度
  const dropdownWidth = 550

  const selectedAgent = agents.find(agent => agent.agent_id === selectedAgentId)

  /**
   * 处理URL参数自动选择Agent的逻辑
   */
  const handleAutoSelectAgent = () => {
    if (agents.length === 0 || isAutoSelectInit) return

    // 获取URL中的agent_id参数
    const agentId = getUrlParam('agent_id', null as number | null, str => str ? Number(str) : null)
    
    if (agentId === null) return

    // 检查agentId是否为有效的agent
    const agent = agents.find(a => a.agent_id === agentId)
    if (agent && agent.is_available) {
      console.log('自动选择agent:', agent.name, 'ID:', agentId)
      handleAgentSelect(agentId)
      setIsAutoSelectInit(true)
    } else if (agent && !agent.is_available) {
      console.log('Agent不可用，跳过自动选择:', agent.name, 'ID:', agentId)
    } else {
      console.log('未找到对应的agent，ID:', agentId)
    }
  }

  useEffect(() => {
    loadAgents()
  }, [])

  // 当agents加载完成后执行自动选择逻辑
  useEffect(() => {
    handleAutoSelectAgent()
  }, [agents])

  // 计算下拉框位置
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const dropdownHeight = 320 // 估算下拉框高度 (max-h-80)，可根据agent数量调整
      
      // 检查是否有足够空间向下显示
      const hasSpaceBelow = buttonRect.bottom + dropdownHeight + 10 < viewportHeight
      // 检查是否有足够空间向上显示
      const hasSpaceAbove = buttonRect.top - dropdownHeight - 10 > 0
      
      let direction = 'down'
      let top = buttonRect.bottom + 4
      
      // 决定方向：优先使用建议方向，但如果空间不足则调整
      if (isInitialMode) {
        // 初始模式优先向下
        if (!hasSpaceBelow && hasSpaceAbove) {
          direction = 'up'
          top = buttonRect.top - 4
        }
      } else {
        // 非初始模式优先向上
        direction = 'up'
        top = buttonRect.top - 4
        if (!hasSpaceAbove && hasSpaceBelow) {
          direction = 'down'
          top = buttonRect.bottom + 4
        }
      }
      
      setDropdownPosition({
        top,
        left: buttonRect.left,
        direction
      })
    }
  }, [isOpen, isInitialMode])

  // 监听窗口滚动和尺寸变化，关闭下拉框
  useEffect(() => {
    if (!isOpen) return

    const handleScroll = (e: Event) => {
      // 如果滚动发生在下拉框内部，不关闭下拉框
      const target = e.target as Node
      const dropdownElement = document.querySelector('.agent-selector-dropdown')
      if (dropdownElement && (dropdownElement === target || dropdownElement.contains(target))) {
        return
      }
      
      // 如果是页面滚动或其他容器的滚动，则关闭下拉框
      setIsOpen(false)
    }

    const handleResize = () => {
      setIsOpen(false)
    }

    // 使用事件捕获阶段
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  const loadAgents = async () => {
    setIsLoading(true)
    try {
      const result = await fetchAllAgents()
      if (result.success) {
        setAgents(result.data)
      }
    } catch (error) {
      console.error('加载Agent列表失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAgentSelect = (agentId: number | null) => {
    // 只有可用的Agent才能被选择
    if (agentId !== null) {
      const agent = agents.find(a => a.agent_id === agentId)
      if (agent && !agent.is_available) {
        return // 不可用的Agent不能被选择
      }
    }
    
    onAgentSelect(agentId)
    setIsOpen(false)
    
    // 如果是iframe嵌入页面，发送postMessage给父页面
    if (window.self !== window.top) {
      try {
        const selectedAgent = agents.find(agent => agent.agent_id === agentId)
        const message = {
          type: 'agent_selected',
          agent_id: agentId,
          agent_name: selectedAgent?.name || null,
          timestamp: Date.now(),
          source: 'agent_selector'
        }
        
        // 发送postMessage给父页面
        window.parent.postMessage(message, '*')
      } catch (error) {
        console.error('发送postMessage失败:', error)
      }
    }
  }

  // 显示所有agents，包括不可用的
  const allAgents = agents

  return (
    <div className="relative">
      <div
        ref={buttonRef}
        className={`
          relative h-8 min-w-[150px] max-w-[250px] px-2
          rounded-lg border border-slate-200
          bg-white hover:bg-slate-50
          flex items-center justify-between
          cursor-pointer select-none
          transition-colors duration-150
          ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          ${isOpen ? 'border-blue-400 ring-2 ring-blue-100' : 'hover:border-slate-300'}
        `}
        onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedAgent && (
            <MousePointerClick className="w-4 h-4 text-blue-500 flex-shrink-0" />
          )}
          <span className={`truncate text-sm ${selectedAgent ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
            {isLoading 
              ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                  <span>{t('agentSelector.loading')}</span>
                </div>
              )
              : selectedAgent 
                ? selectedAgent.name 
                : t('agentSelector.selectAgent')
            }
          </span>
        </div>
        <ChevronDown 
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </div>

      {/* Portal渲染下拉框到body，避免被父容器遮挡 */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <>
          {/* 覆盖层 */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
            onWheel={(e) => {
              // 如果滚动发生在下拉框内部，不关闭下拉框
              const target = e.target as Node
              const dropdownElement = document.querySelector('.agent-selector-dropdown')
              if (dropdownElement && (dropdownElement === target || dropdownElement.contains(target))) {
                return
              }
              setIsOpen(false)
            }}
          />
          
          {/* 下拉框 */}
          <div 
            className="agent-selector-dropdown fixed bg-white border border-slate-200 rounded-md shadow-lg z-[9999] max-h-80 overflow-y-auto"
            style={{
              top: dropdownPosition.direction === 'up' 
                ? `${dropdownPosition.top}px` 
                : `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownWidth}px`,
              transform: dropdownPosition.direction === 'up' ? 'translateY(-100%)' : 'none'
            }}
            onWheel={(e) => {
              // 阻止滚动事件冒泡，但允许正常滚动
              e.stopPropagation()
            }}
          >
            <div className="py-1">
              {allAgents.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-slate-500 text-center">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                      <span>{t('agentSelector.loading')}</span>
                    </div>
                  ) : (
                    t('agentSelector.noAvailableAgents')
                  )}
                </div>
              ) : (
                allAgents.map((agent, idx) => (
                  <div
                    key={agent.agent_id}
                    className={`
                      flex items-start gap-3 px-3.5 py-3 text-sm
                      transition-all duration-150 ease-in-out
                      ${agent.is_available 
                        ? `hover:bg-slate-50 cursor-pointer ${
                            selectedAgentId === agent.agent_id 
                              ? 'bg-blue-50/70 text-blue-600 hover:bg-blue-50/70' 
                              : ''
                          }` 
                        : 'cursor-not-allowed bg-slate-50/50'
                      }
                      ${selectedAgentId === agent.agent_id ? 'shadow-[inset_2px_0_0_0] shadow-blue-500' : ''}
                      ${idx !== 0 ? 'border-t border-slate-100' : ''}
                    `}
                    onClick={() => agent.is_available && handleAgentSelect(agent.agent_id)}
                  >
                    {/* Agent Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <MousePointerClick 
                        className={`h-4 w-4 ${
                          agent.is_available 
                            ? selectedAgentId === agent.agent_id 
                              ? 'text-blue-500' 
                              : 'text-slate-500'
                            : 'text-slate-300'
                        }`}
                      />
                    </div>
                    
                    {/* Agent Info */}
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${
                        agent.is_available 
                          ? selectedAgentId === agent.agent_id 
                            ? 'text-blue-600' 
                            : 'text-slate-700 hover:text-slate-900'
                          : 'text-slate-400'
                      }`}>
                        {agent.name}
                      </div>
                      <div className={`text-xs mt-1 leading-relaxed ${
                        agent.is_available 
                          ? selectedAgentId === agent.agent_id 
                            ? 'text-blue-500' 
                            : 'text-slate-500'
                          : 'text-slate-300'
                      }`}>
                        {agent.description}
                        {!agent.is_available && (
                          <span className="block mt-1 text-red-400">
                            {t('agentSelector.agentUnavailable')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
} 