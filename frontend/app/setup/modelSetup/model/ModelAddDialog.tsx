import { Modal, Select, Input, Button, message, Switch, Tooltip } from 'antd'
import { InfoCircleFilled, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { ModelType, SingleModelConfig, ModelConnectStatus } from '@/types/config'
import { modelService } from '@/services/modelService'
import { useConfig } from '@/hooks/useConfig'

const { Option } = Select

// 定义添加模型后的返回类型
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

  // 解析模型名称，提取默认展示名称
  const parseModelName = (name: string): string => {
    if (!name) return ""
    const parts = name.split('/')
    return parts.length > 1 ? parts[parts.length - 1] : name
  }

  // 处理模型名称变更，自动更新展示名称
  const handleModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setForm(prev => ({
      ...prev,
      name,
      // 如果展示名称与模型名称的解析结果相同，说明用户没有手动修改过展示名称
      // 此时应该自动更新展示名称
      displayName: prev.displayName === parseModelName(prev.name) ? parseModelName(name) : prev.displayName
    }))
    // 清除之前的验证状态
    setConnectivityStatus({ status: null, message: "" })
  }

  // 处理表单变更
  const handleFormChange = (field: string, value: string | boolean) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
    // 如果是关键配置项变更，清除验证状态
    if (['type', 'url', 'apiKey', 'maxTokens', 'vectorDimension'].includes(field)) {
      setConnectivityStatus({ status: null, message: "" })
    }
  }

  // 验证向量维度是否有效
  const isValidVectorDimension = (value: string): boolean => {
    const dimension = parseInt(value);
    return !isNaN(dimension) && dimension > 0;
  }

  // 检查表单是否有效
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

  // 验证模型连通性
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

  // 获取连通性状态图标
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

  // 获取连通性状态颜色
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

  // 处理添加模型
  const handleAddModel = async () => {
    setLoading(true)
    try {
      const modelType = form.type === "embedding" && form.isMultimodal ? 
        "multi_embedding" as ModelType : 
        form.type;
      
      // 确定最大tokens值
      let maxTokensValue = parseInt(form.maxTokens);
      if (form.type === "embedding") {
        // 对于向量化模型，使用向量维度作为maxTokens
        maxTokensValue = parseInt(form.vectorDimension);
      }
      
      // 添加到后端服务
      await modelService.addCustomModel({
        name: form.name,
        type: modelType,
        url: form.url,
        apiKey: form.apiKey.trim() === "" ? "sk-no-api-key" : form.apiKey,
        maxTokens: maxTokensValue,
        displayName: form.displayName || form.name
      })
      
      // 创建模型配置对象
      const modelConfig: SingleModelConfig = {
        modelName: form.name,
        displayName: form.displayName || form.name,
        apiConfig: {
          apiKey: form.apiKey,
          modelUrl: form.url,
        }
      }
      
      // 为向量化模型添加dimension字段
      if (form.type === "embedding") {
        modelConfig.dimension = parseInt(form.vectorDimension);
      }
      
      // 根据模型类型更新本地存储
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
      
      // 保存到localStorage
      updateModelConfig(configUpdate)
      
      // 创建返回的模型信息
      const addedModel: AddedModel = {
        name: form.displayName,
        type: modelType
      }
      
      // 重置表单
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
      
      // 重置连通性状态
      setConnectivityStatus({ status: null, message: "" })
      
      // 调用成功回调，传递新添加的模型信息
      await onSuccess(addedModel)
      
      // 关闭对话框
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

        {/* 是否为多模态向量化模型（仅当选择了向量化模型时显示） */}
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

        {/* 向量维度（仅当选择了向量化模型时显示） */}
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

        {/* Max Tokens （仅当不是向量化模型时显示）*/}
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

        {/* 连通性验证区域 */}
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