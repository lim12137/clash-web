"use client"

import { useState } from 'react'
import { message } from 'antd'
import { SettingOutlined, UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/components/ui/scrollArea'
import AgentContextMenu from './AgentContextMenu'
import { Agent } from '../ConstInterface'

interface SubAgentPoolProps {
  onEditAgent: (agent: Agent) => void;
  onCreateNewAgent: () => void;
  onImportAgent: () => void;
  onExportAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  onExitEditMode?: () => void; // 退出编辑模式的回调
  subAgentList?: Agent[];
  loadingAgents?: boolean;
  isImporting?: boolean;
  isGeneratingAgent?: boolean; // 生成智能体状态
  isEditingAgent?: boolean; // 是否处于编辑模式
  editingAgent?: Agent | null; // 当前正在编辑的Agent
  isCreatingNewAgent?: boolean; // 是否处于创建模式
}

/**
 * Sub Agent Pool Component
 */
export default function SubAgentPool({ 
  onEditAgent, 
  onCreateNewAgent, 
  onImportAgent,
  onExportAgent,
  onDeleteAgent,
  onExitEditMode,
  subAgentList = [],
  loadingAgents = false,
  isImporting = false,
  isGeneratingAgent = false,
  isEditingAgent = false,
  editingAgent = null,
  isCreatingNewAgent = false
}: SubAgentPoolProps) {
  const { t } = useTranslation('common');

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    agent: Agent | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    agent: null
  });

  const handleContextMenu = (e: React.MouseEvent, agent: Agent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      agent: agent
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      agent: null
    });
  };

  return (
    <div className="flex flex-col h-full min-h-[300px] lg:min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
            1
          </div>
          <h2 className="text-lg font-medium">{t('subAgentPool.management')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {loadingAgents && <span className="text-sm text-gray-500">{t('subAgentPool.loading')}</span>}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
        <div className="grid grid-cols-1 gap-3 pr-2">
          {/* 始终显示创建和导入按钮 */}
          <div className="flex gap-2 mb-2">
            <div 
              className={`flex-1 border-2 rounded-md p-3 flex flex-col justify-center items-center cursor-pointer transition-all duration-200 h-[80px] shadow-sm ${
                isCreatingNewAgent
                  ? 'shadow-md bg-blue-50 border-blue-400' // 创建模式下高亮显示
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
              }`}
              title={isCreatingNewAgent ? '点击退出创建模式' : '点击创建新Agent'}
              onClick={() => {
                if (isCreatingNewAgent) {
                  // 如果当前处于创建模式，点击退出创建模式
                  onExitEditMode?.();
                } else {
                  // 否则进入创建模式
                  onCreateNewAgent();
                }
              }}
            >
              <div className={`flex items-center justify-center h-full ${
                isCreatingNewAgent ? 'text-blue-600' : 'text-blue-500'
              }`}>
                <span className="text-lg mr-2">+</span>
                <span className="text-sm">
                  {isCreatingNewAgent ? t('subAgentPool.button.exitCreate') : t('subAgentPool.button.create')}
                </span>
              </div>
            </div>

            <div
              className={`flex-1 border-2 rounded-md p-3 flex flex-col justify-center items-center transition-all duration-200 h-[80px] shadow-sm ${
                isImporting
                  ? 'bg-gray-50 border-gray-300 cursor-not-allowed' // 导入中：禁用状态
                  : 'border-gray-200 cursor-pointer hover:border-green-300 hover:bg-green-50 hover:shadow-md' // 正常状态：可点击
              }`}
              onClick={isImporting ? undefined : onImportAgent}
            >
              <div className={`flex items-center justify-center h-full ${
                isImporting ? 'text-gray-400' : 'text-green-500' // 导入中使用灰色
              }`}>
                <UploadOutlined className="text-lg mr-2" />
                <span className="text-sm">{isImporting ? t('subAgentPool.button.importing') : t('subAgentPool.button.import')}</span>
              </div>
            </div>
          </div>

          {/* Agent列表 */}
          {subAgentList.map((agent) => {
            const isAvailable = agent.is_available !== false; // 默认为true，只有明确为false时才不可用
            const isCurrentlyEditing = editingAgent && String(editingAgent.id) === String(agent.id); // 确保类型匹配
            
            return (
              <div 
                key={agent.id} 
                className={`border-2 rounded-md p-3 flex flex-col justify-center transition-all duration-300 ease-in-out h-[80px] shadow-sm ${
                  isCurrentlyEditing
                    ? 'shadow-md bg-blue-50 border-blue-400' // 编辑中的agent高亮显示
                    : !isAvailable
                      ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
                }`}
                title={!isAvailable 
                  ? t('subAgentPool.tooltip.unavailableAgent')
                  : isCurrentlyEditing
                    ? `点击退出编辑模式`
                  : `点击编辑 ${agent.name}`}
                onClick={async (e) => {
                  // 阻止事件冒泡
                  e.preventDefault();
                  e.stopPropagation();
                  
                  if (!isGeneratingAgent && isAvailable) {
                    if (isCurrentlyEditing) {
                      // 如果当前正在编辑这个Agent，点击退出编辑模式
                      onExitEditMode?.();
                    } else {
                      // 否则进入编辑模式（或切换到这个Agent）
                    onEditAgent(agent);
                    }
                  } else if (!isAvailable) {
                    message.warning(t('subAgentPool.message.unavailable'));
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, agent)}
              >
                <div className="flex items-center h-full">
                  <div className="flex-1 overflow-hidden">
                    <div className={`font-medium text-sm truncate transition-colors duration-300 ${
                      !isAvailable ? 'text-gray-500' : ''
                    }`} 
                         title={!isAvailable 
                           ? t('subAgentPool.tooltip.unavailableAgent')
                           : `点击编辑 ${agent.name}`}>
                      {agent.name}
                    </div>
                    <div 
                      className={`text-xs line-clamp-2 transition-colors duration-300 ${
                        !isAvailable ? 'text-gray-400' : 'text-gray-500'
                      }`}
                      title={agent.description}
                    >
                      {agent.description}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Context Menu */}
      <AgentContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        agent={contextMenu.agent}
        onEdit={onEditAgent}
        onExport={onExportAgent}
        onDelete={onDeleteAgent}
        onClose={handleCloseContextMenu}
      />
    </div>
  )
} 