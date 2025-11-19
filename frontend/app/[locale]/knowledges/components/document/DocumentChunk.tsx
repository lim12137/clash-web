"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, Card, Badge, Button, App, Spin, Tag } from "antd";
import { Download, ScanText } from "lucide-react";
import { FieldNumberOutlined } from "@ant-design/icons";
import knowledgeBaseService from "@/services/knowledgeBaseService";
import { Document } from "@/types/knowledgeBase";
import log from "@/lib/logger";
import { SETUP_PAGE_CONTAINER } from "@/const/layoutConstants";

interface Chunk {
  id: string;
  content: string;
  path_or_url?: string;
  filename?: string;
  create_time?: string;
}

interface DocumentChunkProps {
  knowledgeBaseName: string;
  documents: Document[];
  getFileIcon: (type: string) => string;
}

const FILENAME_TOOLTIP_THRESHOLD = 24;

const DocumentChunk: React.FC<DocumentChunkProps> = ({
  knowledgeBaseName,
  documents,
  getFileIcon,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDocumentKey, setActiveDocumentKey] = useState<string>("");

  // Group chunks by document (path_or_url)
  const chunksByDocument = useMemo(() => {
    const grouped: Record<string, Chunk[]> = {};
    chunks.forEach((chunk) => {
      const docKey = chunk.path_or_url || chunk.filename || "unknown";
      if (!grouped[docKey]) {
        grouped[docKey] = [];
      }
      grouped[docKey].push(chunk);
    });
    return grouped;
  }, [chunks]);

  // Load chunks when component mounts or knowledge base changes
  useEffect(() => {
    const loadChunks = async () => {
      if (!knowledgeBaseName) return;

      setLoading(true);
      try {
        const loadedChunks = await knowledgeBaseService.previewChunks(
          knowledgeBaseName
        );
        setChunks(loadedChunks);
      } catch (error) {
        log.error("Failed to load chunks:", error);
        message.error(t("document.chunk.error.loadFailed"));
      } finally {
        setLoading(false);
      }
    };

    loadChunks();
  }, [knowledgeBaseName, message, t]);

  // Set active document when documents change
  useEffect(() => {
    if (documents.length > 0 && !activeDocumentKey) {
      setActiveDocumentKey(documents[0].id);
    }
  }, [documents, activeDocumentKey]);

  // Download chunk as txt file
  const handleDownloadChunk = (chunk: Chunk) => {
    try {
      const content = chunk.content || "";
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${chunk.id}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      log.error("Failed to download chunk:", error);
      message.error(t("document.chunk.error.downloadFailed"));
    }
  };


  // Create tab items for documents
  const getDisplayName = (name: string): string => {
    const lastDotIndex = name.lastIndexOf(".");
    if (lastDotIndex <= 0) {
      return name;
    }
    return name.substring(0, lastDotIndex);
  };

  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);

  const handleLabelMouseEnter = useCallback((docId: string) => {
    setHoveredDocId(docId);
  }, []);

  const handleLabelMouseLeave = useCallback(() => {
    setHoveredDocId(null);
  }, []);

  const renderDocumentLabel = (doc: Document, chunkCount: number) => {
    const displayName = getDisplayName(doc.name || "");
    const shouldExpandOnHover =
      (doc.name || "").length > displayName.length ||
      displayName.length > FILENAME_TOOLTIP_THRESHOLD;

    const isHovered = hoveredDocId === doc.id;
    const widthClass =
      shouldExpandOnHover && isHovered ? "max-w-full" : "max-w-[200px]";

    return (
      <div
        className="flex w-full items-center justify-between gap-2 min-w-0"
        onMouseEnter={() =>
          shouldExpandOnHover ? handleLabelMouseEnter(doc.id) : undefined
        }
        onMouseLeave={shouldExpandOnHover ? handleLabelMouseLeave : undefined}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span>{getFileIcon(doc.type)}</span>
          <span
            className={`truncate text-sm font-medium text-gray-800 transition-[max-width] duration-200 ease-out inline-block ${widthClass}`}
          >
            {displayName}
          </span>
        </div>
        <Badge color="#1677ff" showZero count={chunkCount} className="flex-shrink-0" />
      </div>
    );
  };

  const tabItems = documents.map((doc) => {
    const docChunks = chunksByDocument[doc.id] || [];
    const chunkCount = docChunks.length;

    return {
      key: doc.id,
      label: renderDocumentLabel(doc, chunkCount),
      children: (
        <div className="h-full min-h-0 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-52 items-center justify-center">
              <Spin size="large" />
            </div>
          ) : docChunks.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
              {t("document.chunk.noChunks")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {docChunks.map((chunk, index) => (
                <Card
                  key={chunk.id || index}
                  size="small"
                  className="flex flex-col"
                  headStyle={{ padding: "8px 12px" }}
                  title={
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        <Tag className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-800 border border-gray-200 rounded-md">
                          <FieldNumberOutlined className="text-[12px]" />
                          <span>{index + 1}</span>
                        </Tag>
                        <Tag className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-800 border border-gray-200 rounded-md">
                          <ScanText size={14} />
                          <span>
                            {t("document.chunk.characterCount", {
                              count: (chunk.content || "").length,
                            })}
                          </span>
                        </Tag>
                      </div>
                      <Button
                        type="text"
                        icon={<Download size={16} />}
                        onClick={() => handleDownloadChunk(chunk)}
                        size="small"
                        className="self-center"
                      />
                    </div>
                  }
                >
                  <div className="max-h-[200px] overflow-y-auto break-words whitespace-pre-wrap text-sm">
                    {chunk.content || ""}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    };
  });

  if (loading && chunks.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col min-h-0">
      <Tabs
        tabPosition="top"
        activeKey={activeDocumentKey}
        onChange={setActiveDocumentKey}
        items={tabItems}
        className="h-full w-full"
      />
    </div>
  );
};

export default DocumentChunk;

