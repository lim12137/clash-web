import { Modal, Select, Input, Button, message } from 'antd'
import { InfoCircleFilled } from '@ant-design/icons'
import { useState } from 'react'
import { ModelType, SingleModelConfig } from '@/types/config'
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

const DEFAULT_MODEL_CONFIG: Record<string, any> = {
  embedding: {
    modelName: "jina-clip-v2",
    displayName: "jina-clip-v2",
    apiConfig: {
      modelUrl: "https://api.jina.ai/v1/embeddings",
    }
  }
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
    setForm(prev => {
      // 只有在展示名称为空时才自动填充
      const shouldUpdateDisplayName = !prev.displayName
      return {
        ...prev,
        name,
        displayName: shouldUpdateDisplayName ? parseModelName(name) : prev.displayName
      }
    })
  }

  // 处理表单变更
  const handleFormChange = (field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 检查表单是否有效
  const isFormValid = () => {
    if (form.type === "embedding") {
      return form.apiKey.trim() !== ""
    }
    return form.name.trim() !== "" && 
           form.url.trim() !== "" && 
           form.maxTokens.trim() !== ""
  }

  // 处理添加模型
  const handleAddModel = async () => {
    try {
      // 添加到后端服务
      await modelService.addCustomModel({
        name: form.name || DEFAULT_MODEL_CONFIG[form.type]?.modelName,
        type: form.type,
        url: form.url || DEFAULT_MODEL_CONFIG[form.type]?.apiConfig?.modelUrl,
        apiKey: form.apiKey || DEFAULT_MODEL_CONFIG[form.type]?.apiConfig?.apiKey,
        maxTokens: parseInt(form.maxTokens),
        displayName: form.displayName || form.name || DEFAULT_MODEL_CONFIG[form.type]?.displayName
      })
      
      // 创建模型配置对象
      const modelConfig: SingleModelConfig = {
        modelName: form.name || DEFAULT_MODEL_CONFIG[form.type]?.modelName,
        displayName: form.displayName || form.name || DEFAULT_MODEL_CONFIG[form.type]?.displayName,
        apiConfig: {
          apiKey: form.apiKey || DEFAULT_MODEL_CONFIG[form.type]?.apiConfig?.apiKey,
          modelUrl: form.url || DEFAULT_MODEL_CONFIG[form.type]?.apiConfig?.modelUrl,
        }
      }
      
      // 根据模型类型更新本地存储
      let configUpdate: any = {}
      
      switch(form.type) {
        case "llm":
          configUpdate = { llm: modelConfig }
          break;
        case "embedding":
          configUpdate = { embedding: modelConfig }
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
        name: form.name,
        type: form.type
      }
      
      // 重置表单
      setForm({
        type: form.type,
        name: "",
        displayName: "",
        url: "",
        apiKey: "",
        maxTokens: "4096",
      })
      
      // 调用成功回调，传递新添加的模型信息
      await onSuccess(addedModel)
      
      // 关闭对话框
      onClose()
    } catch (error) {
      message.error(`添加模型失败：${error}`)
      console.error('添加模型失败:', error)
    }
  }

  const isNotEmbeddingModel = form.type !== "embedding"

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
            <Option value="embedding">Embedding模型</Option>
            <Option value="vlm">视觉语言模型</Option>
            <Option value="rerank" disabled>Rerank模型</Option>
            <Option value="stt" disabled>语音识别模型</Option>
            <Option value="tts" disabled>语音合成模型</Option>
          </Select>
        </div>

        {/* Model Name - Always shown, read-only for embedding */}
        <div>
          <label htmlFor="name" className="block mb-1 text-sm font-medium text-gray-700">
            模型名称 <span className="text-red-500">*</span>
          </label>
          <Input
            id="name"
            placeholder="请输入请求体中的模型名称"
            value={isNotEmbeddingModel ? form.name : DEFAULT_MODEL_CONFIG.embedding.modelName}
            onChange={handleModelNameChange}
            disabled={!isNotEmbeddingModel}
          />
        </div>

        {isNotEmbeddingModel && (
          <>
            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block mb-1 text-sm font-medium text-gray-700">
                展示名称
              </label>
              <Input
                id="displayName"
                placeholder="请输入模型的展示名称（可选）"
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
          </>
        )}

        {/* API Key */}
        <div>
          <label htmlFor="apiKey" className="block mb-1 text-sm font-medium text-gray-700">
            API Key {!isNotEmbeddingModel && <span className="text-red-500">*</span>}
          </label>
          <Input.Password
            id="apiKey"
            placeholder={!isNotEmbeddingModel ? "请输入API Key" : "请输入API Key（可选）"}
            value={form.apiKey}
            onChange={(e) => handleFormChange("apiKey", e.target.value)}
          />
        </div>

        {isNotEmbeddingModel && (
          <>
            {/* Max Tokens */}
            <div>
              <label htmlFor="maxTokens" className="block mb-1 text-sm font-medium text-gray-700">
                最大Token数 <span className="text-red-500">*</span>
              </label>
              <Input
                id="maxTokens"
                placeholder="请输入最大Token数"
                value={form.maxTokens}
                onChange={(e) => handleFormChange("maxTokens", e.target.value)}
              />
            </div>

            {/* Help Text */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-700">
              <div>
                <div className="flex items-center mb-1">
                  <InfoCircleFilled className="text-md text-blue-500 mr-3" />
                  <p className="font-bold text-medium">模型配置说明</p>
                </div>
                <p className="mt-0.5 ml-6">
                  请填写模型的基本信息，API Key、展示名称为可选项，其他字段为必填项。添加后可在下拉列表中选择该模型。
                </p>
              </div>
            </div>
          </>
        )}

        {/* Footer Buttons */}
        <div className="flex justify-end space-x-3">
          <Button onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleAddModel}
            disabled={!isFormValid()}
          >
            添加
          </Button>
        </div>
      </div>
    </Modal>
  )
} 