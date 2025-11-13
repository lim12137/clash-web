"use client";

import { Modal, Button } from "antd";
import { useTranslation } from "react-i18next";
import { InfoCircleFilled } from "@ant-design/icons";

type AsyncOrSyncHandler = () => void | Promise<void>;

interface SaveConfirmModalProps {
  open: boolean;
  onCancel: AsyncOrSyncHandler;
  onSave: AsyncOrSyncHandler;
  onClose?: AsyncOrSyncHandler;
  width?: number;
}

export default function SaveConfirmModal({
  open,
  onCancel,
  onSave,
  onClose,
  width = 520,
}: SaveConfirmModalProps) {
  const { t } = useTranslation("common");

  const handleCancel = () => {
    void onCancel();
  };

  const handleSave = () => {
    void onSave();
  };

  // Handle close button click - only close modal, don't execute discard logic
  const handleClose = () => {
    if (onClose) {
      void onClose();
    }
  };

  return (
    <Modal
      title={t("agentConfig.modals.saveConfirm.title")}
      open={open}
      onCancel={handleClose}
      centered
      footer={
        <div className="flex justify-end mt-4 gap-3">
          <Button onClick={handleCancel}>{t("agentConfig.modals.saveConfirm.discard")}</Button>
          <Button type="primary" onClick={handleSave}>
            {t("agentConfig.modals.saveConfirm.save")}
          </Button>
        </div>
      }
      width={width}
    >
      <div className="py-2">
        <div className="flex items-center">
          <InfoCircleFilled
            className="text-blue-500 mt-1 mr-2"
            style={{ fontSize: "48px" }}
          />
          <div className="ml-3 mt-2">
            <div className="text-sm leading-6">
              {t("agentConfig.modals.saveConfirm.content")}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}


