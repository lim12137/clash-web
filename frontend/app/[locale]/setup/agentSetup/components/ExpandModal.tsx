"use client"

import { Modal, Badge } from 'antd'
import { useTranslation } from 'react-i18next'
import PromptEditor from './PromptEditor'
import { MilkdownProvider } from '@milkdown/react'

export interface ExpandModalProps {
  open: boolean;
  title: string;
  content: string;
  index: number;
  onClose: () => void;
  onContentChange?: (content: string) => void;
}

export default function ExpandModal({
  open,
  title,
  content,
  index,
  onClose,
  onContentChange
}: ExpandModalProps) {
  const { t } = useTranslation('common')

  // Calculate dynamic modal height based on content
  const calculateModalHeight = (content: string) => {
    const lineCount = content.split('\n').length;
    const contentLength = content.length;
    
    // Height calculation based on line count and content length, range 25vh - 85vh
    const minHeight = 25;
    const maxHeight = 85;
    
    // Combine line count and content length to calculate height
    const heightByLines = minHeight + Math.floor(lineCount / 8) * 5;
    const heightByContent = minHeight + Math.floor(contentLength / 200) * 3;

    const calculatedHeight = Math.max(heightByLines, heightByContent);
    return Math.max(minHeight, Math.min(maxHeight, calculatedHeight));
  };

  // Move getBadgeProps to component level
  const getBadgeProps = (index: number): { status?: 'success' | 'warning' | 'error' | 'default', color?: string } => {
    switch(index) {
      case 1:
        return { status: 'success' };  // Green - Agent Info
      case 2:
        return { status: 'warning' };  // Yellow - Duty
      case 3:
        return { color: '#1677ff' };   // Blue - Constraint
      case 4:
        return { status: 'default' };  // Default - Few Shots
      default:
        return { status: 'default' };
    }
  };

  return (
    <Modal
      title={
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Badge
              {...getBadgeProps(index)}
              className="mr-3"
            />
            <span className="text-base font-medium">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md flex items-center text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            style={{ border: "none" }}
          >
            {t('systemPrompt.button.close')}
          </button>
        </div>
      }
      open={open}
      closeIcon={null}
      onCancel={onClose}
      footer={null}
      width={1000}
      styles={{
        body: { padding: '20px' },
        content: { top: 20 }
      }}
    >
      <div 
        className="flex flex-col"
        style={{ height: `${calculateModalHeight(content)}vh` }}
      >
        <div className="flex-1 border border-gray-200 rounded-md overflow-y-auto">
          <MilkdownProvider>
            <PromptEditor
              value={content}
              onChange={onContentChange || (() => {})}
            />
          </MilkdownProvider>
        </div>
      </div>
    </Modal>
  )
} 