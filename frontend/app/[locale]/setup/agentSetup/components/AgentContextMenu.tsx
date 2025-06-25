"use client"

import { useState, useEffect, useRef } from 'react'
import { EditOutlined, ExportOutlined, DeleteOutlined } from '@ant-design/icons'
import { Agent } from '../ConstInterface'
import { useTranslation } from 'react-i18next'

interface AgentContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  agent: Agent | null;
  onEdit: (agent: Agent) => void;
  onExport: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onClose: () => void;
}

export default function AgentContextMenu({
  visible,
  x,
  y,
  agent,
  onEdit,
  onExport,
  onDelete,
  onClose
}: AgentContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('common');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [visible, onClose]);

  if (!visible || !agent) {
    return null;
  }

  const handleEdit = () => {
    onEdit(agent);
    onClose();
  };

  const handleExport = () => {
    onExport(agent);
    onClose();
  };

  const handleDelete = () => {
    onDelete(agent);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[120px]"
      style={{
        left: `${x}px`,
        top: `${y}px`
      }}
    >
      <div
        className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-sm text-gray-700"
        onClick={handleEdit}
      >
        <EditOutlined className="mr-2" />
        {t('agent.contextMenu.edit')}
      </div>
      <div
        className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-sm text-gray-700"
        onClick={handleExport}
      >
        <ExportOutlined className="mr-2" />
        {t('agent.contextMenu.export')}
      </div>
      <div className="border-t border-gray-200 my-1"></div>
      <div
        className="px-3 py-2 hover:bg-red-50 cursor-pointer flex items-center text-sm text-red-600"
        onClick={handleDelete}
      >
        <DeleteOutlined className="mr-2" />
        {t('agent.contextMenu.delete')}
      </div>
    </div>
  );
} 