"use client";

import React from "react";
import { useTranslation, Trans } from "react-i18next";
import { Modal } from "antd";
import { AlertCircle } from "lucide-react";

interface MemoryDeleteConfirmationProps {
  visible: boolean;
  targetTitle: string;
  onOk: () => void;
  onCancel: () => void;
}

/**
 * MemoryDeleteConfirmation - Confirmation dialog for clearing memory
 * Used in the memory management page to confirm destructive actions
 */
export default function MemoryDeleteConfirmation({
  visible,
  targetTitle,
  onOk,
  onCancel,
}: MemoryDeleteConfirmationProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={visible}
      title={
        <div className="flex items-center gap-3 text-lg font-bold">
          <AlertCircle className="size-6 text-yellow-500" />
          <span>{t("memoryDeleteModal.title")}</span>
        </div>
      }
      onOk={onOk}
      onCancel={onCancel}
      okText={t("memoryDeleteModal.clear")}
      cancelText={t("common.cancel")}
      okButtonProps={{ danger: true }}
      destroyOnClose
      centered
    >
      <div className="space-y-4 mt-4">
        <p className="text-base">
          <Trans
            i18nKey="memoryDeleteModal.description"
            values={{ title: targetTitle || "" }}
            components={{ strong: <strong className="font-semibold" /> }}
          />
        </p>
        <p className="text-sm text-gray-500">
          {t("memoryDeleteModal.prompt")}
        </p>
      </div>
    </Modal>
  );
}

