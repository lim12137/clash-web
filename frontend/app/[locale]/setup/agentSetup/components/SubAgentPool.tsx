"use client"

import { useState } from 'react'
import { message } from 'antd'
import { SettingOutlined, UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/components/ui/scrollArea'
import AgentContextMenu from './AgentContextMenu'
import { Agent } from '../ConstInterface'
import { addRelatedAgent, deleteRelatedAgent } from '@/services/agentConfigService'

interface SubAgentPoolProps {
  selectedAgents: Agent[];
  onSelectAgent: (agent: Agent, isSelected: boolean) => void;
  onSelectAgentAndLoadDetail?: (agent: Agent, isSelected: boolean) => void;
  onEditAgent: (agent: Agent) => void;
  onCreateNewAgent: () => void;
  onImportAgent: () => void;
  onExportAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  subAgentList?: Agent[];
  loadingAgents?: boolean;
  enabledAgentIds?: number[];
  isImporting?: boolean;
  isEditingAgent?: boolean; // 新增：控制是否处于编辑模式
  editingAgent?: Agent | null; // 新增：当前正在编辑的agent
  parentAgentId?: number; // 新增：父agent ID，用于关联关系
  onAgentSelectionOnly?: (agent: Agent, isSelected: boolean) => void; // 新增：只更新选择状态，不调用search_info
  onRefreshAgentState?: () => void; // 新增：刷新agent状态的回调函数
  onUpdateEnabledAgentIds?: (newEnabledAgentIds: number[]) => void; // 新增：直接更新enabledAgentIds的回调函数
  isCreatingNewAgent?: boolean; // 新增：控制是否处于新建agent模式
  onExitEdit?: () => void; // 新增：退出编辑模式回调函数
  isGeneratingAgent?: boolean; // 新增：生成智能体状态
}

/**
 * Sub Agent Pool Component
 */
export default function SubAgentPool({ 
  selectedAgents, 
  onSelectAgent, 
  onSelectAgentAndLoadDetail,
  onEditAgent, 
  onCreateNewAgent, 
  onImportAgent,
  onExportAgent,
  onDeleteAgent,
  subAgentList = [],
  loadingAgents = false,
  enabledAgentIds = [],
  isImporting = false,
  isEditingAgent = false, // 新增：默认为非编辑模式
  editingAgent = null, // 新增：当前正在编辑的agent
  parentAgentId, // 新增：父agent ID
  onAgentSelectionOnly, // 新增：只更新选择状态，不调用search_info
  onRefreshAgentState, // 新增：刷新agent状态的回调函数
  onUpdateEnabledAgentIds, // 新增：直接更新enabledAgentIds的回调函数
  isCreatingNewAgent = false, // 新增：控制是否处于新建agent模式
  onExitEdit, // 新增：退出编辑模式回调函数
  isGeneratingAgent = false // 新增：默认不在生成状态
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

  // 根据当前状态确定标题
  const getTitle = () => {
    if (isEditingAgent && editingAgent) {
      return t('subAgentPool.title.editing', { name: editingAgent.name });
    } else if (isCreatingNewAgent) {
      return t('subAgentPool.title.creating');
    } else {
      return t('subAgentPool.title');
    }
  };

  const isInEditMode = isEditingAgent || isCreatingNewAgent; // 是否处于编辑模式

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
            1
          </div>
          <h2 className="text-lg font-medium">{getTitle()}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Exit Edit Mode Button - Only show in editing mode */}
          {isInEditMode && onExitEdit && (
            <button
              onClick={onExitEdit}
              className="px-3 py-1.5 rounded-md flex items-center justify-center text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              style={{ border: 'none' }}
              title={t('businessLogic.config.button.exitEdit')}
            >
              {t('businessLogic.config.button.exitEdit')}
            </button>
          )}
          {loadingAgents && <span className="text-sm text-gray-500">{t('subAgentPool.loading')}</span>}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
        <div className="grid grid-cols-1 gap-3 pr-2">
          {/* 只在非编辑模式下显示创建和导入按钮 */}
          {!isInEditMode && (
            <div className="flex gap-2 mb-2">
              <div 
                className="flex-1 border rounded-md p-3 flex flex-col justify-center items-center cursor-pointer transition-colors duration-200 h-[80px] hover:border-blue-300 hover:bg-blue-50"
                onClick={onCreateNewAgent}
              >
                <div className="flex items-center justify-center h-full text-blue-500">
                  <span className="text-lg mr-2">+</span>
                  <span className="text-sm">{t('subAgentPool.button.create')}</span>
                </div>
              </div>

              <div
                className={`flex-1 border rounded-md p-3 flex flex-col justify-center items-center transition-colors duration-200 h-[80px] ${
                  isImporting
                    ? 'bg-gray-50 border-gray-300 cursor-not-allowed' // 导入中：禁用状态
                    : 'cursor-pointer hover:border-green-300 hover:bg-green-50' // 正常状态：可点击
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
          )}

          {/* 重新排序Agent列表，将正在编辑的Agent放在顶部 */}
          {(() => {
            // 在编辑模式下，过滤掉正在编辑的Agent
            const filteredAgentList = isInEditMode && editingAgent 
              ? subAgentList.filter(agent => String(agent.id) !== String(editingAgent.id))
              : subAgentList;
            
            return filteredAgentList.map((agent) => {
              const isEnabled = enabledAgentIds.includes(Number(agent.id));
              const isAvailable = agent.is_available !== false; // 默认为true，只有明确为false时才不可用
              const isCurrentlyEditing = editingAgent && String(editingAgent.id) === String(agent.id); // 确保类型匹配
              
              return (
                <div 
                  key={agent.id} 
                  className={`border rounded-md p-3 flex flex-col justify-center transition-all duration-300 ease-in-out h-[80px] ${
                    isCurrentlyEditing
                      ? 'shadow-md' // 编辑中的agent只保留阴影
                      : !isInEditMode
                        ? 'bg-white border-gray-200' // 非编辑模式：正常显示，但不可点击
                        : !isAvailable
                          ? isEnabled
                            ? 'bg-blue-100 border-blue-400 opacity-60'
                            : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                          : isEnabled 
                            ? 'bg-blue-100 border-blue-400' 
                            : 'hover:border-blue-300'
                  }`}
                  style={isCurrentlyEditing ? { border: '2px solid #3b82f6' } : undefined} // 使用内联样式确保蓝色边框
                  title={!isInEditMode
                    ? t('subAgentPool.tooltip.viewOnlyMode')
                    : !isAvailable 
                      ? isEnabled 
                        ? t('subAgentPool.tooltip.disabledAgent')
                        : t('subAgentPool.tooltip.unavailableAgent')
                      : agent.name}
                  onClick={async (e) => {
                    // 阻止事件冒泡
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 只有在编辑模式或新建模式下才允许选择agent，且不在生成过程中
                    if (!isInEditMode || isGeneratingAgent) {
                      return;
                    }
                    
                    // 如果没有父agent ID，无法建立关联关系
                    if (!parentAgentId) {
                      message.warning(t('subAgentPool.message.noParentAgent'));
                      return;
                    }
                    
                    // 点击自身agent时，不进行任何操作
                    if (editingAgent && String(editingAgent.id) === String(agent.id)) {
                      return;
                    }
                    
                    if (!isAvailable && !isEnabled) {
                      message.warning(t('subAgentPool.message.unavailable'));
                      return;
                    }
                    
                    try {
                      if (isEnabled) {
                        // 取消选中：删除关联关系
                        const result = await deleteRelatedAgent(parentAgentId, Number(agent.id));
                        if (result.success) {
                          // 操作成功后直接更新本地状态
                          // 从enabledAgentIds中移除当前agent
                          const newEnabledAgentIds = enabledAgentIds.filter(id => id !== Number(agent.id));
                          // 直接更新enabledAgentIds
                          onUpdateEnabledAgentIds?.(newEnabledAgentIds);
                        } else {
                          message.error(result.message || t('subAgentPool.message.relationRemoveFailed'));
                        }
                      } else {
                        // 选中：添加关联关系
                        const result = await addRelatedAgent(parentAgentId, Number(agent.id));
                        if (result.success) {
                          // 操作成功后直接更新本地状态
                          // 向enabledAgentIds中添加当前agent
                          const newEnabledAgentIds = [...enabledAgentIds, Number(agent.id)];
                          // 直接更新enabledAgentIds
                          onUpdateEnabledAgentIds?.(newEnabledAgentIds);
                        } else {
                          message.error(result.message || t('subAgentPool.message.relationAddFailed'));
                        }
                      }
                    } catch (error) {
                      console.error('操作关联Agent失败:', error);
                      message.error(t('subAgentPool.message.operationFailed'));
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, agent)}
                >
                  <div className="flex items-center h-full">
                    <div className="flex-1 overflow-hidden">
                      <div className={`font-medium text-sm truncate transition-colors duration-300 ${
                        (!isAvailable && !isEnabled) 
                          ? 'text-gray-500' // 只有不可用时使用灰色
                          : ''
                      }`} 
                           title={!isInEditMode
                             ? t('subAgentPool.tooltip.viewOnlyMode')
                             : !isAvailable 
                               ? isEnabled 
                                 ? t('subAgentPool.tooltip.disabledAgent')
                                 : t('subAgentPool.tooltip.unavailableAgent')
                               : agent.name}>
                        {agent.name}
                      </div>
                      <div 
                        className={`text-xs line-clamp-2 transition-colors duration-300 ${
                          (!isAvailable && !isEnabled) 
                            ? 'text-gray-400' // 只有不可用时使用浅灰色
                            : 'text-gray-500'
                        }`}
                        title={agent.description}
                      >
                        {agent.description}
                      </div>
                    </div>
                    {/* 配置按钮：在非编辑模式下显示，在编辑模式下只对非当前编辑的agent显示 */}
                    {(!isInEditMode) || (isEditingAgent && !isCurrentlyEditing) ? (
                      <div className="flex flex-col gap-1 ml-2">
                        <button
                          className={`p-1 rounded text-xs transition-colors ${
                            !isAvailable ? 'text-gray-400 hover:text-gray-600' : 'text-gray-500 hover:text-blue-500'
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEditAgent(agent);
                          }}
                          title={!isInEditMode ? t('subAgentPool.tooltip.viewOnlyMode') : t('agent.contextMenu.edit')}
                          disabled={!isAvailable}
                        >
                          <SettingOutlined />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            });
          })()}
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