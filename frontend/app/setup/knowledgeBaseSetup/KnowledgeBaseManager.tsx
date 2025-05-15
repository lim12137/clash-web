"use client"

import type React from "react"
import { useState, useEffect } from "react"

import { message, Button } from 'antd'
import { InfoCircleFilled } from '@ant-design/icons'

// Import AppProvider and hooks
import AppProvider from './AppProvider'
import { useKnowledgeBaseContext } from './knowledgeBase/KnowledgeBaseContext'
import { KnowledgeBase } from '@/types/knowledgeBase'
import { useDocumentContext } from './document/DocumentContext'
import { useUIContext } from './UIStateManager'
import knowledgeBaseService from '@/services/knowledgeBaseService'

// Import new components
import KnowledgeBaseList from './knowledgeBase/KnowledgeBaseList'

import DocumentList from './document/DocumentListContainer'

import ConfirmModal from './components/ConfirmModal'

// EmptyState组件直接定义在此文件中
interface EmptyStateProps {
  icon?: React.ReactNode | string
  title: string
  description?: string
  action?: React.ReactNode
  containerHeight?: string
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📋',
  title,
  description,
  action,
  containerHeight = '100%'
}) => {
  return (
    <div 
      className="flex items-center justify-center p-4"
      style={{ height: containerHeight }}
    >
      <div className="text-center">
        {typeof icon === 'string' ? (
          <div className="text-gray-400 text-3xl mb-2">{icon}</div>
        ) : (
          <div className="text-gray-400 mb-2">{icon}</div>
        )}
        <h3 className="text-base font-medium text-gray-700 mb-1">{title}</h3>
        {description && (
          <p className="text-gray-500 max-w-md text-xs mb-4">{description}</p>
        )}
        {action && (
          <div className="mt-2">{action}</div>
        )}
      </div>
    </div>
  )
}

// Update the wrapper component
export default function DataConfigWrapper() {
  return (
    <AppProvider>
      <DataConfig />
    </AppProvider>
  )
}

