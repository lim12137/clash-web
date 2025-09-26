import { conversationService } from "@/services/conversationService";
import { FilePreview, ChatMessageType } from "@/types/chat";
import { ROLE_ASSISTANT } from "@/const/agentConfig";
import { chatConfig } from "@/const/chatConfig";
import { getI18nKeyByType } from "@/app/chat/internal/chatHelpers";
import log from "@/lib/logger";

/**
 * Handle attachment file preprocessing
 * @param content User message content
 * @param attachments Attachment list
 * @param signal AbortController signal
 * @param onProgress Preprocessing progress callback
 * @param t Translation function
 * @param conversationId Conversation ID
 * @returns Preprocessed query and processing status
 */
export const preprocessAttachments = async (
  content: string,
  attachments: FilePreview[],
  signal: AbortSignal,
  onProgress: (data: any) => void,
  t: any,
  conversationId?: number
): Promise<{
  finalQuery: string;
  success: boolean;
  error?: string;
  fileDescriptions?: Record<string, string>;
}> => {
  if (attachments.length === 0) {
    return { finalQuery: content, success: true };
  }

  try {
    // Call file preprocessing interface
    const preProcessReader = await conversationService.preprocessFiles(
      content,
      attachments.map((attachment) => attachment.file),
      conversationId,
      signal
    );

    if (!preProcessReader)
      throw new Error(t("chatPreprocess.preprocessResponseEmpty"));

    const preProcessDecoder = new TextDecoder();
    let preProcessBuffer = "";
    let finalQuery = content;
    const fileDescriptions: Record<string, string> = {};

    while (true) {
      const { done, value } = await preProcessReader.read();
      if (done) {
        break;
      }

      preProcessBuffer += preProcessDecoder.decode(value, { stream: true });

      const lines = preProcessBuffer.split("\n");
      preProcessBuffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const jsonStr = line.substring(5).trim();
          try {
            const jsonData = JSON.parse(jsonStr);

            // Callback progress information
            onProgress(jsonData);

            // If it is file processing information, save file description
            if (
              jsonData.type === "file_processed" &&
              jsonData.filename &&
              jsonData.description
            ) {
              fileDescriptions[jsonData.filename] = jsonData.description;
            }

            // If it is a completion message, record the final query
            if (jsonData.type === "complete") {
              finalQuery = jsonData.final_query;
            }
          } catch (e) {
            log.error(
              t("chatPreprocess.parsingPreprocessDataFailed"),
              e,
              jsonStr
            );
          }
        }
      }
    }

    return { finalQuery, success: true, fileDescriptions };
  } catch (error) {
    log.error(t("chatPreprocess.filePreprocessingFailed"), error);
    return {
      finalQuery: content,
      success: false,
      error: error instanceof Error ? (error as Error).message : String(error),
    };
  }
};

/**
 * Create a preprocessing step for assistant message
 * @param t Translation function
 * @returns Preprocessing step object
 */
export const createPreprocessingStep = (t: any) => {
  return {
    id: `preprocess-${Date.now()}`,
    title: t("chatInterface.filePreprocessing"),
    content: "",
    expanded: true,
    metrics: "",
    thinking: { content: "", expanded: false },
    code: { content: "", expanded: false },
    output: { content: "", expanded: false },
    contents: [
      {
        id: `preprocess-content-${Date.now()}`,
        type: chatConfig.contentTypes.PREPROCESS,
        content: t("chatInterface.parsingFile"),
        expanded: false,
        timestamp: Date.now(),
      },
    ],
  };
};

/**
 * Create a preprocessing message for assistant
 * @param t Translation function
 * @returns ChatMessageType object for preprocessing
 */
export const createPreprocessingMessage = (t: any): ChatMessageType => {
  return {
    id: `preprocess-msg-${Date.now()}`,
    role: ROLE_ASSISTANT,
    content: "",
    timestamp: new Date(),
    isComplete: false,
    steps: [createPreprocessingStep(t)],
  };
};

