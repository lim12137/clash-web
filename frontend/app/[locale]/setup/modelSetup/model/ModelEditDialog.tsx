import { Modal, Input, Select, Button, message } from 'antd'
import { useState, useEffect } from 'react'
import { ModelOption, ModelType } from '@/types/config'
import { modelService } from '@/services/modelService'
import { useConfig } from '@/hooks/useConfig'
import { useTranslation } from 'react-i18next'

const { Option } = Select

interface ModelEditDialogProps {
  isOpen: boolean
  model: ModelOption | null
  onClose: () => void
  onSuccess: () => Promise<void>
}

export const ModelEditDialog = ({ isOpen, model, onClose, onSuccess }: ModelEditDialogProps) => {
  const { t } = useTranslation()
  const { updateModelConfig } = useConfig()
  const [form, setForm] = useState({
    type: "llm" as ModelType,
    name: "",
    displayName: "",
    url: "",
    apiKey: "",
    maxTokens: "4096",
    vectorDimension: "1024"
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (model) {
      setForm({
        type: model.type,
        name: model.name,
        displayName: model.displayName || model.name,
        url: model.apiUrl || "",
        apiKey: model.apiKey || "",
        maxTokens: model.maxTokens?.toString() || "4096",
        vectorDimension: model.maxTokens?.toString() || "1024"
      })
    }
  }, [model])

  const handleFormChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const isEmbeddingModel = form.type === "embedding" || form.type === "multi_embedding"

  const isFormValid = () => {
    return form.name.trim() !== "" && form.url.trim() !== ""
  }

  const handleSave = async () => {
    if (!model) return
    setLoading(true)
    try {
      // 目前后端没有更新接口，采用删除+新增的方式
      await modelService.deleteCustomModel(model.displayName || model.name)
      // 计算 modelType
      const modelType = form.type as ModelType
      // Determine max tokens
      let maxTokensValue = parseInt(form.maxTokens)
      if (isEmbeddingModel) maxTokensValue = 0

      await modelService.addCustomModel({
        name: form.name,
        type: modelType,
        url: form.url,
        apiKey: form.apiKey.trim() === "" ? "sk-no-api-key" : form.apiKey,
        maxTokens: maxTokensValue,
        displayName: form.displayName || form.name
      })

      // 更新本地配置（仅当当前编辑模型在配置中被选中时）
      const modelConfigKeyMap: Record<ModelType, string> = {
        llm: "llm",
        embedding: "embedding",
        multi_embedding: "multiEmbedding",
        vlm: "vlm",
        rerank: "rerank",
        tts: "tts",
        stt: "stt"
      }
      const configKey = modelConfigKeyMap[modelType]
      updateModelConfig({
        [configKey]: {
          modelName: form.name,
          displayName: form.displayName || form.name,
          apiConfig: {
            apiKey: form.apiKey,
            modelUrl: form.url
          },
          ...(isEmbeddingModel ? { dimension: parseInt(form.vectorDimension) } : {})
        }
      })

      await onSuccess()
      message.success(t('model.dialog.editSuccess'))
      onClose()
    } catch (error) {
      console.error(error)
      message.error(t('model.dialog.error.editFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (!model) return null

  return (
    <Modal
      title={t('model.dialog.editTitle')}
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <div className="space-y-4">
        {/* Display Name */}
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            {t('model.dialog.label.displayName')}
          </label>
          <Input
            value={form.displayName}
            onChange={(e) => handleFormChange('displayName', e.target.value)}
          />
        </div>

        {/* URL */}
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            {t('model.dialog.label.url')}
          </label>
          <Input
            value={form.url}
            onChange={(e) => handleFormChange('url', e.target.value)}
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            {t('model.dialog.label.apiKey')}
          </label>
          <Input.Password
            value={form.apiKey}
            onChange={(e) => handleFormChange('apiKey', e.target.value)}
          />
        </div>

        {/* Max Tokens / Dimension */}
        {!isEmbeddingModel ? (
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              {t('model.dialog.label.maxTokens')}
            </label>
            <Input
              value={form.maxTokens}
              onChange={(e) => handleFormChange('maxTokens', e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              {t('model.dialog.label.vectorDimension')}
            </label>
            <Input
              value={form.vectorDimension}
              onChange={(e) => handleFormChange('vectorDimension', e.target.value)}
            />
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button onClick={onClose}>{t('common.button.cancel')}</Button>
          <Button type="primary" onClick={handleSave} loading={loading} disabled={!isFormValid()}>
            {t('common.button.save')}
          </Button>
        </div>
      </div>
    </Modal>
  )
} 