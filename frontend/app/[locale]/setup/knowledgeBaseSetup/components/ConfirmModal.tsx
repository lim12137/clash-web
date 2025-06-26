import React from 'react'
import { Modal } from 'antd'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

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
  okText,
  cancelText,
  danger = false,
  visible,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()

  return (
    <Modal
      title={title}
      open={visible}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={okText || t('common.confirm')}
      cancelText={cancelText || t('common.cancel')}
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
  okText,
  cancelText,
  danger = false,
  onConfirm,
  onCancel
}: StaticConfirmProps) => {
  return Modal.confirm({
    title,
    content,
    okText: okText || i18next.t('common.confirm'),
    cancelText: cancelText || i18next.t('common.cancel'),
    okButtonProps: { danger },
    onOk: onConfirm,
    onCancel
  })
}

export default ConfirmModal 