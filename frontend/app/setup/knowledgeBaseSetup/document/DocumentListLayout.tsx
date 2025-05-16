import React from 'react'
import { Document } from '@/types/knowledgeBase'
import DocumentStatus from './DocumentStatus'
import { InfoCircleFilled } from '@ant-design/icons'
import UploadArea from '../components/UploadArea'
import { formatFileSize, formatDateTime } from '@/lib/utils'
import { Input } from 'antd'

// UI layout configuration, internally manages height ratios of each section
export const UI_CONFIG = {
  TITLE_BAR_HEIGHT: '56.8px',               // Fixed height for title bar
  UPLOAD_COMPONENT_HEIGHT: '250px',         // Fixed height for upload component
};

// Column width constants configuration for unified management
export const COLUMN_WIDTHS = {
  NAME: '47%',     // Document name column width
  STATUS: '11%',   // Status column width
  SIZE: '11%',     // Size column width
  DATE: '20%',     // Date column width
  ACTION: '11%'    // Action column width
}

// Document name display configuration
export const DOCUMENT_NAME_CONFIG = {
  MAX_WIDTH: '450px',          // Maximum width for document name
  TEXT_OVERFLOW: 'ellipsis',   // Show ellipsis for overflow text
  WHITE_SPACE: 'nowrap',       // No line break
  OVERFLOW: 'hidden'           // Hide overflow
}

// Layout and spacing configuration
export const LAYOUT = {
  // Cells and spacing
  CELL_PADDING: 'px-3 py-1.5',  // Cell padding
  TEXT_SIZE: 'text-sm',       // Standard text size
  HEADER_TEXT: 'text-sm font-semibold text-gray-600 uppercase tracking-wider', // Header text style
  
  // Knowledge base title area
  KB_HEADER_PADDING: 'p-3',  // Knowledge base title area padding
  KB_TITLE_SIZE: 'text-lg',  // Knowledge base title text size
  KB_TITLE_MARGIN: 'ml-3',   // Knowledge base title left margin
  
  // Table row styles
  TABLE_ROW_HOVER: 'hover:bg-gray-50',  // Table row hover background
  TABLE_HEADER_BG: 'bg-gray-50',        // Table header background color
  TABLE_ROW_DIVIDER: 'divide-y divide-gray-200', // Table row divider
  
  // Icons and buttons
  ICON_SIZE: 'text-lg',  // File icon size
  ICON_MARGIN: 'mr-2',   // File icon right margin
  ACTION_TEXT: 'text-red-500 hover:text-red-700 font-medium text-xs' // Action button text style
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
  
  // Functions
  getFileIcon: (type: string) => string
  getMismatchInfo: () => string
  onNameChange?: (name: string) => void
  onDelete: (id: string) => void
  
  // Upload related props
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
  
  // Functions
  getFileIcon,
  getMismatchInfo,
  onNameChange,
  onDelete,
  
  // Upload related props
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
  // Styles are embedded in the component
  return (
    <div className="flex flex-col w-full bg-white border border-gray-200 rounded-md shadow-sm h-full" style={{ height: containerHeight }}>
      {/* Title bar */}
      <div className={`${LAYOUT.KB_HEADER_PADDING} border-b border-gray-200 flex-shrink-0 flex items-center`} style={{ height: titleBarHeight }}>
        <div className="flex items-center justify-between w-full">
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
                  disabled={hasDocuments || isUploading || nameLockedAfterUpload || loading} // Disable editing name if there are documents or uploading
                />
              )
            ) : (
              <h3 className={`${LAYOUT.KB_TITLE_MARGIN} ${LAYOUT.KB_TITLE_SIZE} font-semibold text-blue-500 flex items-center`}>
                {knowledgeBaseName}&nbsp;&nbsp;<span className="text-gray-800">详细内容</span>
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
        </div>
      </div>

      {/* Document list */}
      <div className="p-2 overflow-auto flex-grow" style={{ height: contentHeight }}>
        {loading && isInitialLoad ? (
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
                        disabled={doc.status === "PROCESSING" || doc.status === "FORWARDING" || doc.status === "WAITING"}
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
        )}
      </div>

      {/* Upload area */}
      <UploadArea
        ref={uploadAreaRef}
        onFileSelect={onFileSelect}
        selectedFiles={selectedFiles}
        onUpload={handleUpload}
        isUploading={isUploading}
        isDragging={isDragging}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        disabled={loading || (!isCreatingMode && !knowledgeBaseName)} // Only disable upload area when loading or no knowledge base selected
        componentHeight={uploadHeight}
        isCreatingMode={isCreatingMode}
        indexName={knowledgeBaseName}
        newKnowledgeBaseName={isCreatingMode ? knowledgeBaseName : ''}
        uploadUrl={uploadUrl}
      />
    </div>
  )
}

export default DocumentListLayout 