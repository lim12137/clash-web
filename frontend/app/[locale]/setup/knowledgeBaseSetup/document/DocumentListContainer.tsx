import React, { useRef, forwardRef, useImperativeHandle } from 'react'
import { Document, NON_TERMINAL_STATUSES } from '@/types/knowledgeBase'
import { sortByStatusAndDate } from '@/lib/utils'
import knowledgeBasePollingService from '@/services/knowledgeBasePollingService'
import DocumentListLayout, { UI_CONFIG } from './DocumentListLayout'
import { useDocumentContext } from './DocumentContext'
import { useTranslation } from 'react-i18next'

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
  onFileSelect: (files: File[]) => void
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
  const uploadAreaRef = useRef<any>(null);
  const { state: docState } = useDocumentContext();
  const { t } = useTranslation();

  // 使用固定高度而不是百分比
  const titleBarHeight = UI_CONFIG.TITLE_BAR_HEIGHT;
  const uploadHeight = UI_CONFIG.UPLOAD_COMPONENT_HEIGHT;
  
  // 计算文档列表区域高度 = 总高度 - 标题栏高度 - 上传区域高度
  const contentHeight = `calc(${containerHeight} - ${titleBarHeight} - ${uploadHeight})`;

  // 按状态和日期排序的文档列表
  const sortedDocuments = sortByStatusAndDate(documents);

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
      return t('document.modelMismatch.withModels', {
        currentModel,
        knowledgeBaseModel
      });
    }
    return t('document.modelMismatch.general');
  }

  // 暴露 uppy 实例给父组件
  useImperativeHandle(ref, () => ({
    uppy: uploadAreaRef.current?.uppy
  }));

  return (
    <DocumentListLayout
      sortedDocuments={sortedDocuments}
      knowledgeBaseName={knowledgeBaseName}
      loading={docState.isLoadingDocuments}
      isInitialLoad={false}
      modelMismatch={modelMismatch}
      isCreatingMode={isCreatingMode}
      isUploading={isUploading}
      nameLockedAfterUpload={false}
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
      handleUpload={onUpload || (() => {})}
      uploadUrl={uploadUrl}
    />
  )
});

export default DocumentListContainer 