function DataConfig() {
  // Get context values
  const { 
    state: kbState, 
    fetchKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    selectKnowledgeBase,
    setActiveKnowledgeBase,
    isKnowledgeBaseSelectable,
    refreshKnowledgeBaseData,
    summaryIndex,
    changeSummary
  } = useKnowledgeBaseContext();

  const {
    state: docState,
    fetchDocuments,
    uploadDocuments,
    deleteDocument
  } = useDocumentContext();

  const {
    state: uiState,
    setDragging,
    toggleCreateModal,
    toggleDocModal,
    showNotification
  } = useUIContext();

  // 创建模式状态
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [hasClickedUpload, setHasClickedUpload] = useState(false);
  const [hasShownNameError, setHasShownNameError] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 添加预加载逻辑
  useEffect(() => {
    // 在组件挂载时预加载知识库列表
    fetchKnowledgeBases(true, true);
  }, [fetchKnowledgeBases]);

  // 添加监听选中新知识库的事件
  useEffect(() => {
    const handleSelectNewKnowledgeBase = (e: CustomEvent) => {
      const kbName = e.detail.name;
      const kb = kbState.knowledgeBases.find(kb => kb.name === kbName);
      if (kb) {
        // 执行与点击知识库相同的逻辑
        setIsCreatingMode(false); // 重置创建模式
        setHasClickedUpload(false); // 重置上传按钮点击状态
        setActiveKnowledgeBase(kb);
        fetchDocuments(kb.id);
      }
    };
    
    window.addEventListener('selectNewKnowledgeBase', handleSelectNewKnowledgeBase as EventListener);
    
    return () => {
      window.removeEventListener('selectNewKnowledgeBase', handleSelectNewKnowledgeBase as EventListener);
    };
  }, [kbState.knowledgeBases, setActiveKnowledgeBase, fetchDocuments, setIsCreatingMode, setHasClickedUpload]);

  // UI配置变量
  const UI_CONFIG = {
    CREATE_BUTTON_HEIGHT: '50px',                // 创建知识库按钮高度
    CONTAINER_HEIGHT: '71.6vh'                     // 容器整体高度
  };

  // 生成唯一的知识库名称
  const generateUniqueKbName = (existingKbs: KnowledgeBase[]): string => {
    const baseNamePrefix = "新知识库";
    const existingNames = new Set(existingKbs.map(kb => kb.name));
    
    // 如果基础名称未被使用，直接返回
    if (!existingNames.has(baseNamePrefix)) {
      return baseNamePrefix;
    }
    
    // 否则尝试添加数字后缀，直到找到未被使用的名称
    let counter = 1;
    while (existingNames.has(`${baseNamePrefix}${counter}`)) {
      counter++;
    }
    
    return `${baseNamePrefix}${counter}`;
  };

  // 处理点击知识库的逻辑，设置当前活动知识库
  const handleKnowledgeBaseClick = (kb: KnowledgeBase) => {
    setIsCreatingMode(false); // Reset creating mode
    setHasClickedUpload(false); // 重置上传按钮点击状态
    setActiveKnowledgeBase(kb);
    fetchDocuments(kb.id);
    
    // 调用知识库切换处理函数
    handleKnowledgeBaseChange(kb);
  }

  // 处理知识库切换事件
  const handleKnowledgeBaseChange = async (kb: KnowledgeBase) => {
    // 首先使用当前缓存中的知识库数据
    
    // 后台发送请求获取最新文档数据 (不阻塞UI)
    setTimeout(async () => {
      try {
        // 使用上下文中的刷新方法更新知识库数据
        await refreshKnowledgeBaseData(false); // 不强制刷新，先使用缓存
      } catch (error) {
        console.error("获取知识库最新数据失败:", error);
        // 错误发生时不影响用户体验，继续使用缓存数据
      }
    }, 100);
  };

  // 添加一个拖拽上传相关的处理函数
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }

  const handleDragLeave = () => {
    setDragging(false);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    // 如果是创建模式或有活动知识库，则处理文件
    if (isCreatingMode || kbState.activeKnowledgeBase) {
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        setUploadFiles(files);
        handleFileUpload(files);
      }
    } else {
      message.warning("请先选择一个知识库或创建新知识库");
    }
  }

  // 处理删除知识库
  const handleDelete = (id: string) => {
    ConfirmModal.confirm({
      title: '确定要删除这个知识库吗？',
      content: '删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteKnowledgeBase(id);
          
          // 清除预加载数据，强制从服务器获取最新数据
          localStorage.removeItem('preloaded_kb_data');
          
          // 延迟1秒后刷新知识库列表，确保后端处理完成
          setTimeout(async () => {
            await fetchKnowledgeBases(false, false);
            message.success("删除知识库成功");
          }, 1000);
        } catch (error) {
          message.error("删除知识库失败");
        }
      }
    });
  }

  // 处理同步知识库
  const handleSync = () => {
    // 手动同步时强制从服务器获取最新数据
    refreshKnowledgeBaseData(true)
      .then(() => {
        message.success("同步知识库成功");
      })
      .catch((error) => {
        message.error("同步知识库失败: " + (error.message || '未知错误'));
      });
  }

  // 处理创建新知识库
  const handleCreateNew = () => {
    // 生成默认知识库名称
    const defaultName = generateUniqueKbName(kbState.knowledgeBases);
    setNewKbName(defaultName);
    setIsCreatingMode(true);
    setHasClickedUpload(false); // 重置上传按钮点击状态
    setActiveKnowledgeBase(null as unknown as KnowledgeBase);
    setUploadFiles([]); // 重置上传文件数组，清空所有待上传文件
  };

  // 处理删除文档
  const handleDeleteDocument = (docId: string) => {
    const kbId = kbState.activeKnowledgeBase?.id;
    if (!kbId) return;

    ConfirmModal.confirm({
      title: '确定要删除这个文档吗？',
      content: '删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteDocument(kbId, docId);
          message.success("删除文档成功");
        } catch (error) {
          message.error("删除文档失败");
        }
      }
    });
  }

  // 处理上传文件
  const handleFileUpload = async (files?: File[]) => {
    const filesToUpload = files || uploadFiles;
    
    // 如果没有文件，不显示警告，直接返回
    if (filesToUpload.length === 0) {
      return;
    }

    // 设置上传按钮已点击标志
    setHasClickedUpload(true);

    // 在用户点击Upload Files按钮时，立即禁用标题编辑
    if (isCreatingMode) {
      // 先修整知识库名称，如果为空则生成一个默认名称
      const trimmedName = newKbName.trim();
      const effectiveKbName = trimmedName || generateUniqueKbName(kbState.knowledgeBases);
      setNewKbName(effectiveKbName);
      
      try {
        // 1. 先进行知识库名称重复校验
        const nameExists = await knowledgeBaseService.checkKnowledgeBaseNameExists(effectiveKbName);
        
        if (nameExists) {
          message.error(`知识库名称"${effectiveKbName}"已存在，请更换名称`);
          setHasShownNameError(true);
          setHasClickedUpload(false); // 重置上传按钮点击状态，允许用户修改名称
          return; // 如果名称重复，直接返回，不继续执行后续逻辑
        }
        
        // 2. 创建知识库
        const kb = await createKnowledgeBase(
          effectiveKbName,
          "",
          "elasticsearch"
        );
        
        if (!kb) {
          message.error("创建知识库失败");
          setHasClickedUpload(false); // 重置状态允许重试
          return;
        }
        
        // 3. 上传文件到新知识库
        await uploadDocuments(kb.id, filesToUpload);
        
        // 4. 显示成功消息
        message.success("知识库创建成功");
        
        // 5. 重置创建模式状态
        setIsCreatingMode(false);
        setHasClickedUpload(false); // 重置上传状态
        setHasShownNameError(false); // 重置错误状态
        setUploadFiles([]); // 清空上传文件列表
        
        // 清除预加载数据，强制从服务器获取最新数据
        localStorage.removeItem('preloaded_kb_data');
        
        // 通知系统知识库数据已更新，需要强制刷新
        window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
          detail: { forceRefresh: true }
        }));
        
      } catch (error) {
        console.error("知识库创建失败:", error);
        message.error("知识库创建失败");
        setHasClickedUpload(false); // 重置上传按钮点击状态，允许重试
      }
      return;
    }
    
    // 非创建模式上传
    const kbId = kbState.activeKnowledgeBase?.id;
    if (!kbId) {
      message.warning("请先选择一个知识库");
      return;
    }
    
    try {
      await uploadDocuments(kbId, filesToUpload);
      message.success("文件上传成功");
      setUploadFiles([]);
      
      // 延迟2秒后刷新知识库列表，确保后端处理完成
      setTimeout(async () => {
        // 清除预加载数据，强制从服务器获取最新数据
        localStorage.removeItem('preloaded_kb_data');
        await fetchKnowledgeBases(false, false);
      }, 2000);
      
    } catch (error) {
      message.error("文件上传失败");
    }
  }

  // 文件选择处理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFiles(Array.from(e.target.files));
    }
  }

  // 获取当前查看的知识库文档
  const viewingDocuments = kbState.activeKnowledgeBase 
    ? docState.documentsMap[kbState.activeKnowledgeBase.id] || []
    : [];

  // 获取当前知识库名称
  const viewingKbName = kbState.activeKnowledgeBase?.name || "";

  // 处理选择知识库
  const handleSelectKnowledgeBase = (id: string) => {
    selectKnowledgeBase(id);
    
    // 选择知识库时也获取最新数据（低优先级后台操作）
    setTimeout(async () => {
      try {
        // 使用较低优先级刷新数据，因为这不是关键操作
        await refreshKnowledgeBaseData(false);
      } catch (error) {
        console.error("刷新知识库数据失败:", error);
        // 错误不影响用户体验
      }
    }, 500); // 延迟执行，降低优先级
  }

  // 处理自动总结
  const handleAutoSummary = async () => {
    if (!viewingKbName) {
      message.warning('请先选择一个知识库');
      return;
    }

    setIsSummarizing(true);
    try {
      const summary = await summaryIndex(viewingKbName);
      // 这里可以根据实际需求处理返回的总结内容
      // 例如显示在对话框中或更新到某个状态中
      message.success('知识库总结完成');
      // TODO: 处理总结内容
    } catch (error) {
      message.error('获取知识库总结失败');
      console.error('获取知识库总结失败:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <>
      <div 
        className="flex h-full mb-8"
        style={{ height: UI_CONFIG.CONTAINER_HEIGHT }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 左侧知识库列表 - 占据1/3空间 */}
        <div className="w-1/3 p-3 pr-1.5">
          <KnowledgeBaseList
            knowledgeBases={kbState.knowledgeBases}
            selectedIds={kbState.selectedIds}
            activeKnowledgeBase={kbState.activeKnowledgeBase}
            currentEmbeddingModel={kbState.currentEmbeddingModel}
            isLoading={kbState.isLoading}
            onSelect={handleSelectKnowledgeBase}
            onClick={handleKnowledgeBaseClick}
            onDelete={handleDelete}
            onSync={handleSync}
            onCreateNew={handleCreateNew}
            isSelectable={isKnowledgeBaseSelectable}
            getModelDisplayName={(modelId) => modelId}
            containerHeight={UI_CONFIG.CONTAINER_HEIGHT}
            onKnowledgeBaseChange={() => {}} // 这里不需要重复触发，因为已经在handleKnowledgeBaseClick中处理了
          />
        </div>
        
        {/* 右侧内容区域 - 占据2/3空间 */}
        <div className="w-2/3 p-3 pl-1.5 flex flex-col h-full">
          {isCreatingMode ? (
            <DocumentList
              documents={[]}
              onDelete={() => {}}
              isCreatingMode={true}
              knowledgeBaseName={newKbName}
              onNameChange={setNewKbName}
              containerHeight={UI_CONFIG.CONTAINER_HEIGHT}
              hasDocuments={hasClickedUpload || docState.isUploading}
              // 上传相关props
              isDragging={uiState.isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
              selectedFiles={uploadFiles}
              onUpload={() => handleFileUpload()}
              isUploading={docState.isUploading}
            />
          ) : kbState.activeKnowledgeBase ? (
            <DocumentList
              documents={viewingDocuments}
              onDelete={handleDeleteDocument}
              knowledgeBaseName={viewingKbName}
              loading={docState.loadingKbIds.has(kbState.activeKnowledgeBase.id)}
              modelMismatch={!isKnowledgeBaseSelectable(kbState.activeKnowledgeBase)}
              currentModel={kbState.currentEmbeddingModel || ''}
              knowledgeBaseModel={kbState.activeKnowledgeBase.embeddingModel}
              embeddingModelInfo={
                !isKnowledgeBaseSelectable(kbState.activeKnowledgeBase) ? 
                `当前模型${kbState.currentEmbeddingModel || ''}与知识库模型${kbState.activeKnowledgeBase.embeddingModel}不匹配，无法使用` : 
                undefined
              }
              containerHeight={UI_CONFIG.CONTAINER_HEIGHT}
              hasDocuments={viewingDocuments.length > 0}
              // 上传相关props
              isDragging={uiState.isDragging}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
              selectedFiles={uploadFiles}
              onUpload={() => handleFileUpload()}
              isUploading={docState.isUploading}
            />
          ) : (
            <div className="flex items-center justify-center h-full border border-gray-200 rounded-md bg-white" style={{ height: UI_CONFIG.CONTAINER_HEIGHT }}>
              <EmptyState
                title="未选择知识库"
                description="请在左侧列表选择一个知识库，或创建新的知识库"
                icon={<InfoCircleFilled style={{ fontSize: 36, color: '#1677ff' }} />}
                containerHeight={UI_CONFIG.CONTAINER_HEIGHT}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}

