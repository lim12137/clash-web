import {Button, Card, Col, message, Row, Space} from 'antd'
import {
  DeleteOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SyncOutlined
} from '@ant-design/icons'
import {forwardRef, useEffect, useImperativeHandle, useState, useRef, ReactNode} from 'react'
import {ModelConnectStatus, ModelOption, ModelType} from '@/types/config'
import {useConfig} from '@/hooks/useConfig'
import {modelService} from '@/services/modelService'
import {ModelListCard} from './ModelListCard'
import {ModelAddDialog} from './ModelAddDialog'
import {ModelDeleteDialog} from './ModelDeleteDialog'

// 布局高度常量配置
const LAYOUT_CONFIG = {
  CARD_HEADER_PADDING: "10px 24px",
  CARD_BODY_PADDING: "16px 20px",
  MODEL_TITLE_MARGIN_LEFT: "0px",
}

// 定义每个卡片的主题色
const cardThemes = {
  llm: {
    borderColor: "#e6e6e6",
    backgroundColor: "#ffffff",
  },
  embedding: {
    borderColor: "#e6e6e6",
    backgroundColor: "#ffffff",
  },
  reranker: {
    borderColor: "#e6e6e6",
    backgroundColor: "#ffffff",
  },
  voice: {
    borderColor: "#e6e6e6",
    backgroundColor: "#ffffff",
  },
}

// 模型数据结构
const modelData = {
  llm: {
    title: "大语言模型",
    options: [
      { id: "main", name: "主模型" },
      { id: "secondary", name: "副模型" },
    ],
  },
  embedding: {
    title: "Embedding模型",
    options: [
      { id: "embedding", name: "向量模型" },
    ],
  },
  reranker: {
    title: "Reranker模型",
    options: [
      { id: "reranker", name: "重排模型" },
    ],
  },
  voice: {
    title: "语音模型",
    options: [
      { id: "tts", name: "TTS模型" },
      { id: "stt", name: "STT模型" },
    ],
  },
}

// 定义组件对外暴露的方法类型
export interface ModelConfigSectionRef {
  verifyModels: () => Promise<void>;
}

interface ModelConfigSectionProps {
  skipVerification?: boolean;
}

