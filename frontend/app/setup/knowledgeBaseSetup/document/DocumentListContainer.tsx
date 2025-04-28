import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import { Document } from '@/types/knowledgeBase'
import { sortByStatusAndDate } from '@/lib/utils'
import knowledgeBaseService from '@/services/knowledgeBaseService'
import DocumentListLayout, { UI_CONFIG } from './DocumentListLayout'

interface DocumentListProps {
  documents: Document[]
  onDelete: (id: string) => void
  knowledgeBaseName?: string // 当前知识库名称，用于显示标题
  loading?: boolean // 是否正在加载
  modelMismatch?: boolean // 模型不匹配标志
  currentModel?: string // 当前使用的模型
  knowledgeBaseModel?: string // 知识库使用的模型
  embeddingModelInfo?: string // 嵌入模型信息
  containerHeight?: string // 容器总高度
  isCreatingMode?: boolean // 是否处于创建模式
  onNameChange?: (name: string) => void // 知识库名称变更
  hasDocuments?: boolean // 是否已经有文档上传
  
  // 上传相关的props
  isDragging?: boolean
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  selectedFiles?: File[]
  onUpload?: () => void
  isUploading?: boolean
  uploadUrl?: string
}

export interface DocumentListRef {
  uppy: any;
}

const DocumentListContainer = forwardRef<DocumentListRef, DocumentListProps>(({
  documents,
  onDelete,
  knowledgeBaseName = '',
  loading = false,
  modelMismatch = false,
  currentModel = '',
  knowledgeBaseModel = '',
  embeddingModelInfo = '',
  containerHeight = '57vh', // 默认整体容器高度
  isCreatingMode = false,
  onNameChange,
  hasDocuments = false,
  
  // 上传相关props
  isDragging = false,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  selectedFiles = [],
  onUpload,
  isUploading = false,
  uploadUrl = '/api/upload'
}, ref) => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [localDocuments, setLocalDocuments] = useState<Document[]>(documents);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const uploadAreaRef = useRef<any>(null);
  // 增加轮询状态控制
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeKbIdRef = useRef<string | null>(null);

  // 暴露 uppy 实例给父组件
  useImperativeHandle(ref, () => ({
    uppy: uploadAreaRef.current?.uppy
  }));

  // 使用固定高度而不是百分比
  const titleBarHeight = UI_CONFIG.TITLE_BAR_HEIGHT;
  const uploadHeight = UI_CONFIG.UPLOAD_COMPONENT_HEIGHT;
  
  // 计算文档列表区域高度 = 总高度 - 标题栏高度 - 上传区域高度
  const contentHeight = `calc(${containerHeight} - ${titleBarHeight} - ${uploadHeight})`;

  // 按状态和日期排序的文档列表
  const sortedDocuments = sortByStatusAndDate(localDocuments);

  // 当外部documents更新时，更新本地状态
  useEffect(() => {
    setLocalDocuments(documents);
    // 文档更新时检查是否需要启动轮询
    checkIfPollingNeeded(documents);
  }, [documents]);

  // 添加检查是否需要轮询的函数
  const checkIfPollingNeeded = (docs: Document[]) => {
    // 检查是否有文档正在处理中
    const hasProcessingDocs = docs.some(doc => 
      doc.status === "PROCESSING" || doc.status === "FORWARDING"
    );
    
    if (hasProcessingDocs && !isPolling) {
      // 如果有正在处理的文档且没有在轮询，则开始轮询
      startPolling();
    } else if (!hasProcessingDocs && isPolling) {
      // 如果没有正在处理的文档且正在轮询，则停止轮询
      stopPolling();
    }
  };

  // 启动轮询函数
  const startPolling = () => {
    // 如果没有知识库名称，不启动轮询
    if (!knowledgeBaseName) return;
    
    setIsPolling(true);
    console.log('开始轮询文档状态');
    
    // 清除可能存在的旧轮询
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // 启动新的轮询，每5秒查询一次
    pollingIntervalRef.current = setInterval(async () => {
      // 存储当前知识库ID到ref，保持最新状态
      // 找到第一个文档的知识库ID
      if (localDocuments.length > 0) {
        activeKbIdRef.current = localDocuments[0].kb_id;
      }
      
      if (activeKbIdRef.current) {
        try {
          // 获取最新文档状态，使用强制刷新参数
          const latestDocs = await knowledgeBaseService.getDocuments(activeKbIdRef.current, true);
          
          // 检查是否有文档状态变化
          const hasStatusChanged = checkStatusChanged(localDocuments, latestDocs);
          
          if (hasStatusChanged) {
            console.log('文档状态已更新');
            setLocalDocuments(latestDocs);
            
            // 检查是否还需要继续轮询
            const stillProcessing = latestDocs.some(doc => 
              doc.status === "PROCESSING" || doc.status === "FORWARDING"
            );
            
            if (!stillProcessing) {
              console.log('所有文档处理完成，停止轮询');
              stopPolling();
            }
            
            // 触发全局事件，通知其他组件文档状态已更新
            window.dispatchEvent(new CustomEvent('documentsUpdated', {
              detail: { 
                kbId: activeKbIdRef.current,
                documents: latestDocs 
              }
            }));
          }
        } catch (err) {
          console.error('轮询文档状态出错:', err);
        }
      }
    }, 5000); // 5秒轮询一次
  };

  // 停止轮询函数
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    console.log('停止轮询文档状态');
  };

  // 检查文档状态是否发生变化
  const checkStatusChanged = (oldDocs: Document[], newDocs: Document[]): boolean => {
    if (oldDocs.length !== newDocs.length) return true;
    
    // 创建旧文档的状态映射
    const oldStatusMap = new Map(
      oldDocs.map(doc => [doc.id, doc.status])
    );
    
    // 检查新文档中是否有状态变化
    return newDocs.some(doc => 
      !oldStatusMap.has(doc.id) || oldStatusMap.get(doc.id) !== doc.status
    );
  };

  // 组件卸载时清除轮询
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // 当知识库名称改变时，清除上传文件
  useEffect(() => {
    if (onFileSelect) {
      const emptyFileList = new DataTransfer();
      onFileSelect({ target: { files: emptyFileList.files } } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [knowledgeBaseName, onFileSelect]);

  // 当创建模式改变时，重置名称锁定状态
  useEffect(() => {
    if (isCreatingMode) {
      setNameLockedAfterUpload(false);
    }
  }, [isCreatingMode]);

  // 当上传按钮被点击时，需要锁定知识库名称
  const [nameLockedAfterUpload, setNameLockedAfterUpload] = useState(false);
  
  // 修改上传处理函数，确保一旦上传开始，就锁定知识库名称
  const handleUpload = () => {
    if (isCreatingMode && knowledgeBaseName) {
      setNameLockedAfterUpload(true);
    }
    
    if (onUpload) {
      onUpload();
      
      // 触发自定义事件，通知更新知识库列表
      window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated'));
      
      // 启动轮询器，检查文档状态更新
      startPolling();
      
      // 如果是创建模式，设置轮询检查新知识库是否创建成功
      if (isCreatingMode) {
        let checkCount = 0;
        const maxChecks = 30; // 最多检查30次(约30秒)
        
        // 创建一个轮询函数
        const checkForNewKnowledgeBase = () => {
          // 清除缓存，强制从服务器获取最新数据
          localStorage.removeItem('preloaded_kb_data');
          
          // 触发自定义事件，通知更新知识库列表(不使用缓存)
          window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
            detail: { forceRefresh: true }
          }));
          
          // 增加检查计数
          checkCount++;
          
          // 如果没有达到最大检查次数，1秒后再次检查
          if (checkCount < maxChecks) {
            setTimeout(() => {
              // 检查知识库是否已经创建
              const checkIfCreated = () => {
                // 获取当前知识库列表
                const knowledgeBases = JSON.parse(localStorage.getItem('preloaded_kb_data') || '[]');
                
                // 查找是否包含指定名称的知识库
                const newKb = knowledgeBases.find((kb: {name: string, id: string}) => kb.name === knowledgeBaseName);
                
                if (newKb) {
                  // 找到了新创建的知识库，触发选中事件
                  window.dispatchEvent(new CustomEvent('selectNewKnowledgeBase', {
                    detail: { name: knowledgeBaseName }
                  }));

                  return true; // 成功找到
                }
                
                return false; // 未找到
              };
              
              // 检查是否已创建
              const found = checkIfCreated();
              
              // 如果未找到，继续轮询
              if (!found) {
                checkForNewKnowledgeBase();
              }
            }, 1000);
          } else {
            // 达到最大检查次数，停止检查
          }
        };
        
        // 开始第一次检查，延迟2秒，给服务器处理时间
        setTimeout(checkForNewKnowledgeBase, 2000);
      }
    }
  };

  // 获取文件图标
  const getFileIcon = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return '📄'
      case 'word':
        return '📝'
      case 'excel':
        return '📊'
      case 'powerpoint':
        return '📑'
      default:
        return '📃'
    }
  }

  // 构建模型不匹配提示信息
  const getMismatchInfo = (): string => {
    if (embeddingModelInfo) return embeddingModelInfo;
    if (currentModel && knowledgeBaseModel) {
      return `当前模型${currentModel}与知识库模型${knowledgeBaseModel}不匹配，无法使用`;
    }
    return "当前模型不匹配，无法使用";
  }

  return (
    <DocumentListLayout
      sortedDocuments={sortedDocuments}
      knowledgeBaseName={knowledgeBaseName}
      loading={loading}
      isInitialLoad={isInitialLoad}
      modelMismatch={modelMismatch}
      isCreatingMode={isCreatingMode}
      isUploading={isUploading}
      nameLockedAfterUpload={nameLockedAfterUpload}
      hasDocuments={hasDocuments}
      containerHeight={containerHeight}
      contentHeight={contentHeight}
      titleBarHeight={titleBarHeight}
      uploadHeight={uploadHeight}
      
      // 函数
      getFileIcon={getFileIcon}
      getMismatchInfo={getMismatchInfo}
      onNameChange={onNameChange}
      onDelete={onDelete}
      
      // 上传相关props
      uploadAreaRef={uploadAreaRef}
      isDragging={isDragging}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onFileSelect={onFileSelect}
      selectedFiles={selectedFiles || []}
      handleUpload={handleUpload}
      uploadUrl={uploadUrl}
    />
  )
});

export default DocumentListContainer 