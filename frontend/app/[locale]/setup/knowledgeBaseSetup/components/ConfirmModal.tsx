import React from 'react'
import { Modal } from 'antd'

interface ConfirmModalProps {
  title: string
  content: React.ReactNode
  okText?: string
  cancelText?: string
  danger?: boolean
  visible: boolean
  onConfirm: () => void
  onCancel: () => void
}

interface StaticConfirmProps {
  title: string
  content: React.ReactNode
  okText?: string
  cancelText?: string
  danger?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

// 创建扩展了静态方法的接口
interface ConfirmModalComponent extends React.FC<ConfirmModalProps> {
  confirm: (props: StaticConfirmProps) => ReturnType<typeof Modal.confirm>
}

// 组件定义
const ConfirmModal: ConfirmModalComponent = ({ 
  title,
  content,
  okText = '确定',
  cancelText = '取消',
  danger = false,
  visible,
  onConfirm,
  onCancel
}) => {
  return (
    <Modal
      title={title}
      open={visible}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={{ danger }}
    >
      {content}
    </Modal>
  )
}

// 静态方法
ConfirmModal.confirm = ({
  title,
  content,
  okText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel
}: StaticConfirmProps) => {
  return Modal.confirm({
    title,
    content,
    okText,
    cancelText,
    okButtonProps: { danger },
    onOk: onConfirm,
    onCancel
  })
}

export default ConfirmModal 