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

// EmptyState component defined directly in this file
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

  // Create mode state
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [hasClickedUpload, setHasClickedUpload] = useState(false);
  const [hasShownNameError, setHasShownNameError] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Add preload logic
  useEffect(() => {
    // 在组件挂载时预加载知识库列表
    fetchKnowledgeBases(true, true);
  }, [fetchKnowledgeBases]);

  // Add event listener for selecting new knowledge base
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

  // UI configuration variables
  const UI_CONFIG = {
    CREATE_BUTTON_HEIGHT: '50px',                // 创建知识库按钮高度
    CONTAINER_HEIGHT: '75.6vh'                     // 容器整体高度
  };

  // Generate unique knowledge base name
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

  // Handle knowledge base click logic, set current active knowledge base
  const handleKnowledgeBaseClick = (kb: KnowledgeBase) => {
    setIsCreatingMode(false); // Reset creating mode
    setHasClickedUpload(false); // 重置上传按钮点击状态
    setActiveKnowledgeBase(kb);
    fetchDocuments(kb.id);
    
    // 调用知识库切换处理函数
    handleKnowledgeBaseChange(kb);
  }

  // Handle knowledge base change event
  const handleKnowledgeBaseChange = async (kb: KnowledgeBase) => {
    // First use the current cached knowledge base data
    
    // Background request to get latest document data (non-blocking UI)
    setTimeout(async () => {
      try {
        // Use the refresh method from context to update knowledge base data
        await refreshKnowledgeBaseData(false); // 不强制刷新，先使用缓存
      } catch (error) {
        console.error("获取知识库最新数据失败:", error);
        // Error doesn't affect user experience, continue using cached data
      }
    }, 100);
  };

  // Add a drag and drop upload related handler function
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

  // Handle knowledge base deletion
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
          
          // Clear preloaded data, force fetch latest data from server
          localStorage.removeItem('preloaded_kb_data');
          
          // Delay 1 second before refreshing knowledge base list to ensure backend processing is complete
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

  // Handle knowledge base sync
  const handleSync = () => {
    // When manually syncing, force fetch latest data from server
    refreshKnowledgeBaseData(true)
      .then(() => {
        message.success("同步知识库成功");
      })
      .catch((error) => {
        message.error("同步知识库失败: " + (error.message || '未知错误'));
      });
  }

  // Handle new knowledge base creation
  const handleCreateNew = () => {
    // Generate default knowledge base name
    const defaultName = generateUniqueKbName(kbState.knowledgeBases);
    setNewKbName(defaultName);
    setIsCreatingMode(true);
    setHasClickedUpload(false); // 重置上传按钮点击状态
    setActiveKnowledgeBase(null as unknown as KnowledgeBase);
    setUploadFiles([]); // 重置上传文件数组，清空所有待上传文件
  };

  // Handle document deletion
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

  // Handle file upload
  const handleFileUpload = async (files?: File[]) => {
    const filesToUpload = files || uploadFiles;
    
    // If no files, don't show warning, return directly
    if (filesToUpload.length === 0) {
      return;
    }

    // Set upload button clicked flag
    setHasClickedUpload(true);

    // When user clicks Upload Files button, immediately disable title editing
    if (isCreatingMode) {
      // First trim knowledge base name, if empty generate a default name
      const trimmedName = newKbName.trim();
      const effectiveKbName = trimmedName || generateUniqueKbName(kbState.knowledgeBases);
      setNewKbName(effectiveKbName);
      
      try {
        // 1. First perform knowledge base name duplicate check
        const nameExists = await knowledgeBaseService.checkKnowledgeBaseNameExists(effectiveKbName);
        
        if (nameExists) {
          message.error(`知识库名称"${effectiveKbName}"已存在，请更换名称`);
          setHasShownNameError(true);
          setHasClickedUpload(false); // 重置上传按钮点击状态，允许用户修改名称
          return; // If name is duplicate, return directly, don't continue with subsequent logic
        }
        
        // 2. Create knowledge base
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
        
        // 3. Upload files to new knowledge base
        await uploadDocuments(kb.id, filesToUpload);
        
        // 4. Show success message
        message.success("知识库创建成功");
        
        // 5. Reset creation mode state
        setIsCreatingMode(false);
        setHasClickedUpload(false); // 重置上传状态
        setHasShownNameError(false); // 重置错误状态
        setUploadFiles([]); // 清空上传文件列表
        
        // Clear preloaded data, force fetch latest data from server
        localStorage.removeItem('preloaded_kb_data');
        
        // Notify system knowledge base data has been updated, force refresh needed
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
    
    // Non-creation mode upload
    const kbId = kbState.activeKnowledgeBase?.id;
    if (!kbId) {
      message.warning("请先选择一个知识库");
      return;
    }
    
    try {
      await uploadDocuments(kbId, filesToUpload);
      message.success("文件上传成功");
      setUploadFiles([]);
      
      // Delay 2 seconds before refreshing knowledge base list to ensure backend processing is complete
      setTimeout(async () => {
        // Clear preloaded data, force fetch latest data from server
        localStorage.removeItem('preloaded_kb_data');
        await fetchKnowledgeBases(false, false);
      }, 2000);
      
    } catch (error) {
      message.error("文件上传失败");
    }
  }

  // File selection handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFiles(Array.from(e.target.files));
    }
  }

  // Get current viewing knowledge base documents
  const viewingDocuments = kbState.activeKnowledgeBase 
    ? docState.documentsMap[kbState.activeKnowledgeBase.id] || []
    : [];

  // Get current knowledge base name
  const viewingKbName = kbState.activeKnowledgeBase?.name || "";

  // Handle knowledge base selection
  const handleSelectKnowledgeBase = (id: string) => {
    selectKnowledgeBase(id);
    
    // When selecting knowledge base also get latest data (low priority background operation)
    setTimeout(async () => {
      try {
        // Use lower priority to refresh data as this is not a critical operation
        await refreshKnowledgeBaseData(false);
      } catch (error) {
        console.error("刷新知识库数据失败:", error);
        // Error doesn't affect user experience
      }
    }, 500); // Delay execution, lower priority
  }

  // Handle auto summary
  const handleAutoSummary = async () => {
    if (!viewingKbName) {
      message.warning('请先选择一个知识库');
      return;
    }

    setIsSummarizing(true);
    try {
      const summary = await summaryIndex(viewingKbName);
      // Here you can process the returned summary content based on actual needs
      // For example display in dialog or update to some state
      message.success('知识库总结完成');
      // TODO: Handle summary content
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
        className="flex h-full mb-4"
        style={{ height: UI_CONFIG.CONTAINER_HEIGHT }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Left knowledge base list - occupies 1/3 space */}
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
            onKnowledgeBaseChange={() => {}} // No need to trigger repeatedly here as it's already handled in handleKnowledgeBaseClick
          />
        </div>
        
        {/* Right content area - occupies 2/3 space */}
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
              // Upload related props
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
              // Upload related props
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
            <div className="flex items-center justify-center h-full border border-gray-200 rounded-md bg-white h-full">
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

