import React from 'react'

interface DocumentStatusProps {
  status: string
  showIcon?: boolean
  size?: 'small' | 'medium' | 'large'
}

export const DocumentStatus: React.FC<DocumentStatusProps> = ({ 
  status, 
  showIcon = false, 
  size = 'small' 
}) => {
  // Map API status to display status
  const getDisplayStatus = (apiStatus: string): string => {
    switch (apiStatus) {
      case 'WAIT_FOR_PROCESSING':
        return '等待解析'
      case 'WAIT_FOR_FORWARDING':
        return '等待入库'
      case 'PROCESSING':
        return '解析中'
      case 'FORWARDING': 
        return '入库中'
      case 'COMPLETED':
        return '已就绪'
      case 'PROCESS_FAILED':
        return '解析失败'
      case 'FORWARD_FAILED':
        return '入库失败'
      default:
        return apiStatus
    }
  }

  // Get status type and corresponding styles
  const getStatusStyles = (): { bgColor: string, textColor: string, borderColor: string } => {
    switch (status) {
      case 'COMPLETED':
        return { 
          bgColor: 'bg-green-100', 
          textColor: 'text-green-800', 
          borderColor: 'border-green-200' 
        }
      case 'PROCESSING':
      case 'FORWARDING':
        return { 
          bgColor: 'bg-blue-100', 
          textColor: 'text-blue-800', 
          borderColor: 'border-blue-200' 
        }
      case 'PROCESS_FAILED':
      case 'FORWARD_FAILED':
        return { 
          bgColor: 'bg-red-100', 
          textColor: 'text-red-800', 
          borderColor: 'border-red-200' 
        }
      case 'WAIT_FOR_PROCESSING':
      case 'WAIT_FOR_FORWARDING':
        return { 
          bgColor: 'bg-yellow-100', 
          textColor: 'text-yellow-800', 
          borderColor: 'border-yellow-200' 
        }
      default:
        return { 
          bgColor: 'bg-gray-100', 
          textColor: 'text-gray-800', 
          borderColor: 'border-gray-200' 
        }
    }
  }

  // Get status icon
  const getStatusIcon = () => {
    if (!showIcon) return null

    switch (status) {
      case 'COMPLETED':
        return '✓'
      case 'PROCESSING':
      case 'FORWARDING':
        return '⟳'
      case 'PROCESS_FAILED':
      case 'FORWARD_FAILED':
        return '✗'
      case 'WAIT_FOR_PROCESSING':
      case 'WAIT_FOR_FORWARDING':
        return '⏱'
      default:
        return null
    }
  }

  const { bgColor, textColor, borderColor } = getStatusStyles();
  const displayStatus = getDisplayStatus(status);

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${bgColor} ${textColor} border ${borderColor}`}>
      {showIcon && <span className="mr-1">{getStatusIcon()}</span>}
      {displayStatus}
    </span>
  )
}

export default DocumentStatus 