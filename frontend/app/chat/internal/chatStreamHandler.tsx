// 处理聊天流式响应的工具函数

import { ChatMessageType, AgentStep } from '@/types/chat';
 import {
   deduplicateImages,
   deduplicateSearchResults
 } from './chatHelpers';

interface JsonData {
  type: string;
  content: any;
}

// 处理流式响应数据
export const handleStreamResponse = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>,
  resetTimeout: () => void,
  stepIdCounter: React.MutableRefObject<number>,
  setIsSwitchedConversation: React.Dispatch<React.SetStateAction<boolean>>,
  isNewConversation: boolean,
  setConversationTitle: (title: string) => void,
  fetchConversationList: () => Promise<any>,
  currentConversationId: number,
  conversationService: any
) => {
  const decoder = new TextDecoder();
  let buffer = "";

  // 用于累积不同类型的内容

  // 创建空的步骤对象
  let currentStep: AgentStep = {
    id: ``,
    title: "",
    content: "",
    expanded: true,
    contents: [],
    metrics: "",
    thinking: { content: "", expanded: true },
    code: { content: "", expanded: true },
    output: { content: "", expanded: true }
  };

  let currentContentId = "";
  let lastContentType: "model_output" | "parsing" | "execution" | "agent_run" | "generating_code" | null = null;
  let currentContentText = "";
  let lastModelOutputIndex = -1;  // 跟踪currentStep.contents最后一个模型输出的索引
  let searchResultsContent: any[] = [];
  let allSearchResults: any[] = [];
  let finalAnswer = "";


  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data:")) {
          resetTimeout(); // 每次收到新数据时重置超时计时器
          const jsonStr = line.substring(5).trim();

          try {
            // 解析每一次收到的JSON数据
            const jsonData: JsonData = JSON.parse(jsonStr);

            if (jsonData.type && jsonData.content) {
              const messageType = jsonData.type;
              const messageContent = jsonData.content;

              // 删除临时的"正在执行代码..."内容
              if (messageType !== "model_output_code") {
                currentStep.contents = currentStep.contents.filter(content => 
                  !(content.isLoading || content.type === "executing" || content.type === "generating_code")
                );
              }

              // 处理不同类型的消息
              switch (messageType) {
                case "step_count":
                  // 为每个新步骤增加计数器
                  stepIdCounter.current += 1;

                  // 创建新步骤 - 使用计数器和UUID组合生成唯一ID
                  currentStep = {
                    id: `step-${stepIdCounter.current}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    title: messageContent.trim(),
                    content: "",
                    expanded: true,
                    contents: [], // 使用数组按顺序存储所有内容
                    metrics: "",
                    thinking: { content: "", expanded: true },
                    code: { content: "", expanded: true },
                    output: { content: "", expanded: true }
                  };

                  // 重置状态追踪变量
                  currentContentId = "";
                  currentContentText = "";
                  lastContentType = null;
                  lastModelOutputIndex = -1;
                  
                  break;
                  
                case "token_count":
                  // 处理token计数逻辑
                  currentStep.metrics = messageContent;
                  break;
                  
                case "model_output_thinking":
                  // 处理思考内容
                  if (currentStep) {
                    // 确保 contents 存在
                    currentContentText = messageContent;

                    // 如果上一个流式输出是thinking内容，则追加
                    if (lastContentType === "model_output" && lastModelOutputIndex >= 0) {
                      const modelOutput = currentStep.contents[lastModelOutputIndex];
                      // 更新内容
                      modelOutput.content += messageContent;
                    } else {
                      // 否则创建新的thinking内容
                      currentStep.contents.push({
                        id: `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        type: "model_output",
                        subType: "thinking",
                        content: currentContentText,
                        expanded: true,
                        timestamp: Date.now()
                      });
                      lastModelOutputIndex = currentStep.contents.length - 1;
                    }
                    
                    // 更新最后处理的内容类型
                    lastContentType = "model_output";
                  }
                  break;
                  
                case "search_content":
                  try {
                    // 解析搜索结果内容
                    const searchResults = JSON.parse(messageContent);
                    if (Array.isArray(searchResults)) {
                      // 修改映射以符合组件级的SearchResult类型
                      const newSearchResults = searchResults.map(item => ({
                        title: item.title || "未知标题",
                        url: item.url || "#",
                        text: item.text || "无内容描述",
                        published_date: item.published_date || "",
                        tool_sign: item.tool_sign || "",
                        cite_index: typeof item.cite_index === 'number' ? item.cite_index : -1
                      }));

                      // 累加搜索结果
                      searchResultsContent = [...searchResultsContent, ...newSearchResults];
                      allSearchResults = [...allSearchResults, ...newSearchResults];
                    }
                    
                    // 更新当前消息的搜索结果
                    setMessages((prev) => {
                      const recordMessages = [...prev];
                      const lastMsg = recordMessages[recordMessages.length - 1];

                      if (!lastMsg.searchResults) {
                        lastMsg.searchResults = [];
                      }

                      // 使用公共去重函数处理搜索结果
                      if (searchResultsContent && searchResultsContent.length > 0) {
                        lastMsg.searchResults = deduplicateSearchResults(
                          lastMsg.searchResults,
                          searchResultsContent
                        );
                      }

                      return recordMessages;
                    });
                  } catch(e) {
                    console.error("解析搜索内容失败:", e);
                  }
                  break;
                  
                case "picture_web":
                  try {
                    // 解析图片数据结构
                    let imageUrls = JSON.parse(messageContent).images_url;

                    if (imageUrls.length > 0) {
                      // 更新当前消息的图片
                      setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];

                        // 如果没有图片数组，则初始化
                        if (!lastMsg.images) {
                          lastMsg.images = [];
                        }

                        // 使用公共去重函数处理图片
                        lastMsg.images = deduplicateImages(
                          lastMsg.images,
                          imageUrls
                        );


                        return newMessages;
                      });
                    }
                  } catch (error) {
                    console.error("处理图片数据失败:", error);
                  }
                  break;
                  
                case "final_answer":
                  // 累加最终答案内容
                  finalAnswer += messageContent;
                  break;
                  
                case "model_output_code":
                  // 处理代码生成 - 添加一个稳定的加载提示
                  // 检查是否存在代码生成提示
                  if (lastContentType === "generating_code") {
                    break;
                  }
                  
                  // 如果不存在，则添加一个
                  const newGeneratingItem = {
                    id: `generating-code-${stepIdCounter.current}`,
                    type: "generating_code" as const,
                    content: "代码生成中...",
                    expanded: true,
                    timestamp: Date.now(),
                    isLoading: true,
                  };
                  
                  currentStep.contents.push(newGeneratingItem);
                  
                  // 标记为代码生成类型
                  lastContentType = "generating_code";
                  break;
                  
                case "parse":
                  // 只有当上一个类型不是executing时，才创建新的执行提示
                  // 这样可以保持动画效果的连续性
                  if (lastContentType === "execution") {
                    break;
                  }

                  // 添加正在执行代码的临时内容
                  currentStep.contents.push({
                    id: `executing-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    type: "executing",
                    content: "正在执行代码...",
                    expanded: true,
                    timestamp: Date.now(),
                    isLoading: true
                  });

                  // 保存原始解析内容，但不在前端显示
                  currentStep.parsingContent = messageContent;

                  // 更新最后处理的内容类型
                  lastContentType = "execution";
                  break;
                
                case "execution_logs":
                  // 添加新的内容到数组
                  currentStep.contents.push({
                    id: `execution-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    type: "execution",
                    content: messageContent,
                    expanded: true,
                    timestamp: Date.now()
                  });
                  // 更新最后处理的内容类型
                  lastContentType = "execution";
                  break;
                  
                case "agent_new_run":
                  // 当前不做处理

                  // 更新最后处理的内容类型
                  lastContentType = "agent_run";
                  break;
                  
                case "error":
                  // 添加错误内容到当前步骤的contents数组
                  currentStep.contents.push({
                    id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    type: "error",
                    content: messageContent,
                    expanded: true,
                    timestamp: Date.now()
                  });
                  break;

                default:
                  // 处理其他类型的消息
                  break;
              }

              // 更新消息内容，实时前端显示
              setMessages((prev) => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];

                if (lastMsg && lastMsg.role === "assistant") {
                  // 更新当前步骤
                  if (currentStep) {
                    if (!lastMsg.steps) lastMsg.steps = [];

                    // 查找并更新现有步骤
                    const stepIndex = lastMsg.steps.findIndex(s => s.id === currentStep?.id);
                    if (stepIndex >= 0) {
                      lastMsg.steps[stepIndex] = JSON.parse(JSON.stringify(currentStep)); // 深拷贝确保状态更新
                    } else {
                      // 只有在有内容时才添加新步骤
                      if (currentStep.contents && currentStep.contents.length > 0) {
                        lastMsg.steps.push(JSON.parse(JSON.stringify(currentStep)));
                      }
                    }
                  }

                  // 更新其他特殊内容
                  if (finalAnswer) lastMsg.finalAnswer = finalAnswer;
                }

                return newMessages;
              });
            }
          } catch (parseError) {
            console.warn("SSE 数据解析失败:", parseError);
          }
        }
      }
    }

    // 处理buffer中的最后一行
    if (buffer.trim() && buffer.startsWith("data:")) {
      // 处理最后一行的数据...
      resetTimeout(); // 最后一行数据也重置超时计时器
      try {
        const jsonStr = buffer.substring(5).trim();
        const jsonData: JsonData = JSON.parse(jsonStr);

        if (jsonData.type && jsonData.content) {
          const messageType = jsonData.type;
          const messageContent = jsonData.content;

          // 处理最后一条消息，重点关注final_answer
          if (messageType === "final_answer") {
            finalAnswer += messageContent;
          }
        }
      } catch (error) {
        console.error("处理剩余数据失败:", error);
      }
    }

    // 标记消息完成，并再次检查所有步骤以防止重复
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMsg = newMessages[newMessages.length - 1];

      if (lastMsg && lastMsg.role === "assistant") {
        lastMsg.isComplete = true;

        // 检查并移除重复的步骤
        if (lastMsg.steps && lastMsg.steps.length > 0) {
          const uniqueSteps = [];
          const seenTitles = new Set();

          for (const step of lastMsg.steps) {
            // 如果是空步骤或者已经有相同标题的步骤，跳过它
            if (
              !step.contents ||
              step.contents.length === 0 ||
              seenTitles.has(step.title.trim())
            ) {
              console.log("跳过重复或空步骤:", step.title);
              continue;
            }

            seenTitles.add(step.title.trim());
            uniqueSteps.push(step);
          }

          // 更新为去重后的步骤列表
          lastMsg.steps = uniqueSteps;
        }

        // 如果是新对话的第一次回答完成，生成标题
        if (isNewConversation && newMessages.length === 2) {
          // 使用setTimeout确保状态已更新
          setTimeout(async () => {
            try {
              // 准备对话历史
              const history = newMessages.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.role === 'assistant' ? (msg.finalAnswer || msg.content || '') : msg.content
              }));

              // 调用生成标题接口
              const title = await conversationService.generateTitle({
                conversation_id: currentConversationId,
                history
              });
              // 更新对话上方标题
              if (title) {
                setConversationTitle(title);
              }
              // 更新列表
              await fetchConversationList();
            } catch (error) {
              console.error("生成标题失败:", error);
            }
          }, 0);
        }
      }

      return newMessages;
    });

    // 重置对话切换状态
    setIsSwitchedConversation(false);
    
  } catch (error) {
    console.error("处理流式响应时出错:", error);
    throw error; // 将错误传回原函数进行处理
  }
  
  return { finalAnswer };
}; 