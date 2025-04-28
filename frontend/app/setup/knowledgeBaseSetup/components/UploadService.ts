import { message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import knowledgeBaseService from '@/services/knowledgeBaseService';

// 添加类型定义
export interface AbortableError extends Error {
  name: string;
}

// 添加更新缓存的通用函数
export const updateKnowledgeBaseCache = () => {
  // 清除所有相关缓存
  localStorage.removeItem('preloaded_kb_data');
  
  // 触发知识库数据更新事件
  window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
    detail: { forceRefresh: true }
  }));
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
  const { onSuccess, onError, file } = options;
  const effectiveIndexName = isCreatingMode ? newKnowledgeBaseName : indexName;
  
  // 确保是当前知识库
  if (effectiveIndexName !== currentKnowledgeBaseRef.current && !isCreatingMode) {
    onError(new Error('知识库已切换，请重新上传'));
    message.error(`文件 ${file.name} 上传失败：知识库已切换`);
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('index_name', effectiveIndexName);

  try {
    const response = await fetch(effectiveUploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });

    // 再次确认是当前知识库
    if (effectiveIndexName !== currentKnowledgeBaseRef.current && !isCreatingMode) {
      onError(new Error('知识库已切换，请重新上传'));
      message.error(`文件 ${file.name} 上传失败：知识库已切换`);
      return;
    }

    if (response.ok) {
      const result = await response.json();
      onSuccess(result, file);

      // 清除缓存并立即触发一次更新事件
      localStorage.removeItem('preloaded_kb_data');
      window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
        detail: { forceRefresh: true }
      }));

      // 新增：在上传成功后等待3秒，然后刷新文档详细信息
      setTimeout(() => {
        // 刷新知识库数据
        updateKnowledgeBaseCache();
        
        // 如果不是创建模式，直接更新文档信息
        if (!isCreatingMode) {
          try {
            // 获取最新的文档信息
            knowledgeBaseService.getDocuments(effectiveIndexName).then(documents => {
              // 触发文档更新事件
              window.dispatchEvent(new CustomEvent('documentsUpdated', {
                detail: { 
                  kbId: effectiveIndexName,
                  documents: documents
                }
              }));
            });
          } catch (error) {
            console.error('更新知识库文档信息失败:', error);
          }
        }
      }, 3000); // 等待3秒

      if (isCreatingMode) {
        let checkCount = 0;
        const maxChecks = 30; // 最多检查30次(约30秒)
        
        const checkForNewKnowledgeBase = () => {
          // 使用通用函数更新缓存
          updateKnowledgeBaseCache();
          
          checkCount++;
          
          // 如果没有达到最大检查次数，继续检查
          if (checkCount < maxChecks) {
            setTimeout(() => {
              // 检查知识库是否已经创建
              const checkIfCreated = () => {
                // 获取当前知识库列表
                const knowledgeBases = JSON.parse(localStorage.getItem('preloaded_kb_data') || '[]');
                
                // 查找是否包含指定名称的知识库
                const newKb = knowledgeBases.find((kb: {name: string, id: string}) => kb.name === effectiveIndexName);
                
                if (newKb) {
                  // 找到了新创建的知识库，触发选中事件
                  window.dispatchEvent(new CustomEvent('selectNewKnowledgeBase', {
                    detail: { name: effectiveIndexName }
                  }));
                  
                  // 新增：找到知识库后，再等待3秒获取最新的文档信息
                  setTimeout(() => {
                    try {
                      knowledgeBaseService.getDocuments(effectiveIndexName).then(documents => {
                        // 触发文档更新事件
                        window.dispatchEvent(new CustomEvent('documentsUpdated', {
                          detail: { 
                            kbId: effectiveIndexName,
                            documents: documents
                          }
                        }));
                      });
                    } catch (error) {
                      console.error('新知识库创建后更新文档信息失败:', error);
                    }
                  }, 3000);
                  
                  return true; // 成功找到
                }
                
                return false; // 未找到
              };
              
              if (!checkIfCreated()) {
                checkForNewKnowledgeBase();
              }
            }, 1000);
          }
        };
        
        setTimeout(checkForNewKnowledgeBase, 2000);
      }
    } else {
      onError(new Error('上传失败'));
      message.error(`文件 ${file.name} 上传失败`);
    }
  } catch (err) {
    // 确保是当前知识库的错误处理
    if (effectiveIndexName === currentKnowledgeBaseRef.current || isCreatingMode) {
      onError(new Error('上传失败'));
      message.error(`文件 ${file.name} 上传失败`);
    }
  }
};

// 检查知识库名称是否存在
export const checkKnowledgeBaseNameExists = async (
  knowledgeBaseName: string
): Promise<boolean> => {
  try {
    return await knowledgeBaseService.checkKnowledgeBaseNameExists(knowledgeBaseName);
  } catch (error) {
    console.error('检查知识库名称失败:', error);
    return false;
  }
};

// 获取知识库文档信息
export const fetchKnowledgeBaseInfo = async (
  indexName: string, 
  abortController: AbortController, 
  currentKnowledgeBaseRef: React.MutableRefObject<string>,
  onSuccess: () => void,
  onError: (error: unknown) => void
) => {
  try {
    // 获取文档
    const documents = await knowledgeBaseService.getDocuments(indexName);
    
    // 如果这个请求没有被取消，且知识库名称仍然匹配
    if (!abortController.signal.aborted && indexName === currentKnowledgeBaseRef.current) {
      onSuccess();
    }
  } catch (error: unknown) {
    // 只处理非取消的错误
    const err = error as AbortableError;
    if (err.name !== 'AbortError' && indexName === currentKnowledgeBaseRef.current) {
      console.error('获取知识库信息失败:', error);
      message.error('获取知识库信息失败，请稍后重试');
      onError(error);
    }
  }
};

// 文件类型验证
export const validateFileType = (file: File): boolean => {
  const isValidType = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/markdown',
    'text/plain'
  ].includes(file.type);

  if (!isValidType) {
    message.error('只支持 PDF、Word、PPT、Excel、MD、TXT 文件格式！');
    return false;
  }

  return true;
};

// 创建模拟的文件选择事件
export const createMockFileSelectEvent = (
  file: UploadFile<any>
): React.ChangeEvent<HTMLInputElement> => {
  if (!file.originFileObj) {
    throw new Error('文件对象不存在');
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