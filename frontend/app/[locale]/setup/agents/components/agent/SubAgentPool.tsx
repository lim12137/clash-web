"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { App, Button } from "antd";
import { UploadOutlined, LinkOutlined, ExclamationCircleOutlined } from "@ant-design/icons";

import { ScrollArea } from "@/components/ui/scrollArea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Agent, SubAgentPoolProps } from "@/types/agentConfig";

import AgentCallRelationshipModal from "./AgentCallRelationshipModal";

/**
 * Sub Agent Pool Component
 */
export default function SubAgentPool({
  onEditAgent,
  onCreateNewAgent,
  onImportAgent,
  onExitEditMode,
  subAgentList = [],
  loadingAgents = false,
  isImporting = false,
  isGeneratingAgent = false,
  editingAgent = null,
  isCreatingNewAgent = false,
}: SubAgentPoolProps) {
  const { t } = useTranslation("common");
  const { message } = App.useApp();

  // Call relationship related state
  const [callRelationshipModalVisible, setCallRelationshipModalVisible] =
    useState(false);
  const [selectedAgentForRelationship, setSelectedAgentForRelationship] =
    useState<Agent | null>(null);

  // Open call relationship modal
  const handleViewCallRelationship = (agent: Agent) => {
    setSelectedAgentForRelationship(agent);
    setCallRelationshipModalVisible(true);
  };

  // Close call relationship modal
  const handleCloseCallRelationshipModal = () => {
    setCallRelationshipModalVisible(false);
    setSelectedAgentForRelationship(null);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full min-h-[300px] lg:min-h-0 overflow-hidden">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium mr-2">
              1
            </div>
            <h2 className="text-lg font-medium">
              {t("subAgentPool.management")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {loadingAgents && (
              <span className="text-sm text-gray-500">
                {t("subAgentPool.loading")}
              </span>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0 border-t pt-2 pb-2">
          <div className="flex flex-col pr-2">
            {/* Function operation block */}
            <div className="mb-4">
              <div className="flex gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex-1 rounded-md p-2 flex items-center cursor-pointer transition-all duration-200 min-h-[70px] ${
                        isCreatingNewAgent
                          ? "bg-blue-100 border border-blue-200 shadow-sm" // Highlight in creation mode
                          : "bg-white hover:bg-blue-50 hover:shadow-sm"
                      }`}
                      onClick={() => {
                        if (isCreatingNewAgent) {
                          // If currently in creation mode, click to exit creation mode
                          onExitEditMode?.();
                        } else {
                          // Otherwise enter creation mode
                          onCreateNewAgent();
                        }
                      }}
                    >
                      <div
                        className={`flex items-center w-full ${
                          isCreatingNewAgent ? "text-blue-700" : "text-blue-600"
                        }`}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 mr-3 flex-shrink-0">
                          <span className="text-sm font-medium">+</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {isCreatingNewAgent
                              ? t("subAgentPool.button.exitCreate")
                              : t("subAgentPool.button.create")}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {isCreatingNewAgent
                              ? t("subAgentPool.description.exitCreate")
                              : t("subAgentPool.description.createAgent")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isCreatingNewAgent
                      ? t("subAgentPool.tooltip.exitCreateMode")
                      : t("subAgentPool.tooltip.createNewAgent")}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex-1 rounded-md p-2 flex items-center transition-all duration-200 min-h-[70px] ${
                        isImporting
                          ? "bg-gray-100 cursor-not-allowed" // Importing: disabled state
                          : "bg-white cursor-pointer hover:bg-green-50 hover:shadow-sm" // Normal state: clickable
                      }`}
                      onClick={isImporting ? undefined : onImportAgent}
                    >
                      <div
                        className={`flex items-center w-full ${
                          isImporting ? "text-gray-400" : "text-green-600" // Use gray when importing
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full mr-3 flex-shrink-0 ${
                            isImporting ? "bg-gray-100" : "bg-green-100"
                          }`}
                        >
                          <UploadOutlined className="text-sm" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {isImporting
                              ? t("subAgentPool.button.importing")
                              : t("subAgentPool.button.import")}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {isImporting
                              ? t("subAgentPool.description.importing")
                              : t("subAgentPool.description.importAgent")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isImporting
                      ? t("subAgentPool.description.importing")
                      : t("subAgentPool.description.importAgent")}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Agent list block */}
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2 px-1">
                {t("subAgentPool.section.agentList")} ({subAgentList.length})
              </div>
              <div className="space-y-0">
                {subAgentList.map((agent) => {
                  const isAvailable = agent.is_available !== false; // Default is true, only unavailable when explicitly false
                  const isCurrentlyEditing =
                    editingAgent && String(editingAgent.id) === String(agent.id); // Ensure type matching

                  return (
                    <Tooltip key={agent.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`py-3 px-2 flex flex-col justify-center transition-colors border-t border-gray-200 h-[80px] ${
                            isCurrentlyEditing
                              ? "bg-blue-50 border-l-4 border-l-blue-500" // Highlight editing agent, add left vertical line
                              : "hover:bg-gray-50 cursor-pointer"
                          }`}
                          onClick={async (e) => {
                            // Prevent event bubbling
                            e.preventDefault();
                            e.stopPropagation();

                            if (!isGeneratingAgent) {
                              if (isCurrentlyEditing) {
                                // If currently editing this Agent, click to exit edit mode
                                onExitEditMode?.();
                              } else {
                                // Otherwise enter edit mode (or switch to this Agent)
                                onEditAgent(agent);
                              }
                            }
                          }}
                        >
                          <div className="flex items-center h-full">
                            <div className="flex-1 overflow-hidden">
                              <div
                                className={`font-medium text-base truncate transition-colors duration-300 ${
                                  !isAvailable ? "text-gray-500" : ""
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  {!isAvailable && (
                                    <ExclamationCircleOutlined className="text-amber-500 text-sm flex-shrink-0" />
                                  )}
                                  {agent.display_name && (
                                    <span className="text-base leading-normal">
                                      {agent.display_name}
                                    </span>
                                  )}
                                  <span
                                    className={`leading-normal ${
                                      agent.display_name
                                        ? "ml-2 text-sm"
                                        : "text-base"
                                    }`}
                                  >
                                    {agent.name}
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`text-xs line-clamp-2 transition-colors duration-300 leading-[1.25] overflow-hidden ${
                                  !isAvailable ? "text-gray-400" : "text-gray-500"
                                }`}
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxHeight: '2.5rem'
                                }}
                              >
                                {agent.description}
                              </div>
                            </div>

                            {/* Operation button area */}
                            <div className="flex items-center gap-1 ml-2">
                              {/* View call relationship button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<LinkOutlined />}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (isAvailable) {
                                        handleViewCallRelationship(agent);
                                      }
                                    }}
                                    disabled={!isAvailable}
                                    className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t("agent.action.viewCallRelationship")}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {!isAvailable
                          ? t("subAgentPool.tooltip.hasUnavailableTools")
                          : isCurrentlyEditing
                          ? t("subAgentPool.tooltip.exitEditMode")
                          : `${t("subAgentPool.tooltip.editAgent")} ${
                              agent.display_name || agent.name
                            }`}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Agent call relationship modal */}
        {selectedAgentForRelationship && (
          <AgentCallRelationshipModal
            visible={callRelationshipModalVisible}
            onClose={handleCloseCallRelationshipModal}
            agentId={Number(selectedAgentForRelationship.id)}
            agentName={
              selectedAgentForRelationship.display_name ||
              selectedAgentForRelationship.name
            }
          />
        )}
      </div>
    </TooltipProvider>
  );
}
