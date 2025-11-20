"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Tabs,
  Card,
  Badge,
  Button,
  App,
  Spin,
  Tag,
  Tooltip,
  Pagination,
} from "antd";
import { Download, ScanText } from "lucide-react";
import { FieldNumberOutlined } from "@ant-design/icons";
import knowledgeBaseService from "@/services/knowledgeBaseService";
import { Document } from "@/types/knowledgeBase";
import log from "@/lib/logger";

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

const PAGE_SIZE = 10;

const TABS_ROOT_CLASS = "document-chunk-tabs";

const DocumentChunk: React.FC<DocumentChunkProps> = ({
  knowledgeBaseName,
  documents,
  getFileIcon,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [activeDocumentKey, setActiveDocumentKey] = useState<string>("");
  const [documentChunkCounts, setDocumentChunkCounts] = useState<
    Record<string, number>
  >({});
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
  }>({
    page: 1,
    pageSize: PAGE_SIZE,
  });

  // Set active document when documents change
  useEffect(() => {
    if (documents.length > 0 && !activeDocumentKey) {
      setActiveDocumentKey(documents[0].id);
      // Reset pagination when document changes
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [documents, activeDocumentKey]);

  // Load chunks for active document with server-side pagination
  useEffect(() => {
    const loadChunks = async () => {
      if (!knowledgeBaseName || !activeDocumentKey) {
        return;
      }

      setLoading(true);
      try {
        const result = await knowledgeBaseService.previewChunksPaginated(
          knowledgeBaseName,
          pagination.page,
          pagination.pageSize,
          activeDocumentKey
        );

        setChunks(result.chunks || []);
        setTotal(result.total || 0);
        setDocumentChunkCounts((prev) => ({
          ...prev,
          [activeDocumentKey]: result.total || 0,
        }));
      } catch (error) {
        log.error("Failed to load chunks:", error);
        message.error(t("document.chunk.error.loadFailed"));
      } finally {
        setLoading(false);
      }
    };

    loadChunks();
  }, [
    knowledgeBaseName,
    activeDocumentKey,
    pagination.page,
    pagination.pageSize,
    message,
    t,
  ]);

  useEffect(() => {
    if (documents.length === 0) {
      setDocumentChunkCounts({});
      setActiveDocumentKey("");
      return;
    }

    setDocumentChunkCounts((prev) => {
      const next = { ...prev };
      const docIds = new Set<string>();

      documents.forEach((doc) => {
        docIds.add(doc.id);

        if (
          typeof doc.chunk_num === "number" &&
          doc.chunk_num >= 0 &&
          next[doc.id] !== doc.chunk_num
        ) {
          next[doc.id] = doc.chunk_num;
        }
      });

      Object.keys(next).forEach((docId) => {
        if (!docIds.has(docId)) {
          delete next[docId];
        }
      });

      return next;
    });
  }, [documents]);

  // Handle document tab change
  const handleTabChange = (key: string) => {
    setActiveDocumentKey(key);
    setChunks([]);
    setTotal(documentChunkCounts[key] ?? 0);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Handle pagination change
  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination({ page, pageSize });
  };

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

  const getDisplayName = (name: string): string => {
    const lastDotIndex = name.lastIndexOf(".");
    if (lastDotIndex <= 0) {
      return name;
    }
    return name.substring(0, lastDotIndex);
  };

  const renderDocumentLabel = (doc: Document, chunkCount: number) => {
    const displayName = getDisplayName(doc.name || "");

    return (
      <Tooltip title={displayName} placement="top" arrow>
        <div className="flex w-full items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span>{getFileIcon(doc.type)}</span>
            <span className="truncate text-sm font-medium text-gray-800 max-w-[150px]">
              {displayName}
            </span>
          </div>
          <Badge
            color="#1677ff"
            showZero
            count={chunkCount}
            className="flex-shrink-0"
          />
        </div>
      </Tooltip>
    );
  };

  const tabItems = documents.map((doc) => {
    const chunkCount = documentChunkCounts[doc.id] ?? doc.chunk_num ?? 0;
    const isActive = doc.id === activeDocumentKey;
    const docChunksData = isActive
      ? { chunks, total, paginatedChunks: chunks }
      : { chunks: [], total: 0, paginatedChunks: [] };

    return {
      key: doc.id,
      label: renderDocumentLabel(doc, chunkCount),
      children: (
        <div className="flex h-full flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-8">
            {loading && docChunksData.paginatedChunks.length === 0 ? (
              <div className="flex h-52 items-center justify-center">
                <Spin size="large" />
              </div>
            ) : docChunksData.total === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
                {t("document.chunk.noChunks")}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {docChunksData.paginatedChunks.map((chunk, index) => (
                  <Card
                    key={chunk.id || index}
                    size="small"
                    className="w-full"
                    title={
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          <Tag className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-800 border border-gray-200 rounded-md">
                            <FieldNumberOutlined className="text-[12px]" />
                            <span>
                              {(pagination.page - 1) * pagination.pageSize +
                                index +
                                1}
                            </span>
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
                    <div className="max-h-[150px] overflow-y-auto break-words whitespace-pre-wrap text-sm">
                      {chunk.content || ""}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
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

  const activeDocumentTotal =
    documentChunkCounts[activeDocumentKey] ?? total ?? 0;
  const shouldShowPagination = activeDocumentTotal > 0;

  return (
    <div className="flex h-full w-full flex-col min-h-0 overflow-hidden">
      <Tabs
        tabPosition="left"
        activeKey={activeDocumentKey}
        onChange={handleTabChange}
        items={tabItems}
        className={`h-full w-full min-h-0 ${TABS_ROOT_CLASS}`}
        rootClassName="h-full"
      />
      {shouldShowPagination && (
        <div className="sticky bottom-0 left-0 z-10 flex w-full justify-center bg-white px-8 pb-4 pt-2 shadow-[0_-4px_12px_rgba(15,23,42,0.04)]">
          <Pagination
            current={pagination.page}
            pageSize={pagination.pageSize}
            total={activeDocumentTotal}
            onChange={handlePaginationChange}
            disabled={loading}
            showQuickJumper
            showTotal={(pageTotal, range) =>
              `${range[0]}-${range[1]} of ${pageTotal}`
            }
          />
        </div>
      )}
    </div>
  );
};

export default DocumentChunk;

