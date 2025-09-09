import React from 'react';

interface StaticConfirmProps {
  title: string;
  content: React.ReactNode;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export type { StaticConfirmProps };
