import React from "react";

interface StatusBadgeProps {
  type: "success" | "warning" | "error" | "info" | "default";
  text: string;
  icon?: React.ReactNode;
  size?: "small" | "medium" | "large";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  text,
  icon,
  size = "small",
}) => {
  // Get styles based on type
  const getStyleByType = (): React.CSSProperties => {
    switch (type) {
      case "success":
        return {
          color: "#52c41a",
          borderColor: "#b7eb8f",
          backgroundColor: "#f6ffed",
        };
      case "warning":
        return {
          color: "#faad14",
          borderColor: "#ffe58f",
          backgroundColor: "#fffbe6",
        };
      case "error":
        return {
          color: "#f5222d",
          borderColor: "#ffa39e",
          backgroundColor: "#fff1f0",
        };
      case "info":
        return {
          color: "#1890ff",
          borderColor: "#91d5ff",
          backgroundColor: "#e6f7ff",
        };
      default:
        return {
          color: "#d9d9d9",
          borderColor: "#d9d9d9",
          backgroundColor: "#fafafa",
        };
    }
  };

  // Get size styles based on size
  const getSizeStyle = (): React.CSSProperties => {
    switch (size) {
      case "large":
        return { fontSize: "14px", padding: "4px 8px" };
      case "medium":
        return { fontSize: "12px", padding: "2px 6px" };
      case "small":
      default:
        return { fontSize: "10px", padding: "1px 5px" };
    }
  };

  return (
    <span
      className="inline-flex items-center rounded-full"
      style={{
        ...getStyleByType(),
        ...getSizeStyle(),
        fontWeight: 500,
        lineHeight: 1.4,
      }}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {text}
    </span>
  );
};

export default StatusBadge;
