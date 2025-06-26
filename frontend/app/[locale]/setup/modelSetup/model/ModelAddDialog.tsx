import { Modal, Select, Input, Button, message, Switch, Tooltip } from 'antd'
import { InfoCircleFilled, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { ModelType, SingleModelConfig, ModelConnectStatus } from '@/types/config'
import { modelService } from '@/services/modelService'
import { useConfig } from '@/hooks/useConfig'

const { Option } = Select

// Define the return type after adding a model
export interface AddedModel {
  name: string;
  type: ModelType;
}

interface ModelAddDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (model?: AddedModel) => Promise<void>
}

export const ModelAddDialog = ({ isOpen, onClose, onSuccess }: ModelAddDialogProps) => {
  const { updateModelConfig } = useConfig()
  const [form, setForm] = useState({
    type: "llm" as ModelType,
    name: "",
    displayName: "",
    url: "",
    apiKey: "",
    maxTokens: "4096",
    isMultimodal: false,
    vectorDimension: "1024"
  })
  const [loading, setLoading] = useState(false)
  const [verifyingConnectivity, setVerifyingConnectivity] = useState(false)
  const [connectivityStatus, setConnectivityStatus] = useState<{
    status: ModelConnectStatus | null
    message: string
  }>({
    status: null,
    message: ""
  })

  // Parse the model name, extract the default display name
  const parseModelName = (name: string): string => {
    if (!name) return ""
    const parts = name.split('/')
    return parts.length > 1 ? parts[parts.length - 1] : name
  }

  // Handle model name change, automatically update the display name
  const handleModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setForm(prev => ({
      ...prev,
      name,
      // If the display name is the same as the parsed result of the model name, it means the user has not manually modified the display name
      // At this time, the display name should be automatically updated
      displayName: prev.displayName === parseModelName(prev.name) ? parseModelName(name) : prev.displayName
    }))
    // Clear the previous verification status
    setConnectivityStatus({ status: null, message: "" })
  }

  // Handle form change
  const handleFormChange = (field: string, value: string | boolean) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
    // If the key configuration item changes, clear the verification status
    if (['type', 'url', 'apiKey', 'maxTokens', 'vectorDimension'].includes(field)) {
      setConnectivityStatus({ status: null, message: "" })
    }
  }

  // Verify if the vector dimension is valid
  const isValidVectorDimension = (value: string): boolean => {
    const dimension = parseInt(value);
    return !isNaN(dimension) && dimension > 0;
  }

  // Check if the form is valid
  const isFormValid = () => {
    if (form.type === "embedding") {
      return form.name.trim() !== "" && 
             form.url.trim() !== "" && 
             isValidVectorDimension(form.vectorDimension);
    }
    return form.name.trim() !== "" && 
           form.url.trim() !== "" && 
           form.maxTokens.trim() !== ""
  }

  // Verify model connectivity
  const handleVerifyConnectivity = async () => {
    if (!isFormValid()) {
      message.warning('请先填写完整的模型配置信息')
      return
    }

    setVerifyingConnectivity(true)
    setConnectivityStatus({ status: "检测中", message: "正在验证模型连通性..." })

    try {
      const modelType = form.type === "embedding" && form.isMultimodal ? 
        "multi_embedding" as ModelType : 
        form.type;

      const config = {
        modelName: form.name,
        modelType: modelType,
        baseUrl: form.url,
        apiKey: form.apiKey.trim() === "" ? "sk-no-api-key" : form.apiKey,
        maxTokens: form.type === "embedding" ? parseInt(form.vectorDimension) : parseInt(form.maxTokens),
        embeddingDim: form.type === "embedding" ? parseInt(form.vectorDimension) : undefined
      }

      const result = await modelService.verifyModelConfigConnectivity(config)
      
      setConnectivityStatus({
        status: result.connectivity ? "可用" : "不可用",
        message: result.message
      })

      if (result.connectivity) {
        message.success('模型连通性验证成功！')
      } else {
        message.error(`模型连通性验证失败：${result.message}`)
      }
    } catch (error) {
      setConnectivityStatus({
        status: "不可用",
        message: `验证失败: ${error}`
      })
      message.error(`验证连通性失败：${error}`)
    } finally {
      setVerifyingConnectivity(false)
    }
  }

  // Get the connectivity status icon
  const getConnectivityIcon = () => {
    switch (connectivityStatus.status) {
      case "检测中":
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      case "可用":
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case "不可用":
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  // Get the connectivity status color
  const getConnectivityColor = () => {
    switch (connectivityStatus.status) {
      case "检测中":
        return '#1890ff'
      case "可用":
        return '#52c41a'
      case "不可用":
        return '#ff4d4f'
      default:
        return '#d9d9d9'
    }
  }

  // Handle adding a model
  const handleAddModel = async () => {
    setLoading(true)
    try {
      const modelType = form.type === "embedding" && form.isMultimodal ? 
        "multi_embedding" as ModelType : 
        form.type;
      
      // Determine the maximum tokens value
      let maxTokensValue = parseInt(form.maxTokens);
      if (form.type === "embedding") {
        // For embedding models, use the vector dimension as maxTokens
        maxTokensValue = parseInt(form.vectorDimension);
      }
      
      // Add to the backend service
      await modelService.addCustomModel({
        name: form.name,
        type: modelType,
        url: form.url,
        apiKey: form.apiKey.trim() === "" ? "sk-no-api-key" : form.apiKey,
        maxTokens: maxTokensValue,
        displayName: form.displayName || form.name
      })
      
      // Create the model configuration object
      const modelConfig: SingleModelConfig = {
        modelName: form.name,
        displayName: form.displayName || form.name,
        apiConfig: {
          apiKey: form.apiKey,
          modelUrl: form.url,
        }
      }
      
      // Add the dimension field for embedding models
      if (form.type === "embedding") {
        modelConfig.dimension = parseInt(form.vectorDimension);
      }
      
      // Update the local storage according to the model type
      let configUpdate: any = {}
      
      switch(modelType) {
        case "llm":
          configUpdate = { llm: modelConfig }
          break;
        case "embedding":
          configUpdate = { embedding: modelConfig }
          break;
        case "multi_embedding":
          configUpdate = { multiEmbedding: modelConfig }
          break;
        case "vlm":
          configUpdate = { vlm: modelConfig }
          break;
        case "rerank":
          configUpdate = { rerank: modelConfig }
          break;
        case "tts":
          configUpdate = { tts: modelConfig }
          break;
        case "stt":
          configUpdate = { stt: modelConfig }
          break;
      }
      
      // Save to localStorage
      updateModelConfig(configUpdate)
      
      // Create the returned model information
      const addedModel: AddedModel = {
        name: form.displayName,
        type: modelType
      }
      
      // Reset the form
      setForm({
        type: form.type,
        name: "",
        displayName: "",
        url: "",
        apiKey: "",
        maxTokens: "4096",
        isMultimodal: false,
        vectorDimension: "1024"
      })
      
      // Reset the connectivity status
      setConnectivityStatus({ status: null, message: "" })
      
      // Call the success callback, pass the new added model information
      await onSuccess(addedModel)
      
      // Close the dialog
      onClose()
    } catch (error) {
      message.error(`添加模型失败：${error}`)
      console.error('添加模型失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const isEmbeddingModel = form.type === "embedding"

  return (
    <Modal
      title="添加模型"
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <div className="space-y-4">
        {/* Model Type */}
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            模型类型 <span className="text-red-500">*</span>
          </label>
          <Select
            style={{ width: "100%" }}
            value={form.type}
            onChange={(value) => handleFormChange("type", value)}
          >
            <Option value="llm">大语言模型</Option>
            <Option value="embedding">向量化模型</Option>
            <Option value="vlm">视觉语言模型</Option>
            <Option value="rerank" disabled>重排模型</Option>
            <Option value="stt" disabled>语音识别模型</Option>
            <Option value="tts" disabled>语音合成模型</Option>
          </Select>
        </div>

        {/* Whether it is a multi-modal embedding model (only displayed when the embedding model is selected) */}
        {isEmbeddingModel && (
          <div>
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">
                多模态
              </label>
              <Switch 
                checked={form.isMultimodal}
                onChange={(checked) => handleFormChange("isMultimodal", checked)}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {form.isMultimodal ? "多模态向量模型可处理图像和文本" : "文本向量模型仅处理文本"}
            </div>
          </div>
        )}

        {/* Model Name */}
        <div>
          <label htmlFor="name" className="block mb-1 text-sm font-medium text-gray-700">
            模型名称 <span className="text-red-500">*</span>
          </label>
          <Input
            id="name"
            placeholder="请输入请求体中的模型名称"
            value={form.name}
            onChange={handleModelNameChange}
          />
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block mb-1 text-sm font-medium text-gray-700">
            展示名称
          </label>
          <Input
            id="displayName"
            placeholder="请输入模型的展示名称"
            value={form.displayName}
            onChange={(e) => handleFormChange("displayName", e.target.value)}
          />
        </div>

        {/* Model URL */}
        <div>
          <label htmlFor="url" className="block mb-1 text-sm font-medium text-gray-700">
            模型URL <span className="text-red-500">*</span>
          </label>
          <Input
            id="url"
            placeholder="请输入模型URL, 例如: https://api.openai.com/v1"
            value={form.url}
            onChange={(e) => handleFormChange("url", e.target.value)}
          />
        </div>

        {/* API Key */}
        <div>
          <label htmlFor="apiKey" className="block mb-1 text-sm font-medium text-gray-700">
            API Key
          </label>
          <Input.Password
            id="apiKey"
            placeholder="请输入API Key（可选）"
            value={form.apiKey}
            onChange={(e) => handleFormChange("apiKey", e.target.value)}
          />
        </div>

        {/* Vector dimension (only displayed when the embedding model is selected) */}
        {isEmbeddingModel && (
          <div>
            <label htmlFor="vectorDimension" className="block mb-1 text-sm font-medium text-gray-700">
              向量维度 <span className="text-red-500">*</span>
            </label>
            <Input
              id="vectorDimension"
              placeholder="请输入向量维度"
              value={form.vectorDimension}
              onChange={(e) => handleFormChange("vectorDimension", e.target.value)}
              status={!isValidVectorDimension(form.vectorDimension) ? "error" : ""}
            />
            {!isValidVectorDimension(form.vectorDimension) && (
              <div className="text-red-500 text-xs mt-1">请输入大于0的整数</div>
            )}
          </div>
        )}

        {/* Max Tokens (only displayed when the embedding model is not selected)*/}
        {!isEmbeddingModel && (
          <div>
            <label htmlFor="maxTokens" className="block mb-1 text-sm font-medium text-gray-700">
              最大Token数
            </label>
            <Input
              id="maxTokens"
              placeholder="请输入最大Token数"
              value={form.maxTokens}
              onChange={(e) => handleFormChange("maxTokens", e.target.value)}
            />
          </div>
        )}

        {/* Connectivity verification area */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700">连通性验证</span>
              {connectivityStatus.status && (
                <div className="ml-2 flex items-center">
                  {getConnectivityIcon()}
                  <span 
                    className="ml-1 text-xs"
                    style={{ color: getConnectivityColor() }}
                  >
                    {connectivityStatus.status}
                  </span>
                </div>
              )}
            </div>
            <Button
              size="small"
              type="default"
              onClick={handleVerifyConnectivity}
              loading={verifyingConnectivity}
              disabled={!isFormValid() || verifyingConnectivity}
            >
              {verifyingConnectivity ? '验证中...' : '点击验证'}
            </Button>
          </div>
          {connectivityStatus.message && (
            <div className="text-xs text-gray-600">
              {connectivityStatus.message}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-700">
          <div>
            <div className="flex items-center mb-1">
              <InfoCircleFilled className="text-md text-blue-500 mr-3" />
              <p className="font-bold text-medium">模型配置说明</p>
            </div>
            <p className="mt-0.5 ml-6">
              请填写模型的基本信息，API Key、展示名称为可选项，其他字段为必填项。建议先验证连通性后再添加模型。
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end space-x-3">
          <Button onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleAddModel}
            disabled={!isFormValid()}
            loading={loading}
          >
            添加
          </Button>
        </div>
      </div>
    </Modal>
  )
} 