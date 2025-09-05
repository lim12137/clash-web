import i18next from "i18next";

import { App } from "antd";

interface StaticConfirmProps {
  title: string;
  content: React.ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const useConfirmModal = () => {
  const { modal } = App.useApp();

  const confirm = ({
    title,
    content,
    okText,
    cancelText,
    danger = false,
    onConfirm,
    onCancel,
  }: StaticConfirmProps) => {
    return modal.confirm({
      title,
      content,
      okText: okText || i18next.t("common.confirm"),
      cancelText: cancelText || i18next.t("common.cancel"),
      okButtonProps: { danger },
      onOk: onConfirm,
      onCancel,
    });
  };

  return { confirm };
};
