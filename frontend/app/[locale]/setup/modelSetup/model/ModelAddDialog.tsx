import { Modal, Select, Input, Button, message, Switch, Tooltip } from 'antd'
import { InfoCircleFilled, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { ModelType, SingleModelConfig, ModelConnectStatus } from '@/types/config'
import { modelService } from '@/services/modelService'
import { useConfig } from '@/hooks/useConfig'
import { useTranslation } from 'react-i18next'

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

// Add type definition for connectivity status
type ConnectivityStatusType = "checking" | "available" | "unavailable" | null;

export const ModelAddDialog = ({ isOpen, onClose, onSuccess }: ModelAddDialogProps) => {
  const { t } = useTranslation()
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
    status: ConnectivityStatusType
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
      message.warning(t('model.dialog.warning.incompleteForm'))
      return
    }

    setVerifyingConnectivity(true)
    setConnectivityStatus({ status: "checking", message: t('model.dialog.status.verifying') })

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
      
      // Set connectivity status
      setConnectivityStatus({
        status: result.connectivity ? "available" : "unavailable",
        // Use translated error code if available
        message: result.error_code ? t(`model.validation.${result.error_code}`) : result.message
      })

      // Display appropriate message based on result
      if (result.connectivity) {
        message.success(t('model.dialog.success.connectivityVerified'))
      } else {
        message.error(
          result.error_code 
            ? t(`model.validation.${result.error_code}`)
            : t('model.dialog.error.connectivityFailed', { message: result.message })
        )
      }
    } catch (error) {
      setConnectivityStatus({
        status: "unavailable",
        message: t('model.dialog.error.verificationFailed', { error })
      })
      message.error(t('model.dialog.error.verificationError', { error }))
    } finally {
      setVerifyingConnectivity(false)
    }
  }

  // Get the connectivity status icon
  const getConnectivityIcon = () => {
    switch (connectivityStatus.status) {
      case "checking":
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      case "available":
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case "unavailable":
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  // Get the connectivity status color
  const getConnectivityColor = () => {
    switch (connectivityStatus.status) {
      case "checking":
        return '#1890ff'
      case "available":
        return '#52c41a'
      case "unavailable":
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
      message.error(t('model.dialog.error.addFailed', { error }))
      console.error(t('model.dialog.error.addFailedLog'), error)
    } finally {
      setLoading(false)
    }
  }

  const isEmbeddingModel = form.type === "embedding"

  return (
    <Modal
      title={t('model.dialog.title')}
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <div className="space-y-4">
        {/* Model Type */}
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            {t('model.dialog.label.type')} <span className="text-red-500">*</span>
          </label>
          <Select
            style={{ width: "100%" }}
            value={form.type}
            onChange={(value) => handleFormChange("type", value)}
          >
            <Option value="llm">{t('model.type.llm')}</Option>
            <Option value="embedding">{t('model.type.embedding')}</Option>
            <Option value="vlm">{t('model.type.vlm')}</Option>
            <Option value="rerank" disabled>{t('model.type.rerank')}</Option>
            <Option value="stt" disabled>{t('model.type.stt')}</Option>
            <Option value="tts" disabled>{t('model.type.tts')}</Option>
          </Select>
        </div>

        {/* Multimodal Switch */}
        {isEmbeddingModel && (
          <div>
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">
                {t('model.dialog.label.multimodal')}
              </label>
              <Switch 
                checked={form.isMultimodal}
                onChange={(checked) => handleFormChange("isMultimodal", checked)}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {form.isMultimodal ? t('model.dialog.hint.multimodalEnabled') : t('model.dialog.hint.multimodalDisabled')}
            </div>
          </div>
        )}

        {/* Model Name */}
        <div>
          <label htmlFor="name" className="block mb-1 text-sm font-medium text-gray-700">
            {t('model.dialog.label.name')} <span className="text-red-500">*</span>
          </label>
          <Input
            id="name"
            placeholder={t('model.dialog.placeholder.name')}
            value={form.name}
            onChange={handleModelNameChange}
          />
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block mb-1 text-sm font-medium text-gray-700">
            {t('model.dialog.label.displayName')}
          </label>
          <Input
            id="displayName"
            placeholder={t('model.dialog.placeholder.displayName')}
            value={form.displayName}
            onChange={(e) => handleFormChange("displayName", e.target.value)}
          />
        </div>

        {/* Model URL */}
        <div>
          <label htmlFor="url" className="block mb-1 text-sm font-medium text-gray-700">
            {t('model.dialog.label.url')} <span className="text-red-500">*</span>
          </label>
          <Input
            id="url"
            placeholder={
              form.type === "embedding"
                ? t('model.dialog.placeholder.url.embedding')
                : t('model.dialog.placeholder.url')
            }
            value={form.url}
            onChange={(e) => handleFormChange("url", e.target.value)}
          />
        </div>

        {/* API Key */}
        <div>
          <label htmlFor="apiKey" className="block mb-1 text-sm font-medium text-gray-700">
            {t('model.dialog.label.apiKey')}
          </label>
          <Input.Password
            id="apiKey"
            placeholder={t('model.dialog.placeholder.apiKey')}
            value={form.apiKey}
            onChange={(e) => handleFormChange("apiKey", e.target.value)}
          />
        </div>

        {/* Vector dimension */}
        {isEmbeddingModel && (
          <div>
            <label htmlFor="vectorDimension" className="block mb-1 text-sm font-medium text-gray-700">
              {t('model.dialog.label.vectorDimension')} <span className="text-red-500">*</span>
            </label>
            <Input
              id="vectorDimension"
              placeholder={t('model.dialog.placeholder.vectorDimension')}
              value={form.vectorDimension}
              onChange={(e) => handleFormChange("vectorDimension", e.target.value)}
              status={!isValidVectorDimension(form.vectorDimension) ? "error" : ""}
            />
            {!isValidVectorDimension(form.vectorDimension) && (
              <div className="text-red-500 text-xs mt-1">{t('model.dialog.error.invalidVectorDimension')}</div>
            )}
          </div>
        )}

        {/* Max Tokens */}
        {!isEmbeddingModel && (
          <div>
            <label htmlFor="maxTokens" className="block mb-1 text-sm font-medium text-gray-700">
              {t('model.dialog.label.maxTokens')}
            </label>
            <Input
              id="maxTokens"
              placeholder={t('model.dialog.placeholder.maxTokens')}
              value={form.maxTokens}
              onChange={(e) => handleFormChange("maxTokens", e.target.value)}
            />
          </div>
        )}

        {/* Connectivity verification area */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700">{t('model.dialog.connectivity.title')}</span>
              {connectivityStatus.status && (
                <div className="ml-2 flex items-center">
                  {getConnectivityIcon()}
                  <span 
                    className="ml-1 text-xs"
                    style={{ color: getConnectivityColor() }}
                  >
                    {t(`model.dialog.connectivity.status.${connectivityStatus.status}`)}
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
              {verifyingConnectivity ? t('model.dialog.button.verifying') : t('model.dialog.button.verify')}
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
              <p className="font-bold text-medium">{t('model.dialog.help.title')}</p>
            </div>
            <p className="mt-0.5 ml-6">
              {t('model.dialog.help.content')}
            </p>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end space-x-3">
          <Button onClick={onClose}>
            {t('common.button.cancel')}
          </Button>
          <Button
            type="primary"
            onClick={handleAddModel}
            disabled={!isFormValid()}
            loading={loading}
          >
            {t('model.dialog.button.add')}
          </Button>
        </div>
      </div>
    </Modal>
  )
} 