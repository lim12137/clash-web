"use client"

import { useState } from 'react'
import { message } from 'antd'
import { SettingOutlined, UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/components/ui/scrollArea'
import AgentContextMenu from './AgentContextMenu'
import { Agent } from '../ConstInterface'

interface SubAgentPoolProps {
  selectedAgents: Agent[];
  onSelectAgent: (agent: Agent, isSelected: boolean) => void;
  onEditAgent: (agent: Agent) => void;
  onCreateNewAgent: () => void;
  onImportAgent: () => void;
  onExportAgent: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
  subAgentList?: Agent[];
  loadingAgents?: boolean;
  enabledAgentIds?: number[];
  isImporting?: boolean;
}

/**
 * Sub Agent Pool Component
 */
export default function SubAgentPool({ 
  selectedAgents, 
  onSelectAgent, 
  onEditAgent, 
  onCreateNewAgent, 
  onImportAgent,
  onExportAgent,
  onDeleteAgent,
  subAgentList = [],
  loadingAgents = false,
  enabledAgentIds = [],
  isImporting = false
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
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
            1
          </div>
          <h2 className="text-lg font-medium">{t('subAgentPool.title')}</h2>
        </div>
        {loadingAgents && <span className="text-sm text-gray-500">{t('subAgentPool.loading')}</span>}
      </div>
      <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
        <div className="grid grid-cols-1 gap-3 pr-2">
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
                  ? 'opacity-50 cursor-not-allowed border-gray-300'
                  : 'cursor-pointer hover:border-green-300 hover:bg-green-50'
              }`}
              onClick={isImporting ? undefined : onImportAgent}
            >
              <div className={`flex items-center justify-center h-full ${isImporting ? 'text-gray-400' : 'text-green-500'}`}>
                <UploadOutlined className="text-lg mr-2" />
                <span className="text-sm">{isImporting ? t('subAgentPool.button.importing') : t('subAgentPool.button.import')}</span>
              </div>
            </div>
          </div>

          {subAgentList.map((agent) => {
            const isEnabled = enabledAgentIds.includes(Number(agent.id));
            const isAvailable = agent.is_available !== false; // 默认为true，只有明确为false时才不可用
            return (
              <div 
                key={agent.id} 
                className={`border rounded-md p-3 flex flex-col justify-center transition-colors duration-200 h-[80px] ${
                  !isAvailable
                    ? isEnabled
                      ? 'bg-blue-100 border-blue-400 opacity-60'
                      : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                    : isEnabled 
                      ? 'bg-blue-100 border-blue-400' 
                      : 'hover:border-blue-300'
                }`}
                title={!isAvailable 
                  ? isEnabled 
                    ? t('subAgentPool.tooltip.disabledAgent')
                    : t('subAgentPool.tooltip.unavailableAgent')
                  : undefined}
                onClick={() => {
                  if (!isAvailable && !isEnabled) {
                    message.warning(t('subAgentPool.message.unavailable'));
                    return;
                  }
                  // 如果Agent不可用但已启用，允许禁用它
                  if (!isAvailable && isEnabled) {
                    onSelectAgent(agent, false);
                    return;
                  }
                  onSelectAgent(agent, !isEnabled);
                }}
                onContextMenu={(e) => handleContextMenu(e, agent)}
              >
                <div className="flex items-center h-full">
                  <div className="flex-1 overflow-hidden">
                    <div className={`font-medium text-sm truncate ${!isAvailable && !isEnabled ? 'text-gray-400' : ''}`} 
                         title={!isAvailable 
                           ? isEnabled 
                             ? t('subAgentPool.tooltip.disabledAgent')
                             : t('subAgentPool.tooltip.unavailableAgent')
                           : agent.name}>
                      {agent.name}
                    </div>
                    <div 
                      className={`text-xs line-clamp-2 ${!isAvailable && !isEnabled ? 'text-gray-400' : 'text-gray-500'}`}
                      title={agent.description}
                    >
                      {agent.description}
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditAgent(agent);
                    }}
                    className={`ml-2 flex-shrink-0 flex items-center justify-center bg-transparent ${
                      !isAvailable ? 'text-gray-400 hover:text-gray-600' : 'text-gray-500 hover:text-blue-500'
                    }`}
                    style={{ border: "none", padding: "4px" }}
                  >
                    <SettingOutlined style={{ fontSize: '16px' }} />
                  </button>
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