export const ModelConfigSection = forwardRef<ModelConfigSectionRef, ModelConfigSectionProps>((props, ref): ReactNode => {
  const { skipVerification = false } = props;
  const { modelConfig, updateModelConfig } = useConfig()

  // 状态管理
  const [officialModels, setOfficialModels] = useState<ModelOption[]>([])
  const [customModels, setCustomModels] = useState<ModelOption[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  
  // 错误状态管理
  const [errorFields, setErrorFields] = useState<{[key: string]: boolean}>({
    'llm.main': false,
    'embedding.embedding': false
  })
  
  // 用于取消API请求的控制器
  const abortControllerRef = useRef<AbortController | null>(null);
  // 节流计时器
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 模型选择状态
  const [selectedModels, setSelectedModels] = useState<Record<string, Record<string, string>>>({
    llm: { main: "", secondary: "" },
    embedding: { embedding: "" },
    reranker: { reranker: "" },
    voice: { tts: "", stt: "" },
  })

  // 初始化加载
  useEffect(() => {
    // 在组件加载时获取模型列表
    const fetchData = async () => {
      // 加载模型列表 - 这将包含状态信息
      await loadModelLists(skipVerification);
      
      // 不需要额外调用fetchModelStatus，初始模型数据已经包含连接状态
    };
    
    fetchData();
  }, [skipVerification])
  
  // 监听字段错误高亮事件
  useEffect(() => {
    const handleHighlightMissingField = (event: any) => {
      const { field } = event.detail;
      
      if (field === 'llm.main' || field === 'embedding.embedding') {
        setErrorFields(prev => ({
          ...prev,
          [field]: true
        }));
        
        // 找到对应的卡片并滚动到视图
        setTimeout(() => {
          const fieldParts = field.split('.');
          const cardType = fieldParts[0];
          const cardId = fieldParts[1];
          
          const selector = cardType === 'embedding' 
            ? '.model-card:nth-child(2)' // Embedding卡片通常是第二个
            : '.model-card:nth-child(1)'; // LLM卡片通常是第一个
            
          const card = document.querySelector(selector);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    };
    
    window.addEventListener('highlightMissingField', handleHighlightMissingField);
    return () => {
      window.removeEventListener('highlightMissingField', handleHighlightMissingField);
    };
  }, []);
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    verifyModels
  }));

  // 安全地更新特定自定义模型的连接状态
  const updateCustomModelStatus = (modelName: string, modelType: string, status: ModelConnectStatus) => {
    // 更新本地状态
    setCustomModels(prev => {
      const idx = prev.findIndex(model => model.name === modelName && model.type === modelType);
      if (idx === -1) return prev;
      
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        connect_status: status
      };
      return updated;
    });
    
    // 同时同步到后端数据库
    modelService.updateModelStatus(modelName, status)
      .then(success => {
        if (!success) {
          console.error(`更新模型 ${modelName} 状态到数据库失败`);
        } else {
          // 状态成功更新到数据库后，主动触发全局模型状态更新
          setTimeout(() => {
            // 直接从后端获取最新数据更新模型卡片
            modelService.getCustomModels().then(models => {
              if (models && models.length > 0) {
                // 确保在此处获取的模型列表中包含最新的状态
                // 更新本地状态
                setCustomModels(models);
              }
            }).catch(err => {
              console.error("获取最新模型状态失败:", err);
            });
          }, 500);  // 延迟500ms，确保后端数据已更新
        }
      })
      .catch(error => {
        console.error(`同步模型 ${modelName} 状态到数据库出错:`, error);
      });
  }
  
  // 取消正在进行的验证
  const cancelVerification = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    
    setIsVerifying(false);
    message.info({ content: "已取消验证", key: "verifying" });
  };

  // 加载模型列表
  const loadModelLists = async (skipVerify: boolean = false) => {
    try {
      // 使用Promise.all并行加载官方模型和自定义模型
      const [official, custom] = await Promise.all([
        modelService.getOfficialModels(),
        modelService.getCustomModels()
      ])
      
      // 确保所有官方模型状态为"可用"
      const officialWithStatus = official.map(model => ({
        ...model,
        connect_status: "可用" as ModelConnectStatus
      }));
      
      // 更新状态
      setOfficialModels(officialWithStatus)
      setCustomModels(custom)

      // 合并所有可用模型列表（官方和自定义）
      const allModels = [...officialWithStatus, ...custom]
      
      // 从配置中加载选中的模型，并检查模型是否仍然存在
      const llmMain = modelConfig.llm.modelName
      const llmMainExists = llmMain ? allModels.some(m => m.name === llmMain && m.type === 'llm') : true
      
      const llmSecondary = modelConfig.llmSecondary.modelName
      const llmSecondaryExists = llmSecondary ? allModels.some(m => m.name === llmSecondary && m.type === 'llm') : true
      
      const embedding = modelConfig.embedding.modelName
      const embeddingExists = embedding ? allModels.some(m => m.name === embedding && m.type === 'embedding') : true
      
      const rerank = modelConfig.rerank.modelName
      const rerankExists = rerank ? allModels.some(m => m.name === rerank && m.type === 'rerank') : true
      
      const stt = modelConfig.stt.modelName
      const sttExists = stt ? allModels.some(m => m.name === stt && m.type === 'stt') : true
      
      const tts = modelConfig.tts.modelName
      const ttsExists = tts ? allModels.some(m => m.name === tts && m.type === 'tts') : true
      
      // 创建更新后的选中模型对象
      const updatedSelectedModels = {
        llm: { 
          main: llmMainExists ? llmMain : "", 
          secondary: llmSecondaryExists ? llmSecondary : "" 
        },
        embedding: { 
          embedding: embeddingExists ? embedding : "" 
        },
        reranker: { 
          reranker: rerankExists ? rerank : "" 
        },
        voice: { 
          tts: ttsExists ? tts : "", 
          stt: sttExists ? stt : "" 
        },
      };
      
      // 更新状态
      setSelectedModels(updatedSelectedModels)
      
      // 如果有模型被删除，同步更新本地存储的配置
      const configUpdates: any = {}
      
      if (!llmMainExists && llmMain) {
        configUpdates.llm = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (!llmSecondaryExists && llmSecondary) {
        configUpdates.llmSecondary = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (!embeddingExists && embedding) {
        configUpdates.embedding = { modelName: "", displayName: "", apiConfig: { apiKey: "", modelUrl: "" } }
      }
      
      if (!rerankExists && rerank) {
        configUpdates.rerank = { modelName: "", displayName: "" }
      }
      
      if (!sttExists && stt) {
        configUpdates.stt = { modelName: "", displayName: "" }
      }
      
      if (!ttsExists && tts) {
        configUpdates.tts = { modelName: "", displayName: "" }
      }
      
      // 如果有配置需要更新，则更新localStorage
      if (Object.keys(configUpdates).length > 0) {
        updateModelConfig(configUpdates)
      }
      
      // 检查是否有已配置的模型需要验证连通性
      const hasConfiguredModels = 
        !!modelConfig.llm.modelName || 
        !!modelConfig.llmSecondary.modelName || 
        !!modelConfig.embedding.modelName || 
        !!modelConfig.rerank.modelName || 
        !!modelConfig.tts.modelName || 
        !!modelConfig.stt.modelName;
      
      // 直接在这里进行验证，而不是使用setTimeout
      // 这样确保我们使用的是当前函数作用域中的模型数据，而不是依赖状态更新
      if (officialWithStatus.length > 0 || custom.length > 0) {
        if (hasConfiguredModels && !skipVerify) {
          // 调用内部验证函数，传入模型数据和最新的选中模型信息
          verifyModelsInternal(officialWithStatus, custom, updatedSelectedModels);
        }
      }
    } catch (error) {
      console.error('加载模型列表失败:', error)
      message.error('加载模型列表失败')
    }
  }
  
  // 内部验证函数，接收模型数据作为参数，不依赖状态
  const verifyModelsInternal = async (
    officialData: ModelOption[], 
    customData: ModelOption[],
    modelsToCheck?: Record<string, Record<string, string>> // 可选参数，允许传入最新的选中模型
  ) => {
    // 如果已经在验证中，则不重复执行
    if (isVerifying) {
      return;
    }
    
    // 确保模型数据已经加载
    if (officialData.length === 0 && customData.length === 0) {
      return;
    }
    
    // 使用传入的模型选择数据或当前状态
    const currentSelectedModels = modelsToCheck || selectedModels;
    
    // 检查是否有选中的模型需要验证
    let hasSelectedModels = false;
    for (const category in currentSelectedModels) {
      for (const optionId in currentSelectedModels[category]) {
        if (currentSelectedModels[category][optionId]) {
          hasSelectedModels = true;
          break;
        }
      }
      if (hasSelectedModels) break;
    }
    
    // 如果状态中没有选中的模型，则尝试从配置中直接获取
    if (!hasSelectedModels) {
      // 直接检查配置中每个模型是否存在
      const hasLlmMain = !!modelConfig.llm.modelName;
      const hasLlmSecondary = !!modelConfig.llmSecondary.modelName;
      const hasEmbedding = !!modelConfig.embedding.modelName;
      const hasReranker = !!modelConfig.rerank.modelName;
      const hasTts = !!modelConfig.tts.modelName;
      const hasStt = !!modelConfig.stt.modelName;
      
      hasSelectedModels = hasLlmMain || hasLlmSecondary || hasEmbedding || hasReranker || hasTts || hasStt;
      
      if (hasSelectedModels) {
        // 使用配置中的模型覆盖当前选中模型
        currentSelectedModels.llm.main = modelConfig.llm.modelName;
        currentSelectedModels.llm.secondary = modelConfig.llmSecondary.modelName;
        currentSelectedModels.embedding.embedding = modelConfig.embedding.modelName;
        currentSelectedModels.reranker.reranker = modelConfig.rerank.modelName;
        currentSelectedModels.voice.tts = modelConfig.tts.modelName;
        currentSelectedModels.voice.stt = modelConfig.stt.modelName;
      } else {
        return;
      }
    }
    
    setIsVerifying(true)

    // 准备一个新的AbortController
    const abortController = new AbortController();
    const signal = abortController.signal;
    
    // 保存引用以便可以取消
    abortControllerRef.current = abortController;

    try {
      // 准备需要验证的模型列表
      const modelsToVerify: Array<{
        category: string,
        optionId: string,
        modelName: string,
        modelType: ModelType,
        isOfficialModel: boolean
      }> = [];

      // 收集所有需要验证的模型，使用传入的选中模型数据
      for (const [category, options] of Object.entries(currentSelectedModels)) {
        for (const [optionId, modelName] of Object.entries(options)) {
          if (!modelName) continue;

          let modelType = category as ModelType;
          if (category === "voice") {
            modelType = optionId === "tts" ? "tts" : "stt";
          } else if (category === "reranker") {
            modelType = "rerank";
          }

          // 查找模型在officialData或customData中
          const isOfficialModel = officialData.some(model => model.name === modelName && model.type === modelType);

          // 将模型添加到待验证列表
          modelsToVerify.push({
            category,
            optionId,
            modelName,
            modelType,
            isOfficialModel
          });

          // 只更新自定义模型状态为"检测中"，官方模型始终为"可用"
          if (!isOfficialModel) {
            updateCustomModelStatus(modelName, modelType, "检测中");
          }
        }
      }
      
      // 如果没有模型需要验证，显示提示并返回
      if (modelsToVerify.length === 0) {
        message.info({ content: "没有需要验证的模型", key: "verifying" });
        setIsVerifying(false);
        abortControllerRef.current = null;
        return;
      }
      
      // 并行验证所有模型
      await Promise.all(
        modelsToVerify.map(async ({ modelName, modelType, isOfficialModel }) => {
          // 根据模型来源调用不同的验证方式
          let isConnected = false;
          
          if (isOfficialModel) {
            // 官方模型，始终视为"可用"
            isConnected = true;
          } else {
            // 自定义模型，使用modelService验证
            try {
              isConnected = await modelService.verifyCustomModel(modelName, signal);
              
              // 更新模型状态
              updateCustomModelStatus(modelName, modelType, isConnected ? "可用" : "不可用");
            } catch (error: any) {
              // 检查是否是因为请求被取消
              if (error.name === 'AbortError') {
                return;
              }
              
              console.error(`校验自定义模型 ${modelName} 失败:`, error);
              updateCustomModelStatus(modelName, modelType, "不可用");
            }
          }
        })
      );

    } catch (error: any) {
      // 检查是否是因为请求被取消
      if (error.name === 'AbortError') {
        console.log('校验被用户取消');
        return;
      }
      
      console.error("模型校验失败:", error);
    } finally {
      if (!signal.aborted) {
        setIsVerifying(false);
        abortControllerRef.current = null;
      }
    }
  }
  
  // 验证所有选中的模型
  const verifyModels = async () => {
    // 如果已经在验证中，则不重复执行
    if (isVerifying) {
      return;
    }
    
    // 确保模型数据已经加载
    if (officialModels.length === 0 && customModels.length === 0) {
      // 模型数据尚未加载，跳过验证
      return;
    }
    
    // 调用内部验证函数
    await verifyModelsInternal(officialModels, customModels, selectedModels);
  }

  // 同步模型列表
  const handleSyncModels = async () => {
    setIsSyncing(true)
    try {
      await modelService.syncModels()
      await loadModelLists()
      message.success('模型同步成功')
    } catch (error) {
      console.error('同步模型失败:', error)
      message.error('同步模型失败')
    } finally {
      setIsSyncing(false)
    }
  }

  // 验证单个模型连接状态 (添加节流逻辑)
  const verifyOneModel = async (modelName: string, modelType: ModelType) => {
    // 如果是空模型名，直接返回
    if (!modelName) return;
    
    // 查找模型在officialModels或customModels中
    const isOfficialModel = officialModels.some(model => model.name === modelName && model.type === modelType);
    
    // 官方模型始终视为"可用"
    if (isOfficialModel) return;
    
    // 如果正在节流中，清除之前的定时器
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
    }
    
    // 使用节流，延迟500ms再执行验证，避免频繁切换模型时重复验证
    throttleTimerRef.current = setTimeout(async () => {
      // 更新自定义模型状态为"检测中"
      updateCustomModelStatus(modelName, modelType, "检测中");
      
      try {
        // 使用modelService验证自定义模型
        const isConnected = await modelService.verifyCustomModel(modelName);
        
        // 更新模型状态
        updateCustomModelStatus(modelName, modelType, isConnected ? "可用" : "不可用");
      } catch (error: any) {
        console.error(`校验自定义模型 ${modelName} 失败:`, error);
        updateCustomModelStatus(modelName, modelType, "不可用");
      } finally {
        throttleTimerRef.current = null;
      }
    }, 500);
  }

  // 处理模型变更
  const handleModelChange = async (category: string, option: string, value: string) => {
    // 更新选中的模型
    setSelectedModels(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [option]: value,
      }
    }))
    
    // 如果有值，清除错误状态
    if (value) {
      setErrorFields(prev => ({
        ...prev,
        [`${category}.${option}`]: false
      }));
    }

    // 查找模型完整信息以获取API配置
    let modelType = category as ModelType;
    if (category === 'voice') {
      modelType = option === 'tts' ? 'tts' : 'stt';
    } else if (category === 'reranker') {
      modelType = 'rerank';
    }

    const modelInfo = [...officialModels, ...customModels].find(
      m => m.name === value && m.type === modelType
    );

    // 新选择的模型如果是自定义模型，且之前没有设置状态，则设置为"未检测"
    if (modelInfo && modelInfo.source === "custom" && !modelInfo.connect_status) {
      updateCustomModelStatus(value, modelType, "未检测");
    }
    
    // 使用模型的显示名称，如果有的话，否则使用模型名称
    const displayName = modelInfo?.displayName || value;

    // 更新配置
    let configUpdate: any = {}
    if (category === "voice") {
      configUpdate[option] = { 
        modelName: value,
        displayName: displayName,
        apiConfig: modelInfo?.apiKey ? {
          apiKey: modelInfo.apiKey,
          modelUrl: modelInfo.apiUrl || '',
        } : undefined
      }
    } else if (category === "reranker") {
      configUpdate.rerank = { 
        modelName: value,
        displayName: displayName,
        apiConfig: modelInfo?.apiKey ? {
          apiKey: modelInfo.apiKey,
          modelUrl: modelInfo.apiUrl || '',
        } : undefined
      }
    } else if (category === "llm") {
      if (option === "main") {
        configUpdate.llm = { 
          modelName: value,
          displayName: displayName,
          apiConfig: modelInfo?.apiKey ? {
            apiKey: modelInfo.apiKey,
            modelUrl: modelInfo.apiUrl || '',
          } : undefined
        }
      } else if (option === "secondary") {
        configUpdate.llmSecondary = {
          modelName: value,
          displayName: displayName,
          apiConfig: modelInfo?.apiKey ? {
            apiKey: modelInfo.apiKey,
            modelUrl: modelInfo.apiUrl || '',
          } : undefined
        }
      }
    } else {
      configUpdate[category] = { 
        modelName: value,
        displayName: displayName,
        apiConfig: modelInfo?.apiKey ? {
          apiKey: modelInfo.apiKey,
          modelUrl: modelInfo.apiUrl || '',
        } : undefined
      }
    }

    // 模型配置更新
    updateModelConfig(configUpdate)
    
    // 当选择新模型时，自动验证该模型连通性
    if (value) {
      await verifyOneModel(value, modelType);
    }
  }

  return (
    <>
      <div style={{ width: "100%", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16, paddingRight: 12, marginLeft: "4px" }}>
          <Space size={8}>
            <Button
              type="primary"
              size="middle"
              onClick={handleSyncModels}
            >
              <SyncOutlined spin={isSyncing} />
              同步ModelEngine模型
            </Button>
            <Button 
              type="primary" 
              size="middle"
              icon={<PlusOutlined />} 
              onClick={() => setIsAddModalOpen(true)}
            >
              添加自定义模型
            </Button>
            <Button 
              type="primary" 
              size="middle"
              icon={<DeleteOutlined />} 
              onClick={() => setIsDeleteModalOpen(true)}
            >
              删除自定义模型
            </Button>
            <Button 
              type="primary" 
              size="middle"
              icon={<SafetyCertificateOutlined />} 
              onClick={verifyModels}
              loading={isVerifying}
            >
              检查模型连通性
            </Button>
          </Space>
        </div>

        <div style={{ width: "100%", padding: "0 4px" }}>
          <Row gutter={[12, 12]}>
            {Object.entries(modelData).map(([key, category]) => (
              <Col xs={24} md={12} lg={12} key={key}>
                <Card
                  title={
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      margin: "-12px -24px", 
                      padding: LAYOUT_CONFIG.CARD_HEADER_PADDING,
                      paddingBottom: "12px",
                      backgroundColor: cardThemes[key as keyof typeof cardThemes].backgroundColor,
                      borderBottom: `1px solid ${cardThemes[key as keyof typeof cardThemes].borderColor}` 
                    }}>
                      <h5 style={{ margin: 0, marginLeft: LAYOUT_CONFIG.MODEL_TITLE_MARGIN_LEFT }}>
                        {category.title}
                      </h5>
                    </div>
                  }
                  variant="outlined"
                  className="model-card"
                  styles={{
                    body: { padding: LAYOUT_CONFIG.CARD_BODY_PADDING }
                  }}
                  style={{
                    height: "100%",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <Space direction="vertical" style={{ width: "100%" }} size={12}>
                    {category.options.map((option) => (
                      <ModelListCard
                        key={option.id}
                        type={key === "voice" ? (option.id === "tts" ? "tts" : "stt") : key as ModelType}
                        modelId={option.id}
                        modelName={option.name}
                        selectedModel={selectedModels[key]?.[option.id] || ""}
                        onModelChange={(value) => handleModelChange(key, option.id, value)}
                        officialModels={officialModels}
                        customModels={customModels}
                        onVerifyModel={verifyOneModel}
                        errorFields={errorFields}
                      />
                    ))}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        <ModelAddDialog
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={async (newModel) => {
            await loadModelLists();
            message.success('添加模型成功');
          }}
        />

        <ModelDeleteDialog
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={async () => {
            await loadModelLists();
            return;
          }}
          customModels={customModels}
        />
      </div>
    </>
  )
}) 