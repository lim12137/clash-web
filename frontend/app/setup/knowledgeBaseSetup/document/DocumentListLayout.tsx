import React, { useState } from 'react'
import { Document } from '@/types/knowledgeBase'
import DocumentStatus from './DocumentStatus'
import { InfoCircleFilled } from '@ant-design/icons'
import UploadArea from '../components/UploadArea'
import { formatFileSize, formatDateTime } from '@/lib/utils'
import { Input, Button } from 'antd'
import { useKnowledgeBaseContext } from '../knowledgeBase/KnowledgeBaseContext'
import { message } from 'antd'
import knowledgeBaseService from '@/services/knowledgeBaseService'

// UI布局配置，内部管理各部分高度比例
export const UI_CONFIG = {
  TITLE_BAR_HEIGHT: '56.8px',               // 标题栏固定高度
  UPLOAD_COMPONENT_HEIGHT: '250px',         // 上传组件固定高度
};

// 列宽常量配置，便于统一管理
export const COLUMN_WIDTHS = {
  NAME: '47%',     // 文档名称列宽
  STATUS: '11%',   // 状态列宽
  SIZE: '11%',     // 大小列宽
  DATE: '20%',     // 日期列宽
  ACTION: '11%'    // 操作列宽
}

// 文档名称显示配置
export const DOCUMENT_NAME_CONFIG = {
  MAX_WIDTH: '450px',          // 文档名称最大宽度
  TEXT_OVERFLOW: 'ellipsis',   // 溢出文本显示省略号
  WHITE_SPACE: 'nowrap',       // 不换行
  OVERFLOW: 'hidden'           // 溢出隐藏
}

// 布局和间距配置
export const LAYOUT = {
  // 单元格和间距
  CELL_PADDING: 'px-3 py-1.5',  // 单元格内边距
  TEXT_SIZE: 'text-sm',       // 标准文本大小
  HEADER_TEXT: 'text-sm font-semibold text-gray-600 uppercase tracking-wider', // 表头文本样式
  
  // 知识库标题区域
  KB_HEADER_PADDING: 'p-3',  // 知识库标题区域内边距
  KB_TITLE_SIZE: 'text-lg',  // 知识库标题文字大小
  KB_TITLE_MARGIN: 'ml-3',   // 知识库标题左边距
  
  // 表格行样式
  TABLE_ROW_HOVER: 'hover:bg-gray-50',  // 表格行悬停背景
  TABLE_HEADER_BG: 'bg-gray-50',        // 表头背景色
  TABLE_ROW_DIVIDER: 'divide-y divide-gray-200', // 表格行分隔线
  
  // 图标和按钮
  ICON_SIZE: 'text-lg',  // 文件图标大小
  ICON_MARGIN: 'mr-2',   // 文件图标右边距
  ACTION_TEXT: 'text-red-500 hover:text-red-700 font-medium text-xs' // 操作按钮文本样式
}

export interface DocumentListLayoutProps {
  sortedDocuments: Document[]
  knowledgeBaseName: string
  loading: boolean
  isInitialLoad: boolean
  modelMismatch: boolean
  isCreatingMode: boolean
  isUploading: boolean
  nameLockedAfterUpload: boolean
  hasDocuments: boolean
  containerHeight: string
  contentHeight: string
  titleBarHeight: string
  uploadHeight: string
  
  // 函数
  getFileIcon: (type: string) => string
  getMismatchInfo: () => string
  onNameChange?: (name: string) => void
  onDelete: (id: string) => void
  
  // 上传相关props
  uploadAreaRef: React.RefObject<any>
  isDragging: boolean
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  selectedFiles: File[]
  handleUpload: () => void
  uploadUrl: string
}

