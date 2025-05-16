import React from 'react';
import { Upload, Progress } from 'antd';
import { InboxOutlined, WarningFilled } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
const { Dragger } = Upload;

interface UploadAreaUIProps {
  fileList: UploadFile[];
  uploadProps: UploadProps;
  isLoading: boolean;
  isKnowledgeBaseReady: boolean;
  isCreatingMode: boolean;
  nameExists: boolean;
  isUploading: boolean;
  disabled: boolean;
  componentHeight: string;
  newKnowledgeBaseName: string;
}

const UploadAreaUI: React.FC<UploadAreaUIProps> = ({
  fileList,
  uploadProps,
  isLoading,
  isKnowledgeBaseReady,
  isCreatingMode,
  nameExists,
  isUploading,
  disabled,
  componentHeight,
  newKnowledgeBaseName
}) => {
  
  // 加载中状态UI
  // 重构：风格被嵌入在组件内
  if (isLoading) {
    return (
      <div className="p-3 bg-gray-50 border-t border-gray-200 h-[30%]">
        <div className="h-full flex transition-all duration-300 ease-in-out">
          <div className={`transition-all duration-300 ease-in-out ${
            !isLoading && fileList.length > 0 ? 'w-[40%] pr-2' : 'w-full'
          }`}>
            <div className="relative h-full">
              {/* 上传区域层 - 使用透明度实现淡入淡出 */}
              <div 
                className="absolute inset-0 transition-opacity duration-300 ease-in-out"
              >
                <Dragger {...uploadProps} className="!h-full flex flex-col justify-center !bg-transparent !border-gray-200" showUploadList={false}>
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="ant-upload-drag-icon !mb-4">
                      <InboxOutlined style={{ fontSize: '48px', color: '#1677ff' }} />
                    </p>
                    <p className="ant-upload-text !mb-2 text-base">
                      点击或拖拽文件到此区域上传，为知识库添加知识
                    </p>
                    <p className="ant-upload-hint text-gray-500">
                      支持 PDF、Word、PPT、Excel、MD、TXT 文件格式
                    </p>
                  </div>
                </Dragger>
              </div>
            </div>
          </div>
          
          {/* 文件列表区域 - 保持原有的侧边滑动效果 */}
          <div 
            className={`rounded-lg transition-all duration-300 ease-in-out overflow-hidden ${
              fileList.length > 0 ? 'w-[60%] opacity-100 pl-2' : 'w-0 opacity-0'
            }`}
          >
            {fileList.length > 0 && (
              <div className="h-full">
                <div className="h-full border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-700 m-0">已完成上传</h4>
                    <span className="text-xs text-gray-500">{fileList.length} 个文件</span>
                  </div>
                  <div className="overflow-auto" style={{ height: 'calc(100% - 41px)' }}>
                    {fileList.map(file => (
                      <div key={file.uid} className="border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-700 truncate">
                                {file.name}
                              </div>
                              {file.status === 'uploading' && (
                                <div className="mt-1">
                                  <Progress 
                                    percent={file.percent} 
                                    size="small" 
                                    showInfo={false}
                                    strokeColor={{
                                      '0%': '#108ee9',
                                      '100%': '#87d068',
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-3 flex items-center text-xs">
                            {file.status === 'uploading' && (
                              <span className="text-blue-500">上传中</span>
                            )}
                            {file.status === 'done' && (
                              <span className="text-green-500">已完成</span>
                            )}
                            {file.status === 'error' && (
                              <span className="text-red-500">上传失败</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {isCreatingMode && isUploading && (
          <div className="mt-2 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-blue-600 font-medium">正在上传并创建知识库...</p>
          </div>
        )}
      </div>
    );
  }
  
  // 知识库未就绪UI
  if (!isKnowledgeBaseReady && !isCreatingMode) {
    return (
      <div className="p-3 bg-gray-50 border-t border-gray-200 h-[30%]">
        <div className="h-full border-2 border-dashed border-gray-200 rounded-md flex flex-col items-center justify-center bg-white">
          <WarningFilled style={{ fontSize: '32px', color: '#faad14', marginBottom: '16px' }} />
          <p className="text-gray-600 text-base mb-2">知识库未就绪</p>
          <p className="text-gray-400 text-sm">请稍后重试</p>
        </div>
      </div>
    );
  }
  
  // 禁用状态UI
  if (disabled) {
    return (
      <div className="p-3 bg-gray-50 border-t border-gray-200 opacity-50 cursor-not-allowed" style={{ height: componentHeight }}>
        <div className="border-2 border-dashed border-gray-300 bg-white rounded-md p-4 text-center flex flex-col items-center justify-center h-full">
          <div className="mb-0.5 text-blue-500 text-lg">📄</div>
          <p className="mb-0.5 text-gray-700 text-xs font-medium">
            请先选择一个知识库以上传文件
          </p>
        </div>
      </div>
    );
  }
  
  // 名称已存在UI
  if (isCreatingMode && nameExists) {
    return (
      <div className="p-3 bg-gray-50 border-t border-gray-200 h-[30%]">
        <div className="border-2 border-dashed border-red-200 bg-white rounded-md p-4 text-center flex flex-col items-center justify-center h-full">
          <div className="mb-4 text-red-500 text-lg">
            <WarningFilled style={{ fontSize: 36, color: '#ff4d4f' }} />
          </div>
          <p className="mb-2 text-red-600 text-lg font-medium">
            知识库 "{newKnowledgeBaseName}" 已存在
          </p>
          <p className="text-gray-500 text-sm max-w-md">
            请修改知识库名称后继续
          </p>
        </div>
      </div>
    );
  }
  
  // 默认UI状态
  return (
<div className="p-3 bg-gray-50 border-t border-gray-200 h-[30%]">
      <div className="h-full flex transition-all duration-300 ease-in-out">
        {/* 上传区域容器 */}
        <div className={`transition-all duration-300 ease-in-out ${
          !isLoading && fileList.length > 0 ? 'w-[40%] pr-2' : 'w-full'
        }`}>
          <div className="relative h-full">
            {/* 上传区域层 */}
            <div 
              className="absolute inset-0 transition-opacity duration-300 ease-in-out"
            >
              <Dragger {...uploadProps} className="!h-full flex flex-col justify-center !bg-transparent !border-gray-200" showUploadList={false}>
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="ant-upload-drag-icon !mb-4">
                    <InboxOutlined style={{ fontSize: '48px', color: '#1677ff' }} />
                  </p>
                  <p className="ant-upload-text !mb-2 text-base">
                    点击或拖拽文件到此区域上传，为知识库添加知识
                  </p>
                  <p className="ant-upload-hint text-gray-500">
                    支持 PDF、Word、PPT、Excel、MD、TXT 文件格式
                  </p>
                </div>
              </Dragger>
            </div>
          </div>
        </div>
        
        {/* 文件列表区域 */}
        <div 
          className={`rounded-lg transition-all duration-300 ease-in-out overflow-hidden ${
            !isLoading && fileList.length > 0 ? 'w-[60%] opacity-100 pl-2' : 'w-0 opacity-0'
          }`}
        >
          {fileList.length > 0 && !isLoading && (
            <div className="h-full">
              <div className="h-full border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-700 m-0">已完成上传</h4>
                  <span className="text-xs text-gray-500">{fileList.length} 个文件</span>
                </div>
                <div className="overflow-auto" style={{ height: 'calc(100% - 41px)' }}>
                  {fileList.map(file => (
                    <div key={file.uid} className="border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-700 truncate">
                              {file.name}
                            </div>
                            {file.status === 'uploading' && (
                              <div className="mt-1">
                                <Progress 
                                  percent={file.percent} 
                                  size="small" 
                                  showInfo={false}
                                  strokeColor={{
                                    '0%': '#108ee9',
                                    '100%': '#87d068',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-3 flex items-center text-xs">
                          {file.status === 'uploading' && (
                            <span className="text-blue-500">上传中</span>
                          )}
                          {file.status === 'done' && (
                            <span className="text-green-500">已完成</span>
                          )}
                          {file.status === 'error' && (
                            <span className="text-red-500">上传失败</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {isCreatingMode && isUploading && (
        <div className="mt-2 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-blue-600 font-medium">正在上传并创建知识库...</p>
        </div>
      )}
    </div>
  );
};

export default UploadAreaUI; 