/**
 * Update preprocessing step content based on progress data
 * @param lastMsg Last message in conversation
 * @param jsonData Progress data from preprocessing
 * @param t Translation function
 * @param truncationBuffer Buffer for truncation messages
 * @param processedTruncationIds Set of processed truncation IDs
 * @returns Updated message
 */
export const updatePreprocessingStep = (
  lastMsg: ChatMessageType,
  jsonData: any,
  t: any,
  truncationBuffer: any[],
  processedTruncationIds: Set<string>
): ChatMessageType => {
  if (lastMsg.role !== ROLE_ASSISTANT) {
    return lastMsg;
  }

  if (!lastMsg.steps) lastMsg.steps = [];

  // Find the latest preprocessing step
  let step = lastMsg.steps.find(
    (s) => s.title === t("chatInterface.filePreprocessing")
  );

  if (!step) {
    step = createPreprocessingStep(t);
    lastMsg.steps.push(step);
  }

  // Handle truncation messages - buffer them instead of updating immediately
  if (jsonData.type === "truncation") {
    // Create a unique ID for this truncation message to avoid duplicates
    const truncationId = `${jsonData.filename || "unknown"}_${
      jsonData.message || ""
    }`;

    // Only add if not already processed
    if (!processedTruncationIds.has(truncationId)) {
      truncationBuffer.push(jsonData);
      processedTruncationIds.add(truncationId);
    }
    return lastMsg; // Don't update stepContent for truncation
  }

  let stepContent = "";
  switch (jsonData.type) {
    case "progress":
      if (jsonData.message_data) {
        const i18nKey = getI18nKeyByType(jsonData.type);
        stepContent = String(t(i18nKey, jsonData.message_data.params));
      } else {
        stepContent = jsonData.message || "";
      }
      break;
    case "error":
      stepContent = t("chatInterface.parseFileFailed", {
        filename: jsonData.filename,
        message: jsonData.message,
      });
      break;
    case "file_processed":
      stepContent = t("chatInterface.fileParsed", {
        filename: jsonData.filename,
      });
      break;
    case "complete":
      // When complete, process all buffered truncation messages
      if (truncationBuffer.length > 0) {
        // Process truncation messages using internationalization
        const truncationInfo = truncationBuffer
          .map((truncation) => {
            if (truncation.message_data) {
              const i18nKey = getI18nKeyByType(truncation.type);
              return String(t(i18nKey, truncation.message_data.params));
            } else {
              return truncation.message;
            }
          })
          .join(String(t("chatInterface.truncationSeparator")));

        stepContent = t("chatInterface.fileParsingCompleteWithTruncation", {
          truncationInfo: truncationInfo,
        });
      } else {
        stepContent = t("chatInterface.fileParsingComplete");
      }
      break;
    default:
      stepContent = jsonData.message || "";
  }

  // Only update the first content, don't add new ones
  if (step && step.contents && step.contents.length > 0) {
    step.contents[0].content = stepContent;
    step.contents[0].timestamp = Date.now();
  }

  return lastMsg;
};

/**
 * Handle preprocessing error and update message
 * @param lastMsg Last message in conversation
 * @param error Error from preprocessing
 * @param t Translation function
 * @returns Updated message
 */
export const handlePreprocessingError = (
  lastMsg: ChatMessageType,
  error: string,
  t: any
): ChatMessageType => {
  if (lastMsg.role !== ROLE_ASSISTANT) {
    return lastMsg;
  }

  // Handle error codes with internationalization
  let errorMessage;
  if (error === 'REQUEST_ENTITY_TOO_LARGE') {
    errorMessage = t("chatInterface.fileSizeExceeded");
  } else if (error === 'FILE_PARSING_FAILED') {
    errorMessage = t("chatInterface.fileParsingFailed");
  } else {
    // For any other error, show a generic message without exposing technical details
    errorMessage = t("chatInterface.fileProcessingFailed", {
      error: "Unknown error"
    });
  }

  lastMsg.content = errorMessage;
  lastMsg.isComplete = true;

  return lastMsg;
};

