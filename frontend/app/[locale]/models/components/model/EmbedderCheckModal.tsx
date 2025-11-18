"use client";

import { useTranslation } from "react-i18next";
import { Modal, Button } from "antd";
import { WarningFilled } from "@ant-design/icons";

interface EmbedderCheckModalProps {
  // Existing empty selection warning modal
  emptyWarningOpen: boolean;
  onEmptyOk: () => void;
  onEmptyCancel: () => void;

  // New connectivity warning modal
  connectivityWarningOpen: boolean;
  onConnectivityOk: () => void;
  onConnectivityCancel: () => void;

  // New modify embedding confirmation modal
  modifyWarningOpen: boolean;
  onModifyOk: () => void;
  onModifyCancel: () => void;
}

export default function EmbedderCheckModal(props: EmbedderCheckModalProps) {
  const { t } = useTranslation();
  const {
    emptyWarningOpen,
    onEmptyOk,
    onEmptyCancel,
    connectivityWarningOpen,
    onConnectivityOk,
    onConnectivityCancel,
    modifyWarningOpen,
    onModifyOk,
    onModifyCancel,
  } = props;

  return (
    <>
      {/* Existing empty embedding selection warning */}
      <Modal
        title={t("embedding.emptyWarningModal.title")}
        open={emptyWarningOpen}
        onCancel={onEmptyCancel}
        centered
        footer={
          <div className="flex justify-end mt-6 gap-4">
            <Button onClick={onEmptyOk}>
              {t("embedding.emptyWarningModal.ok_continue")}
            </Button>
            <Button type="primary" onClick={onEmptyCancel}>
              {t("embedding.emptyWarningModal.cancel")}
            </Button>
          </div>
        }
      >
        <div className="py-2">
          <div className="flex items-center">
            <WarningFilled
              className="text-yellow-500 mt-1 mr-2"
              style={{ fontSize: "48px" }}
            />
            <div className="ml-3 mt-2">
              <div>{t("embedding.emptyWarningModal.content")}</div>
              <div />
              <div className="mt-2 text-xs opacity-70">
                {t("embedding.emptyWarningModal.tip")}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* New connectivity check warning */}
      <Modal
        title={t("embedding.unavaliableWarningModal.title")}
        open={connectivityWarningOpen}
        onCancel={onConnectivityCancel}
        centered
        footer={
          <div className="flex justify-end mt-6 gap-4">
            <Button onClick={onConnectivityOk}>
              {t("embedding.unavaliableWarningModal.ok")}
            </Button>
            <Button type="primary" onClick={onConnectivityCancel}>
              {t("embedding.unavaliableWarningModal.cancel")}
            </Button>
          </div>
        }
      >
        <div className="py-2">
          <div className="flex items-center">
            <WarningFilled
              className="text-yellow-500 mt-1 mr-2"
              style={{ fontSize: "48px" }}
            />
            <div className="ml-3 mt-2">
              <div className="text-sm leading-6">
                {t("embedding.unavaliableWarningModal.content")}
              </div>
              <div className="mt-2 text-xs opacity-70">
                {t("embedding.unavaliableWarningModal.tip")}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* New modify embedding confirmation warning */}
      <Modal
        title={t("embedding.modifyWarningModal.title")}
        open={modifyWarningOpen}
        onCancel={onModifyCancel}
        centered
        footer={
          <div className="flex justify-end mt-6 gap-4">
            <Button onClick={onModifyOk}>
              {t("embedding.modifyWarningModal.ok_proceed")}
            </Button>
            <Button type="primary" onClick={onModifyCancel}>
              {t("embedding.modifyWarningModal.cancel")}
            </Button>
          </div>
        }
      >
        <div className="py-2">
          <div className="flex items-center">
            <WarningFilled
              className="text-yellow-500 mt-1 mr-2"
              style={{ fontSize: "48px" }}
            />
            <div className="ml-3 mt-2">
              <div className="text-sm leading-6">
                {t("embedding.modifyWarningModal.content")}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}


