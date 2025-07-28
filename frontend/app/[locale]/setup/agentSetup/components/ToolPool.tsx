"use client"

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Button, Tag, message } from 'antd'
import { SettingOutlined, LoadingOutlined, ApiOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { ScrollArea } from '@/components/ui/scrollArea'
import { Tooltip as CustomTooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import ToolConfigModal from './ToolConfigModal'
import McpConfigModal from './McpConfigModal'
import { Tool } from '../ConstInterface'
import { fetchTools } from '@/services/agentConfigService'
import { updateToolList } from '@/services/mcpService'
import { handleToolSelectCommon } from '../utils/agentUtils'

interface ToolPoolProps {
  selectedTools: Tool[];
  onSelectTool: (tool: Tool, isSelected: boolean) => void;
  isCreatingNewAgent: boolean;
  tools?: Tool[];
  loadingTools?: boolean;
  mainAgentId?: string | null;
  localIsGenerating?: boolean;
  onToolsRefresh?: () => void;
}



/**
 * Tool Pool Component
 */
function ToolPool({ 
  selectedTools, 
  onSelectTool, 
  isCreatingNewAgent, 
  tools = [], 
  loadingTools = false,
  mainAgentId,
  localIsGenerating = false,
  onToolsRefresh
}: ToolPoolProps) {
  const { t } = useTranslation('common');

  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  const [pendingToolSelection, setPendingToolSelection] = useState<{tool: Tool, isSelected: boolean} | null>(null);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use useMemo to cache the tool list to avoid unnecessary recalculations
  const displayTools = useMemo(() => {
    const toolsToSort = tools || [];
    // Sort by create_time, earliest created tools first (ascending order)
    return toolsToSort.sort((a, b) => {
      // If either tool doesn't have create_time, treat it as newer (sort to bottom)
      if (!a.create_time && !b.create_time) return 0;
      if (!a.create_time) return 1;
      if (!b.create_time) return -1;
      
      // Compare create_time strings (ISO format can be compared directly)
      return a.create_time.localeCompare(b.create_time);
    });
  }, [tools]);

  // Use useMemo to cache the selected tool ID set to improve lookup efficiency
  const selectedToolIds = useMemo(() => {
    return new Set(selectedTools.map(tool => tool.id));
  }, [selectedTools]);

  // Use useCallback to cache the tool selection processing function
  const handleToolSelect = useCallback(async (tool: Tool, isSelected: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const { shouldProceed, params } = await handleToolSelectCommon(
      tool,
      isSelected,
      mainAgentId,
      t,
      (tool, isSelected) => onSelectTool(tool, isSelected)
    );

    if (!shouldProceed && params) {
      setCurrentTool({
        ...tool,
        initParams: tool.initParams.map(param => ({
          ...param,
          value: params[param.name] || param.value
        }))
      });
      setPendingToolSelection({ tool, isSelected });
      setIsToolModalOpen(true);
    }
  }, [mainAgentId, onSelectTool, t]);

  // Use useCallback to cache the tool configuration click processing function
  const handleConfigClick = useCallback((tool: Tool, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTool(tool);
    setIsToolModalOpen(true);
  }, []);

  // Use useCallback to cache the tool save processing function
  const handleToolSave = useCallback((updatedTool: Tool) => {
    if (pendingToolSelection) {
      const { tool, isSelected } = pendingToolSelection;
      const missingRequiredFields = updatedTool.initParams
        .filter(param => param.required && (param.value === undefined || param.value === '' || param.value === null))
        .map(param => param.name);

      if (missingRequiredFields.length > 0) {
        message.error(t('toolPool.error.requiredFields', { fields: missingRequiredFields.join(', ') }));
        return;
      }

      const mockEvent = {
        stopPropagation: () => {},
        preventDefault: () => {},
        nativeEvent: new MouseEvent('click'),
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist: () => {}
      } as React.MouseEvent;
      
      handleToolSelect(updatedTool, isSelected, mockEvent);
    }
    
    setIsToolModalOpen(false);
    setPendingToolSelection(null);
  }, [pendingToolSelection, handleToolSelect, t]);

  // Use useCallback to cache the modal close processing function
  const handleModalClose = useCallback(() => {
    setIsToolModalOpen(false);
    setPendingToolSelection(null);
  }, []);

  // 刷新工具列表的处理函数
  const handleRefreshTools = useCallback(async () => {
    if (isRefreshing || localIsGenerating) return;

    setIsRefreshing(true);
    try {
      // 第一步：更新后端工具状态，重新扫描MCP和本地工具
      const updateResult = await updateToolList();
      if (!updateResult.success) {
        message.warning(t('toolManagement.message.updateStatusFailed'));
      }

      // 第二步：获取最新的工具列表
      const fetchResult = await fetchTools();
      if (fetchResult.success) {
        // 调用父组件的刷新回调，更新工具列表状态
        if (onToolsRefresh) {
          onToolsRefresh();
        }
      } else {
        message.error(fetchResult.message || t('toolManagement.message.refreshFailed'));
      }
    } catch (error) {
      console.error(t('debug.console.refreshToolsFailed'), error);
      message.error(t('toolManagement.message.refreshFailedRetry'));
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, localIsGenerating, onToolsRefresh, t]);

  // 监听工具更新事件
  useEffect(() => {
    const handleToolsUpdate = async () => {
      try {
        // 重新获取最新的工具列表，确保包含新添加的MCP工具
        const fetchResult = await fetchTools();
        if (fetchResult.success) {
          // 调用父组件的刷新回调，更新工具列表状态
          if (onToolsRefresh) {
            onToolsRefresh();
          }
        } else {
          console.error('MCP配置后自动刷新工具列表失败:', fetchResult.message);
        }
      } catch (error) {
        console.error('MCP配置后自动刷新工具列表出错:', error);
      }
    };

    window.addEventListener('toolsUpdated', handleToolsUpdate);
    return () => {
      window.removeEventListener('toolsUpdated', handleToolsUpdate);
    };
  }, [onToolsRefresh]);

  // Use memo to optimize the rendering of tool items
  const ToolItem = memo(({ tool }: { tool: Tool }) => {
    const isSelected = selectedToolIds.has(tool.id);
    const isAvailable = tool.is_available !== false; // 默认为true，只有明确为false时才不可用
    
    return (
      <div 
        className={`border rounded-md p-2 flex items-center transition-colors duration-200 min-h-[45px] ${
          !isAvailable
            ? isSelected
              ? 'bg-blue-100 border-blue-400 opacity-60'
              : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
            : isSelected 
              ? 'bg-blue-100 border-blue-400' 
              : 'hover:border-blue-300'
        } ${localIsGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title={!isAvailable 
          ? isSelected 
            ? t('toolPool.tooltip.disabledTool')
            : t('toolPool.tooltip.unavailableTool')
          : tool.name}
        onClick={(e) => {
          if (localIsGenerating) return;
          if (!isAvailable && !isSelected) {
            message.warning(t('toolPool.message.unavailable'));
            return;
          }
          handleToolSelect(tool, !isSelected, e);
        }}
      >
        {/* Tool name left */}
        <div className="flex-1 overflow-hidden">
          <CustomTooltip>
            <TooltipTrigger asChild>
              <div
                className={`font-medium text-sm truncate ${!isAvailable && !isSelected ? 'text-gray-400' : ''}`}
                style={{
                  maxWidth: '300px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  verticalAlign: 'middle'
                }}
              >
                {tool.name}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {tool.name}
            </TooltipContent>
          </CustomTooltip>
        </div>
        {/* Tag and settings button right */}
        <div className="flex items-center gap-2 ml-2">
          <div className="flex items-center justify-start min-w-[90px] w-[90px]">
            <Tag color={tool?.source === 'mcp' ? 'blue' : 'green'} 
                 className={`w-full text-center ${!isAvailable && !isSelected ? 'opacity-50' : ''}`}>
              {tool?.source === 'mcp' ? t('toolPool.tag.mcp') : t('toolPool.tag.local')}
            </Tag>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();  // 防止触发父元素的点击事件
              if (localIsGenerating) return;
              if (!isAvailable) {
                if (isSelected) {
                  handleToolSelect(tool, false, e);
                } else {
                  message.warning(t('toolPool.message.unavailable'));
                }
                return;
              }
              handleConfigClick(tool, e);
            }}
            disabled={localIsGenerating}
            className={`flex-shrink-0 flex items-center justify-center bg-transparent ${
              localIsGenerating ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-blue-500'
            }`}
            style={{ border: "none", padding: "4px" }}
          >
            <SettingOutlined style={{ fontSize: '16px' }} />
          </button>
        </div>
      </div>
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
            2
          </div>
          <h2 className="text-lg font-medium">{t('toolPool.title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="text"
            size="small"
            icon={isRefreshing ? <LoadingOutlined /> : <ReloadOutlined />}
            onClick={handleRefreshTools}
            disabled={localIsGenerating || isRefreshing}
            className="text-green-500 hover:text-green-600 hover:bg-green-50"
            title={t('toolManagement.refresh.title')}
          >
            {isRefreshing ? t('toolManagement.refresh.button.refreshing') : t('toolManagement.refresh.button.refresh')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<ApiOutlined />}
            onClick={() => setIsMcpModalOpen(true)}
            disabled={localIsGenerating}
            className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
            title={t('toolManagement.mcp.title')}
          >
            {t('toolManagement.mcp.button')}
          </Button>
          {loadingTools && <span className="text-sm text-gray-500">{t('toolPool.loading')}</span>}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
        {loadingTools ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-500">{t('toolPool.loadingTools')}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pr-2">
            {displayTools.map((tool) => (
              <ToolItem key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </ScrollArea>

      <ToolConfigModal
        isOpen={isToolModalOpen}
        onCancel={handleModalClose}
        onSave={handleToolSave}
        tool={currentTool}
        mainAgentId={parseInt(mainAgentId || '0')}
        selectedTools={selectedTools}
      />

      <McpConfigModal
        visible={isMcpModalOpen}
        onCancel={() => setIsMcpModalOpen(false)}
      />
    </div>
  );
}

// Use memo to optimize the rendering of ToolPool component
export const MemoizedToolPool = memo(ToolPool); 