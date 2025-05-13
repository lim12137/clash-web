import React, { useState, forwardRef, useImperativeHandle, useEffect, useCallback, useRef } from 'react';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { API_ENDPOINTS } from '@/services/api';
import UploadAreaUI from './UploadAreaUI';
import { 
  customUploadRequest,
  checkKnowledgeBaseNameExists,
  fetchKnowledgeBaseInfo,
  validateFileType,
  createMockFileSelectEvent
} from './UploadService';

interface UploadAreaProps {
  isDragging?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedFiles?: File[];
  onUpload?: () => void;
  isUploading?: boolean;
  disabled?: boolean;
  componentHeight?: string;
  isCreatingMode?: boolean;
  uploadUrl?: string;
  indexName?: string;
  newKnowledgeBaseName?: string;
}

export interface UploadAreaRef {
  fileList: UploadFile[];
}

const UploadArea = forwardRef<UploadAreaRef, UploadAreaProps>(({
  onFileSelect,
  onUpload,
  isUploading = false,
  disabled = false,
  componentHeight = '300px',
  isCreatingMode = false,
  uploadUrl = '/api/upload',
  indexName = '',
  newKnowledgeBaseName = '',
  selectedFiles = []
}, ref) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [nameExists, setNameExists] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isKnowledgeBaseReady, setIsKnowledgeBaseReady] = useState(false);
  const currentKnowledgeBaseRef = useRef<string>('');
  const pendingRequestRef = useRef<AbortController | null>(null);
  
  // 重置所有状态的函数
  const resetAllStates = useCallback(() => {
    setFileList([]);
    setNameExists(false);
    setIsLoading(true);
    setIsKnowledgeBaseReady(false);
  }, []);

  // 监听知识库变化，重置文件列表并获取知识库信息
  useEffect(() => {
    // 如果知识库名称没有变化，不进行重置
    if (indexName === currentKnowledgeBaseRef.current) {
      return;
    }

    // 取消之前的请求
    if (pendingRequestRef.current) {
      pendingRequestRef.current.abort();
      pendingRequestRef.current = null;
    }

    // 立即重置状态和清空文件列表
    resetAllStates();
    
    // 更新当前知识库引用
    currentKnowledgeBaseRef.current = indexName;

    if (!indexName || isCreatingMode) {
      setIsKnowledgeBaseReady(true);
      setIsLoading(false);
      return;
    }

    // 创建新的 AbortController
    const abortController = new AbortController();
    pendingRequestRef.current = abortController;

    // 使用服务函数获取知识库信息
    fetchKnowledgeBaseInfo(
      indexName, 
      abortController, 
      currentKnowledgeBaseRef,
      () => {
        setIsKnowledgeBaseReady(true);
        setIsLoading(false);
      },
      () => {
        setIsKnowledgeBaseReady(false);
        setIsLoading(false);
      }
    );

    // 清理函数
    return () => {
      if (pendingRequestRef.current) {
        pendingRequestRef.current.abort();
        pendingRequestRef.current = null;
      }
    };
  }, [indexName, isCreatingMode, resetAllStates]);
  
  // 使用本地开发服务器URL
  const effectiveUploadUrl = uploadUrl === '/api/upload' 
    ? API_ENDPOINTS.knowledgeBase.upload 
    : uploadUrl;
  
  // 暴露文件列表给父组件
  useImperativeHandle(ref, () => ({
    fileList
  }), [fileList]);
  
  // 检查知识库名称是否已存在
  useEffect(() => {
    if (!isCreatingMode || !newKnowledgeBaseName) {
      setNameExists(false);
      return;
    }

    let isActive = true;

    const checkName = async () => {
      try {
        const exists = await checkKnowledgeBaseNameExists(newKnowledgeBaseName);
        if (isActive) {
          setNameExists(exists);
        }
      } catch (error) {
        if (isActive) {
          console.error('检查知识库名称失败:', error);
        }
      }
    };
      
    checkName();

    return () => {
      isActive = false;
    };
  }, [isCreatingMode, newKnowledgeBaseName]);
  
  // 处理文件变更
  const handleChange = useCallback(({ fileList: newFileList }: { fileList: UploadFile[] }) => {
    // 确保只更新当前知识库的文件列表
    if (indexName === currentKnowledgeBaseRef.current) {
      const currentUploadFiles = newFileList.filter((file: UploadFile) => 
        file.status === 'uploading' || 
        file.status === 'done' || 
        file.status === 'error'
      );
      setFileList(currentUploadFiles);
    }
    
    // 触发文件选择回调
    if (newFileList.length > 0) {
      const lastFile = newFileList[newFileList.length - 1];
      if (lastFile.originFileObj) {
        try {
          const mockEvent = createMockFileSelectEvent(lastFile);
          onFileSelect(mockEvent);
        } catch (error) {
          console.error('创建模拟事件失败:', error);
        }
      }
    }
  }, [indexName, onFileSelect]);

  // 处理自定义上传请求
  const handleCustomRequest = useCallback((options: any) => {
    return customUploadRequest(
      options,
      effectiveUploadUrl,
      isCreatingMode,
      newKnowledgeBaseName,
      indexName,
      currentKnowledgeBaseRef
    );
  }, [effectiveUploadUrl, isCreatingMode, newKnowledgeBaseName, indexName]);

  // 上传组件属性
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    onChange: handleChange,
    customRequest: handleCustomRequest,
    accept: '.pdf,.docx,.pptx,.xlsx,.md,.txt',
    showUploadList: true,
    disabled: disabled,
    progress: {
      strokeColor: {
        '0%': '#108ee9',
        '100%': '#87d068',
      },
      size: 3,
      format: (percent?: number) => percent ? `${parseFloat(percent.toFixed(2))}%` : '0%'
    },
    beforeUpload: validateFileType
  };
  
  return (
    <UploadAreaUI
      fileList={fileList}
      uploadProps={uploadProps}
      isLoading={isLoading}
      isKnowledgeBaseReady={isKnowledgeBaseReady}
      isCreatingMode={isCreatingMode}
      nameExists={nameExists}
      isUploading={isUploading}
      disabled={disabled}
      componentHeight={componentHeight}
      newKnowledgeBaseName={newKnowledgeBaseName}
      selectedFiles={selectedFiles}
    />
  );
});

export default UploadArea; 