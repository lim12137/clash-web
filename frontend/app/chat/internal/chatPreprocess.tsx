import { AgentStep } from '@/types/chat'
import { conversationService } from '@/services/conversationService';
import { storageService } from '@/services/storageService';
import { FilePreview } from "@/app/chat/layout/chatInput"

// 步骤ID计数器
const stepIdCounter = {current: 0};

/**
 * 解析代理步骤，将文本内容转换为结构化步骤
 */
export const parseAgentSteps = (content: string, defaultExpanded: boolean = false): AgentStep[] => {
  const steps: AgentStep[] = [];
  const stepRegex = /<step[^>]*>([\s\S]*?)<\/step>/g;
  let match;

  while ((match = stepRegex.exec(content)) !== null) {
    const stepContent = match[1];
    const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(stepContent);
    const contentMatch = /<content>([\s\S]*?)<\/content>/i.exec(stepContent);

    const step: AgentStep = {
      id: `step-${stepIdCounter.current++}`,
      title: titleMatch ? titleMatch[1].trim() : "步骤",
      content: "",
      expanded: defaultExpanded,
      thinking: { content: "", expanded: false },
      code: { content: "", expanded: false },
      output: { content: "", expanded: false },
      metrics: "",
      contents: []
    };

    if (contentMatch) {
      step.contents = [{
        id: `content-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: "model_output",
        content: contentMatch[1],
        expanded: false,
        timestamp: Date.now()
      }];
    }

    steps.push(step);
  }

  return steps;
};

/**
 * 处理附件文件预处理
 * @param content 用户消息内容
 * @param attachments 附件列表
 * @param signal AbortController信号
 * @param onProgress 预处理进度回调
 * @returns 预处理后的查询和处理状态
 */
export const preprocessAttachments = async (
  content: string, 
  attachments: FilePreview[], 
  signal: AbortSignal,
  onProgress: (data: any) => void
): Promise<{ 
  finalQuery: string, 
  success: boolean, 
  error?: string,
  fileDescriptions?: Record<string, string>
}> => {
  if (attachments.length === 0) {
    return { finalQuery: content, success: true };
  }

  try {
    // 调用文件预处理接口
    const preProcessReader = await conversationService.preprocessFiles(
      content,
      attachments.map(attachment => attachment.file),
      signal
    );

    if (!preProcessReader) throw new Error("预处理响应为空");

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
            
            // 回调进度信息
            onProgress(jsonData);

            // 如果是文件处理信息，保存文件描述
            if (jsonData.type === "file_processed" && jsonData.filename && jsonData.description) {
              fileDescriptions[jsonData.filename] = jsonData.description;
            }

            // 如果是完成消息，记录最终查询
            if (jsonData.type === "complete") {
              finalQuery = jsonData.final_query;
            }
          } catch (e) {
            console.error("解析预处理数据失败:", e, jsonStr);
          }
        }
      }
    }

    return { finalQuery, success: true, fileDescriptions };
  } catch (error) {
    console.error("文件预处理失败:", error);
    return { 
      finalQuery: content, 
      success: false, 
      error: error instanceof Error ? (error as Error).message : String(error)
    };
  }
};

/**
 * 创建思考中步骤
 * @param message 用于显示的消息
 * @returns 思考中的步骤对象
 */
export const createThinkingStep = (message: string = "正在解析文件..."): AgentStep => {
  return {
    id: `thinking-${Date.now()}`,
    title: "思考中",
    content: message,
    expanded: true,
    thinking: { content: message, expanded: true },
    code: { content: "", expanded: false },
    output: { content: "", expanded: false },
    metrics: "",
    contents: []
  };
};

/**
 * 处理文件上传
 * @param file 上传的文件
 * @param setFileUrls 设置文件URL的回调函数
 * @returns 文件ID
 */
export const handleFileUpload = (
  file: File, 
  setFileUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>
): string => {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  // 如果不是图片类型，创建一个文件预览URL
  if (!file.type.startsWith('image/')) {
    const fileUrl = URL.createObjectURL(file);
    setFileUrls(prev => ({...prev, [fileId]: fileUrl}));
  }
  
  console.log(`上传文件: ${file.name}, 类型: ${file.type}, 大小: ${file.size}`);
  return fileId;
};

/**
 * 处理图片上传
 * @param file 上传的图片文件
 */
export const handleImageUpload = (file: File): void => {
  console.log(`上传图片: ${file.name}, 类型: ${file.type}, 大小: ${file.size}`);
};

/**
 * 上传附件到存储服务
 * @param attachments 附件列表
 * @returns 上传的文件URLs和对象名称
 */
export const uploadAttachments = async (
  attachments: FilePreview[]
): Promise<{
  uploadedFileUrls: Record<string, string>;
  objectNames: Record<string, string>;
  error?: string;
}> => {
  if (attachments.length === 0) {
    return { uploadedFileUrls: {}, objectNames: {} };
  }
  
  try {
    // 上传所有文件到存储服务
    const uploadResult = await storageService.uploadFiles(
      attachments.map(attachment => attachment.file)
    );

    // 处理上传结果
    const uploadedFileUrls: Record<string, string> = {};
    const objectNames: Record<string, string> = {};
    
    if (uploadResult.success_count > 0) {
      uploadResult.results.forEach(result => {
        if (result.success) {
          uploadedFileUrls[result.file_name] = result.url;
          objectNames[result.file_name] = result.object_name;
        }
      });
    }

    return { uploadedFileUrls, objectNames };
  } catch (error) {
    console.error("文件上传失败:", error);
    return { 
      uploadedFileUrls: {},
      objectNames: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * 从附件列表创建消息附件对象
 * @param attachments 附件列表
 * @param uploadedFileUrls 上传后的文件URLs
 * @param fileUrls 文件URL映射
 * @returns 消息附件对象数组
 */
export const createMessageAttachments = (
  attachments: FilePreview[],
  uploadedFileUrls: Record<string, string>,
  fileUrls: Record<string, string>
): { type: string; name: string; size: number; url?: string }[] => {
  return attachments.map(attachment => ({
    type: attachment.type,
    name: attachment.file.name,
    size: attachment.file.size,
    url: uploadedFileUrls[attachment.file.name] ||
         (attachment.type === 'image' ? attachment.previewUrl : fileUrls[attachment.id])
  }));
};

/**
 * 清理附件URL
 * @param attachments 附件列表
 * @param fileUrls 文件URL映射
 */
export const cleanupAttachmentUrls = (
  attachments: FilePreview[],
  fileUrls: Record<string, string>
): void => {
  // 清理附件预览URL
  attachments.forEach(attachment => {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  });
  
  // 清理其他文件URL
  Object.values(fileUrls).forEach(url => {
    URL.revokeObjectURL(url);
  });
}; 