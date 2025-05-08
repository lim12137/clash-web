"use client";
import { ApiMessage, SearchResult, AgentStep, ApiMessageItem, ChatMessageType, MinioFileItem } from "@/types/chat";

export function extractAssistantMsgFromResponse(dialog_msg: ApiMessage, index: number, create_time: number) {
  let searchResultsContent: SearchResult[] = [];
  if (dialog_msg.search && Array.isArray(dialog_msg.search) && dialog_msg.search.length > 0) {
    searchResultsContent = dialog_msg.search.map(item => ({
      title: item.title || "未知标题",
      url: item.url || "#",
      text: item.text || "无内容描述",
      published_date: item.published_date || "",
      tool_sign: item.tool_sign || "",
      cite_index: typeof item.cite_index === 'number' ? item.cite_index : -1
    }));
  }

  // 处理图片
  let imagesContent: string[] = [];
  if (dialog_msg.picture && Array.isArray(dialog_msg.picture) && dialog_msg.picture.length > 0) {
    imagesContent = dialog_msg.picture;
  }

  // 提取Message中的内容
  let finalAnswer = "";
  let steps: AgentStep[] = [];
  if (dialog_msg.message && Array.isArray(dialog_msg.message)) {
    dialog_msg.message.forEach((msg: ApiMessageItem) => {
      switch (msg.type) {
        case "final_answer": {
          finalAnswer += msg.content;
          break;
        }

        case "step_count": {
          // 创建新步骤
          steps.push({
            id: `step-${steps.length + 1}`,
            title: msg.content.trim(),
            content: "",
            expanded: false,
            contents: [],
            metrics: "",
            thinking: { content: "", expanded: false },
            code: { content: "", expanded: false },
            output: { content: "", expanded: false }
          });
          break;
        }

        case "model_output_thinking": {
          const currentStep = steps[steps.length - 1];
          if (currentStep) {
            const contentId = `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            currentStep.contents.push({
              id: contentId,
              type: "model_output",
              subType: "thinking",
              content: msg.content,
              expanded: true,
              timestamp: Date.now()
            });
          }
          break;
        }

        case "execution_logs": {
          const currentStep = steps[steps.length - 1];
          if (currentStep) {
            // 创建新的执行输出
            const contentId = `execution-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

            currentStep.contents.push({
              id: contentId,
              type: "execution",
              content: msg.content,
              expanded: true,
              timestamp: Date.now()
            });
          }
          break;
        }

        case "error": {
          const currentStep = steps[steps.length - 1];
          if (currentStep) {
            // 创建错误内容
            const contentId = `error-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            currentStep.contents.push({
              id: contentId,
              type: "error",
              content: msg.content,
              expanded: true,
              timestamp: Date.now()
            });
          }
          break;
        }

        case "search_content_placeholder": {
          const currentStep = steps[steps.length - 1];
          if (currentStep && dialog_msg.search && dialog_msg.search.length > 0) {
            // 将search_content_placeholder转换为search_content
            const contentId = `search-content-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            
            // 创建搜索内容的JSON字符串
            try {
              const searchContent = JSON.stringify(dialog_msg.search);
              
              // 添加为search_content类型消息
              currentStep.contents.push({
                id: contentId,
                type: "search_content",
                content: searchContent, // 使用实际的搜索结果
                expanded: true,
                timestamp: Date.now()
              });
            } catch (e) {
              console.error("无法解析搜索结果:", e);
            }
          }
          break;
        }

        case "token_count": {
          const currentStep = steps[steps.length - 1];
          if (currentStep) {
            currentStep.metrics = msg.content;
          }
          break;
        }

        case "card": {
          const currentStep = steps[steps.length - 1];
          if (currentStep) {
            // 创建卡片内容
            const contentId = `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            currentStep.contents.push({
              id: contentId,
              type: "card",
              content: msg.content,
              expanded: true,
              timestamp: Date.now()
            });
          }
          break;
        }

        case "tool": {
          const currentStep = steps[steps.length - 1];
          if (currentStep) {
            // 创建工具调用内容
            const contentId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            currentStep.contents.push({
              id: contentId,
              type: "executing", // 使用现有的executing类型来表示工具调用
              content: msg.content,
              expanded: true,
              timestamp: Date.now()
            });
          }
          break;
        }

        default:
          // 处理其他类型的消息
          break;
      }
    });

  }

  // 创建格式化的助手消息
  const formattedAssistantMsg: ChatMessageType = {
    id: `assistant-${index}-${Date.now()}`,
    role: "assistant",
    message_id: dialog_msg.message_id,
    content: "",
    opinion_flag: dialog_msg.opinion_flag,
    timestamp: new Date(create_time),
    steps: steps,
    finalAnswer: finalAnswer,
    agentRun: "",
    isComplete: true,
    showRawContent: false,
    searchResults: searchResultsContent,
    images: imagesContent,
    attachments: undefined
  };
  return formattedAssistantMsg;
}

export function extractUserMsgFromResponse(dialog_msg: ApiMessage, index: number, create_time: number) {
  let userContent = "";
  if (Array.isArray(dialog_msg.message)) {
    const stringMessage = dialog_msg.message.find((m: { type: string; content: string; }) => m.type === "string");
    userContent = stringMessage?.content || "";
  } else if (typeof dialog_msg.message === "string") {
    userContent = dialog_msg.message;
  } else if (dialog_msg.message && typeof dialog_msg.message === "object") {
    const msgObj = dialog_msg.message as { content?: string; };
    userContent = msgObj.content || "";
  }

  // 处理用户消息的minio_files
  let userAttachments: MinioFileItem[] = [];
  if (dialog_msg.minio_files && Array.isArray(dialog_msg.minio_files) && dialog_msg.minio_files.length > 0) {
    // 处理minio_files
    userAttachments = dialog_msg.minio_files.map(item => {
      return {
        type: item.type || '',
        name: item.name || '',
        size: item.size || 0,
        object_name: item.object_name,
        url: item.url,
        description: item.description
      };
    });
  }

  const formattedUserMsg: ChatMessageType = {
    id: `user-${index}-${Date.now()}`,
    role: "user",
    message_id: dialog_msg.message_id,
    content: userContent,
    opinion_flag: dialog_msg.opinion_flag, // 用户消息没有点赞/点踩状态
    timestamp: new Date(create_time),
    showRawContent: true,
    isComplete: true,
    // 添加attachments字段，不再使用minio_files
    attachments: userAttachments.length > 0 ? userAttachments : undefined
  };
  return formattedUserMsg;
}
