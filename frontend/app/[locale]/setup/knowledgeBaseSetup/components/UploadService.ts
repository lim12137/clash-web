import { message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import knowledgeBaseService from '@/services/knowledgeBaseService';
import knowledgeBasePollingService from '@/services/knowledgeBasePollingService';
import { useTranslation } from 'react-i18next';
import '../../../i18n';
import { TFunction } from 'i18next';

// 添加类型定义
export interface AbortableError extends Error {
  name: string;
}

// 简化更新缓存的通用函数
export const updateKnowledgeBaseCache = (forceRefresh: boolean = true) => {
  knowledgeBasePollingService.triggerKnowledgeBaseListUpdate(forceRefresh);
};

// 自定义上传请求函数
export const customUploadRequest = async (
  options: any, 
  effectiveUploadUrl: string, 
  isCreatingMode: boolean,
  newKnowledgeBaseName: string,
  indexName: string,
  currentKnowledgeBaseRef: React.MutableRefObject<string>
) => {
  const { t } = useTranslation('common');
  const { onSuccess, onError, file } = options;
  const effectiveIndexName = isCreatingMode ? newKnowledgeBaseName : indexName;
  
  // 确保是当前知识库
  if (effectiveIndexName !== currentKnowledgeBaseRef.current && !isCreatingMode) {
    onError(new Error(t('knowledgeBase.upload.switchError')));
    message.error(t('knowledgeBase.upload.fileUploadSwitchError', { fileName: file.name }));
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('index_name', effectiveIndexName);

  try {
    const response = await fetch(effectiveUploadUrl, {
      method: 'POST',
      body: formData,
    });

    // 再次确认是当前知识库
    if (effectiveIndexName !== currentKnowledgeBaseRef.current && !isCreatingMode) {
      onError(new Error(t('knowledgeBase.upload.switchError')));
      message.error(t('knowledgeBase.upload.fileUploadSwitchError', { fileName: file.name }));
      return;
    }

    if (response.ok) {
      const result = await response.json();
      onSuccess(result, file);

    } else {
      onError(new Error(t('knowledgeBase.upload.error')));
      message.error(t('knowledgeBase.upload.fileUploadError', { fileName: file.name }));
    }
  } catch (err) {
    // 确保是当前知识库的错误处理
    if (effectiveIndexName === currentKnowledgeBaseRef.current || isCreatingMode) {
      onError(new Error(t('knowledgeBase.upload.error')));
      message.error(t('knowledgeBase.upload.fileUploadError', { fileName: file.name }));
    }
  }
};

// 检查知识库名称是否存在
export const checkKnowledgeBaseNameExists = async (
  knowledgeBaseName: string,
  t: TFunction
): Promise<boolean> => {
  try {
    return await knowledgeBaseService.checkKnowledgeBaseNameExists(knowledgeBaseName);
  } catch (error) {
    console.error(t('knowledgeBase.check.nameError'), error);
    return false;
  }
};

// 获取知识库文档信息
export const fetchKnowledgeBaseInfo = async (
  indexName: string, 
  abortController: AbortController, 
  currentKnowledgeBaseRef: React.MutableRefObject<string>,
  onSuccess: () => void,
  onError: (error: unknown) => void,
  t: TFunction
) => {
  try {
    if (!abortController.signal.aborted && indexName === currentKnowledgeBaseRef.current) {
      onSuccess();
    }
  } catch (error: unknown) {
    const err = error as AbortableError;
    if (err.name !== 'AbortError' && indexName === currentKnowledgeBaseRef.current) {
      console.error(t('knowledgeBase.fetch.error'), error);
      message.error(t('knowledgeBase.fetch.retryError'));
      onError(error);
    }
  }
};

// 文件类型验证
export const validateFileType = (file: File, t: TFunction): boolean => {
  const validTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/markdown',
    'text/plain',
    'text/csv',
    'application/csv'
  ];

  // 先判断 MIME type
  let isValidType = validTypes.includes(file.type);

  // 如果 MIME type 为空或不在列表里，再根据文件名后缀判断
  if (!isValidType) {
    const name = file.name.toLowerCase();
    if (
      name.endsWith('.md') ||
      name.endsWith('.markdown') ||
      name.endsWith('.csv')
    ) {
      isValidType = true;
    }
  }

  if (!isValidType) {
    message.error(t('knowledgeBase.upload.invalidFileType'));
    return false;
  }

  return true;
};

// 创建模拟的文件选择事件
export const createMockFileSelectEvent = (
  file: UploadFile<any>
): React.ChangeEvent<HTMLInputElement> => {
  const { t } = useTranslation('common');
  if (!file.originFileObj) {
    throw new Error(t('knowledgeBase.upload.noFileObject'));
  }
  
  return {
    target: {
      files: [file.originFileObj]
    },
    preventDefault: () => {},
    stopPropagation: () => {},
    nativeEvent: new Event('change'),
    currentTarget: null,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: true,
    timeStamp: Date.now(),
    type: 'change'
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}; 