const DocumentListLayout: React.FC<DocumentListLayoutProps> = ({
  sortedDocuments,
  knowledgeBaseName,
  loading,
  isInitialLoad,
  modelMismatch,
  isCreatingMode,
  isUploading,
  nameLockedAfterUpload,
  hasDocuments,
  containerHeight,
  contentHeight,
  titleBarHeight,
  uploadHeight,
  
  // 函数
  getFileIcon,
  getMismatchInfo,
  onNameChange,
  onDelete,
  
  // 上传相关props
  uploadAreaRef,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  selectedFiles,
  handleUpload,
  uploadUrl
}) => {
  const [showDetail, setShowDetail] = React.useState(false);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { summaryIndex } = useKnowledgeBaseContext();

  // 当知识库名称改变时，重置showDetail状态
  React.useEffect(() => {
    setShowDetail(false);
  }, [knowledgeBaseName]);

  // 当显示详细内容时，获取总结
  React.useEffect(() => {
    const fetchSummary = async () => {
      if (showDetail && knowledgeBaseName) {
        try {
          const result = await knowledgeBaseService.getSummary(knowledgeBaseName);
          setSummary(result);
        } catch (error) {
          console.error('获取知识库总结失败:', error);
          message.error('获取知识库总结失败');
        }
      }
    };
    fetchSummary();
  }, [showDetail, knowledgeBaseName]);

  // 处理自动总结
  const handleAutoSummary = async () => {
    if (!knowledgeBaseName) {
      message.warning('请先选择一个知识库');
      return;
    }

    setIsSummarizing(true);
    try {
      const result = await summaryIndex(knowledgeBaseName, 1000);
      if (result) {
        setSummary(result);
        message.success('知识库总结完成');
      } else {
        message.warning('知识库总结为空');
      }
    } catch (error) {
      message.error('获取知识库总结失败');
      console.error('获取知识库总结失败:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  // 处理保存总结
  const handleSaveSummary = async () => {
    if (!knowledgeBaseName) {
      message.warning('请先选择一个知识库');
      return;
    }

    if (!summary.trim()) {
      message.warning('总结内容不能为空');
      return;
    }

    setIsSaving(true);
    try {
      console.log('开始保存总结:', { 
        knowledgeBaseName, 
        summary,
        summaryLength: summary.length,
        summaryContent: summary.substring(0, 100) + '...' // 只显示前100个字符
      });
      await knowledgeBaseService.changeSummary(knowledgeBaseName, summary);
      message.success('保存成功');
    } catch (error: any) {
      console.error('保存总结失败:', error);
      const errorMessage = error?.message || error?.detail || '保存失败';
      message.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // 重构：风格被嵌入在组件内
  return (
    <div className="flex flex-col w-full bg-white border border-gray-200 rounded-md shadow-sm h-full" style={{ height: containerHeight }}>
      {/* 标题栏 */}
      <div className={`${LAYOUT.KB_HEADER_PADDING} border-b border-gray-200 flex-shrink-0 flex items-center`} style={{ height: titleBarHeight }}>
        <div className="flex items-center justify-between w-full">
          {/* 左侧：知识库名称和模型不匹配提示 */}
          <div className="flex items-center">
            {isCreatingMode ? (
              nameLockedAfterUpload ? (
                <div className="flex items-center">
                  <span className="text-blue-600 mr-2">📚</span>
                  <h3 className={`${LAYOUT.KB_TITLE_MARGIN} ${LAYOUT.KB_TITLE_SIZE} font-semibold text-gray-800`}>
                    {knowledgeBaseName}
                  </h3>
                  {isUploading && (
                    <div className="ml-3 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-md border border-blue-100">
                      创建中...
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  value={knowledgeBaseName}
                  onChange={(e) => onNameChange && onNameChange(e.target.value)}
                  placeholder="请输入知识库名称"
                  className={`${LAYOUT.KB_TITLE_MARGIN}`}
                  size="large"
                  style={{ 
                    width: '320px', 
                    fontWeight: 500,
                    marginTop: '2px',
                    marginBottom: '2px'
                  }}
                  prefix={<span className="text-blue-600">📚</span>}
                  autoFocus
                  disabled={hasDocuments || isUploading || nameLockedAfterUpload} // 如果已有文档或正在上传，则禁止编辑名称
                />
              )
            ) : (
              <h3 className={`${LAYOUT.KB_TITLE_MARGIN} ${LAYOUT.KB_TITLE_SIZE} font-semibold text-blue-500 flex items-center`}>
                {knowledgeBaseName}
              </h3>
            )}
            {modelMismatch && !isCreatingMode && (
              <div 
                className="ml-3 mt-0.5 px-1.5 py-1 inline-flex items-center rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200"
              >
                {getMismatchInfo()}
              </div>
            )}
          </div>
          {/* 右侧：详细内容 */}
          {!isCreatingMode && (
            <Button type="primary" onClick={() => setShowDetail(true)}>详细内容</Button>
          )}
        </div>
      </div>

      {/* 文档列表/详细内容视图 */}
      <div className="p-2 overflow-auto flex-grow" style={{ height: contentHeight }}>
        {showDetail ? (
          <div style={{ padding: '16px 32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>知识库总结</span>
              <Button 
                type="default" 
                onClick={handleAutoSummary}
                loading={isSummarizing}
                disabled={!knowledgeBaseName || isSummarizing}
              >
                自动总结
              </Button>
            </div>
            {isSummarizing ? (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center',
                backgroundColor: '#fafafa',
                borderRadius: '8px',
                marginBottom: 20
              }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p style={{ fontSize: 16, color: '#666' }}>正在总结知识库内容，请稍候...</p>
              </div>
            ) : (
              <Input.TextArea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                style={{
                  flex: 1,
                  minHeight: 0,
                  marginBottom: 20,
                  resize: 'none',
                  fontSize: 18,
                  lineHeight: 1.7,
                  padding: 20
                }}
              />
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button 
                type="primary" 
                size="large" 
                onClick={handleSaveSummary}
                loading={isSaving}
                disabled={!summary || isSaving}
              >
                保存
              </Button>
              <Button size="large" onClick={() => setShowDetail(false)}>返回</Button>
            </div>
          </div>
        ) : (
          loading && isInitialLoad ? (
            <div className="flex items-center justify-center h-full border border-gray-200 rounded-md">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">正在加载文档列表...</p>
              </div>
            </div>
          ) : isCreatingMode ? (
            <div className="flex items-center justify-center border border-gray-200 rounded-md h-full">
              <div className="text-center p-6">
                <div className="mb-4">
                  <InfoCircleFilled style={{ fontSize: 36, color: '#1677ff' }} />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">创建新知识库</h3>
                <p className="text-gray-500 text-sm max-w-md">
                  请选择文件上传以完成知识库创建
                </p>
              </div>
            </div>
          ) : sortedDocuments.length > 0 ? (
            <div className="overflow-y-auto border border-gray-200 rounded-md h-full">
              <table className="min-w-full bg-white">
                <thead className={`${LAYOUT.TABLE_HEADER_BG} sticky top-0 z-10`}>
                  <tr>
                    <th className={`${LAYOUT.CELL_PADDING} text-left ${LAYOUT.HEADER_TEXT}`} style={{ width: COLUMN_WIDTHS.NAME }}>
                      文档名称
                    </th>
                    <th className={`${LAYOUT.CELL_PADDING} text-left ${LAYOUT.HEADER_TEXT}`} style={{ width: COLUMN_WIDTHS.STATUS }}>
                      状态
                    </th>
                    <th className={`${LAYOUT.CELL_PADDING} text-left ${LAYOUT.HEADER_TEXT}`} style={{ width: COLUMN_WIDTHS.SIZE }}>
                      大小
                    </th>
                    <th className={`${LAYOUT.CELL_PADDING} text-left ${LAYOUT.HEADER_TEXT}`} style={{ width: COLUMN_WIDTHS.DATE }}>
                      上传日期
                    </th>
                    <th className={`${LAYOUT.CELL_PADDING} text-left ${LAYOUT.HEADER_TEXT}`} style={{ width: COLUMN_WIDTHS.ACTION }}>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className={LAYOUT.TABLE_ROW_DIVIDER}>
                  {sortedDocuments.map((doc) => (
                    <tr key={doc.id} className={LAYOUT.TABLE_ROW_HOVER}>
                      <td className={LAYOUT.CELL_PADDING}>
                        <div className="flex items-center">
                          <span className={`${LAYOUT.ICON_MARGIN} ${LAYOUT.ICON_SIZE}`}>
                            {getFileIcon(doc.type)}
                          </span>
                          <span 
                            className={`${LAYOUT.TEXT_SIZE} font-medium text-gray-800 truncate`} 
                            style={{ 
                              maxWidth: DOCUMENT_NAME_CONFIG.MAX_WIDTH,
                              textOverflow: DOCUMENT_NAME_CONFIG.TEXT_OVERFLOW,
                              whiteSpace: DOCUMENT_NAME_CONFIG.WHITE_SPACE,
                              overflow: DOCUMENT_NAME_CONFIG.OVERFLOW
                            }}
                            title={doc.name}
                          >
                            {doc.name}
                          </span>
                        </div>
                      </td>
                      <td className={LAYOUT.CELL_PADDING}>
                        <div className="flex items-center">
                          <DocumentStatus 
                            status={doc.status} 
                            showIcon={true}
                          />
                        </div>
                      </td>
                      <td className={`${LAYOUT.CELL_PADDING} ${LAYOUT.TEXT_SIZE} text-gray-600`}>
                        {formatFileSize(doc.size)}
                      </td>
                      <td className={`${LAYOUT.CELL_PADDING} ${LAYOUT.TEXT_SIZE} text-gray-600`}>
                        {formatDateTime(doc.create_time)}
                      </td>
                      <td className={LAYOUT.CELL_PADDING}>
                        <button
                          onClick={() => onDelete(doc.id)}
                          className={LAYOUT.ACTION_TEXT}
                          disabled={doc.status === "PROCESSING" || doc.status === "FORWARDING"}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-2 text-gray-500 text-xs border border-gray-200 rounded-md h-full">
              该知识库中暂无文档，请上传文档
            </div>
          )
        )}
      </div>

      {/* 上传区域 */}
      {!showDetail && (
        <UploadArea
          ref={uploadAreaRef}
          onFileSelect={onFileSelect}
          onUpload={handleUpload}
          isUploading={isUploading}
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          disabled={loading || (!isCreatingMode && !knowledgeBaseName)}
          componentHeight={uploadHeight}
          isCreatingMode={isCreatingMode}
          indexName={knowledgeBaseName}
          newKnowledgeBaseName={isCreatingMode ? knowledgeBaseName : ''}
          uploadUrl={uploadUrl}
        />
      )}
    </div>
  )
}

export default DocumentListLayout 