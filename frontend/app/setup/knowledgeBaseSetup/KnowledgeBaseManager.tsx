"use client"

import type React from "react"
import { useState, useEffect } from "react"

import { message } from 'antd'
import { InfoCircleFilled } from '@ant-design/icons'

// Import AppProvider and hooks
import AppProvider from './AppProvider'
import { useKnowledgeBaseContext } from './knowledgeBase/KnowledgeBaseContext'
import { KnowledgeBase } from '@/types/knowledgeBase'
import { useDocumentContext } from './document/DocumentContext'
import { useUIContext } from './UIStateManager'
import knowledgeBaseService from '@/services/knowledgeBaseService'
import knowledgeBasePollingService from '@/services/knowledgeBasePollingService'

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
    refreshKnowledgeBaseData
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

  // 添加预加载逻辑
  useEffect(() => {
    // 在组件挂载时预加载知识库列表
    fetchKnowledgeBases(true, true);
  }, [fetchKnowledgeBases]);

  // 添加监听选中新知识库的事件
  useEffect(() => {
    const handleSelectNewKnowledgeBase = (e: CustomEvent) => {
      const { knowledgeBase } = e.detail;
      if (knowledgeBase) {
        setIsCreatingMode(false);
        setHasClickedUpload(false);
        setActiveKnowledgeBase(knowledgeBase);
        fetchDocuments(knowledgeBase.id);
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
    
    // 设置活动知识库ID到轮询服务
    knowledgeBasePollingService.setActiveKnowledgeBase(kb.id);
    
    // 获取文档
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
        handleFileUpload();
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
  const handleFileUpload = async () => {
    // 确保有文件要上传
    if (!uploadFiles.length) {
      message.warning("请先选择文件");
      return;
    }
    
    const filesToUpload = uploadFiles;
    
    // 创建模式逻辑
    if (isCreatingMode) {
      if (!newKbName || newKbName.trim() === "") {
        message.warning("请输入知识库名称");
        return;
      }
      
      setHasClickedUpload(true); // 已点击上传按钮，则立即锁定知识库名称输入
      
      try {
        // 创建知识库
        const newKB = await createKnowledgeBase(newKbName.trim(), "通过文档上传创建的知识库");
        if (!newKB) {
          message.error("知识库创建失败");
          setHasClickedUpload(false); // 重置上传按钮点击状态，允许重试
          return;
        }
        
        // 上传文件到新知识库
        await uploadDocuments(newKB.id, filesToUpload);
        message.success("文件上传成功");
        setUploadFiles([]);
        
        // 立即设置为活动知识库并退出创建模式
        setActiveKnowledgeBase(newKB);
        knowledgeBasePollingService.setActiveKnowledgeBase(newKB.id);
        
        // 退出创建模式，防止用户修改知识库名称
        setIsCreatingMode(false);
        
        // 使用轮询服务等待知识库创建完成
        knowledgeBasePollingService.waitForKnowledgeBaseCreation(
          newKB.name,
          (found) => {
            if (found) {
              // 知识库创建成功后，设置为活动知识库
              setActiveKnowledgeBase(newKB);
              
              // 触发文档轮询，监控处理状态
              knowledgeBasePollingService.startDocumentStatusPolling(
                newKB.id,
                (documents) => {
                  knowledgeBasePollingService.triggerDocumentsUpdate(
                    newKB.id,
                    documents
                  );
                }
              );
              
              // 获取最新文档
              fetchDocuments(newKB.id);
            }
          }
        );
        
        // 使用polling service触发知识库和文档更新
        knowledgeBasePollingService.triggerKnowledgeBaseListUpdate(true);
        
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
      
      // 使用新的轮询服务
      knowledgeBasePollingService.triggerKnowledgeBaseListUpdate(true);
      
      // 启动文档状态轮询
      knowledgeBasePollingService.startDocumentStatusPolling(
        kbId,
        (documents) => {
          knowledgeBasePollingService.triggerDocumentsUpdate(
            kbId,
            documents
          );
        }
      );
      
      // 获取最新文档
      fetchDocuments(kbId);
      
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

  // 在组件初始化或活动知识库变化时更新轮询服务中的活动知识库ID
  useEffect(() => {
    if (kbState.activeKnowledgeBase) {
      knowledgeBasePollingService.setActiveKnowledgeBase(kbState.activeKnowledgeBase.id);
    } else if (isCreatingMode && newKbName) {
      knowledgeBasePollingService.setActiveKnowledgeBase(newKbName);
    } else {
      knowledgeBasePollingService.setActiveKnowledgeBase(null);
    }
  }, [kbState.activeKnowledgeBase, isCreatingMode, newKbName]);

  // 在组件卸载时清理轮询
  useEffect(() => {
    return () => {
      // 停止所有轮询
      knowledgeBasePollingService.stopAllPolling();
    };
  }, []);

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

