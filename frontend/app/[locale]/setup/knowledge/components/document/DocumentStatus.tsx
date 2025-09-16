import React from "react";
import { useTranslation } from "react-i18next";
import { DOCUMENT_STATUS } from "@/const/knowledgeBase";

interface DocumentStatusProps {
  status: string;
  showIcon?: boolean;
}

export const DocumentStatus: React.FC<DocumentStatusProps> = ({
  status,
  showIcon = false,
}) => {
  const { t } = useTranslation();

  // Map API status to display status
  const getDisplayStatus = (apiStatus: string): string => {
    switch (apiStatus) {
      case DOCUMENT_STATUS.WAIT_FOR_PROCESSING:
        return t("document.status.waitForProcessing");
      case DOCUMENT_STATUS.WAIT_FOR_FORWARDING:
        return t("document.status.waitForForwarding");
      case DOCUMENT_STATUS.PROCESSING:
        return t("document.status.processing");
      case DOCUMENT_STATUS.FORWARDING:
        return t("document.status.forwarding");
      case DOCUMENT_STATUS.COMPLETED:
        return t("document.status.completed");
      case DOCUMENT_STATUS.PROCESS_FAILED:
        return t("document.status.processFailed");
      case DOCUMENT_STATUS.FORWARD_FAILED:
        return t("document.status.forwardFailed");
      default:
        return apiStatus;
    }
  };

  // Get status type and corresponding styles
  const getStatusStyles = (): {
    bgColor: string;
    textColor: string;
    borderColor: string;
  } => {
    switch (status) {
      case DOCUMENT_STATUS.COMPLETED:
        return {
          bgColor: "bg-green-100",
          textColor: "text-green-800",
          borderColor: "border-green-200",
        };
      case DOCUMENT_STATUS.PROCESSING:
      case DOCUMENT_STATUS.FORWARDING:
        return {
          bgColor: "bg-blue-100",
          textColor: "text-blue-800",
          borderColor: "border-blue-200",
        };
      case DOCUMENT_STATUS.PROCESS_FAILED:
      case DOCUMENT_STATUS.FORWARD_FAILED:
        return {
          bgColor: "bg-red-100",
          textColor: "text-red-800",
          borderColor: "border-red-200",
        };
      case DOCUMENT_STATUS.WAIT_FOR_PROCESSING:
      case DOCUMENT_STATUS.WAIT_FOR_FORWARDING:
        return {
          bgColor: "bg-yellow-100",
          textColor: "text-yellow-800",
          borderColor: "border-yellow-200",
        };
      default:
        return {
          bgColor: "bg-gray-100",
          textColor: "text-gray-800",
          borderColor: "border-gray-200",
        };
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    if (!showIcon) return null;

    switch (status) {
      case DOCUMENT_STATUS.COMPLETED:
        return "✓";
      case DOCUMENT_STATUS.PROCESSING:
      case DOCUMENT_STATUS.FORWARDING:
        return "⟳";
      case DOCUMENT_STATUS.PROCESS_FAILED:
      case DOCUMENT_STATUS.FORWARD_FAILED:
        return "✗";
      case DOCUMENT_STATUS.WAIT_FOR_PROCESSING:
      case DOCUMENT_STATUS.WAIT_FOR_FORWARDING:
        return "⏱";
      default:
        return null;
    }
  };

  const { bgColor, textColor, borderColor } = getStatusStyles();
  const displayStatus = getDisplayStatus(status);

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium ${bgColor} ${textColor} border ${borderColor} whitespace-nowrap`}
    >
      {showIcon && <span className="mr-1">{getStatusIcon()}</span>}
      {displayStatus}
    </span>
  );
};

export default DocumentStatus;
