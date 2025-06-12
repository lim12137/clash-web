"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { message, Modal } from "antd"
import { ExclamationCircleOutlined } from '@ant-design/icons'
import AppModelConfig from "./modelSetup/config"
import DataConfig from "./knowledgeBaseSetup/KnowledgeBaseManager"
import AgentConfig from "./agentSetup/AgentConfig"
import { configStore } from "@/lib/config"
import { configService } from "@/services/configService"
import modelEngineService, { ConnectionStatus } from "@/services/modelEngineService"
import { useAuth } from "@/hooks/useAuth"
import Layout from "./layout"

export default function CreatePage() {
  const [selectedKey, setSelectedKey] = useState("1")
  const router = useRouter()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("processing")
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isFromSecondPage, setIsFromSecondPage] = useState(false)
  const { user, isLoading: userLoading, openLoginModal } = useAuth()
  const { confirm } = Modal

  // 检查登录状态和权限
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        // 用户未登录，显示登录提示框
        confirm({
          title: '登录已过期',
          icon: <ExclamationCircleOutlined />,
          content: '您的登录信息已过期，请重新登录以继续使用。',
          okText: '立即登录',
          cancelText: '返回首页',
          closable: false,
          onOk() {
            openLoginModal();
          },
          onCancel() {
            router.push('/');
          }
        });
        return
      }

      // 如果用户不是管理员且当前在第一页，自动跳转到第二页
      if (user.role !== "admin" && selectedKey === "1") {
        setSelectedKey("2")
      }
      
      // 如果用户不是管理员且当前在第三页，强制跳转到第二页
      if (user.role !== "admin" && selectedKey === "3") {
        setSelectedKey("2")
      }
    }
  }, [user, userLoading, selectedKey, confirm, openLoginModal, router])

  // Check the connection status when the page is initialized
  useEffect(() => {
    // Trigger knowledge base data acquisition only when the page is initialized
    window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
      detail: { forceRefresh: true }
    }))

    // Check if the knowledge base configuration option card needs to be displayed
    const showPageConfig = localStorage.getItem('show_page')
    if (showPageConfig) {
      setSelectedKey(showPageConfig)
      localStorage.removeItem('show_page')
    }
  }, [])

  // Listen for changes in selectedKey, refresh knowledge base data when entering the second page
  useEffect(() => {
    if (selectedKey === "2") {
      // When entering the second page, reset the flag
      setIsFromSecondPage(false)
      // When entering the second page, get the latest knowledge base data
      window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated', {
        detail: { forceRefresh: true }
      }))
    }
    checkModelEngineConnection()
  }, [selectedKey])

  // Function to check the ModelEngine connection status
  const checkModelEngineConnection = async () => {
    setIsCheckingConnection(true)

    try {
      const result = await modelEngineService.checkConnection()
      setConnectionStatus(result.status)
      setLastChecked(result.lastChecked)
    } catch (error) {
      console.error("检查连接状态失败:", error)
      setConnectionStatus("error")
    } finally {
      setIsCheckingConnection(false)
    }
  }

  const renderContent = () => {
    // 如果用户不是管理员且尝试访问第一页，强制显示第二页内容
    if (user?.role !== "admin" && selectedKey === "1") {
      return <DataConfig />
    }
    
    // 如果用户不是管理员且尝试访问第三页，强制显示第二页内容
    if (user?.role !== "admin" && selectedKey === "3") {
      return <DataConfig />
    }

    switch (selectedKey) {
      case "1":
        return <AppModelConfig skipModelVerification={isFromSecondPage} />
      case "2":
        return <DataConfig />
      case "3":
        return <AgentConfig />
      default:
        return null
    }
  }

  // Handle completed configuration
  const handleCompleteConfig = async () => {
    if (selectedKey === "3") {
      // when finish the config in the third step, check if the necessary steps are completed
      try {
        // trigger a custom event to get the Agent configuration status
        const agentConfigData = await new Promise<{businessLogic: string, systemPrompt: string}>((resolve) => {
          const handleAgentConfigResponse = (event: Event) => {
            const customEvent = event as CustomEvent;
            resolve(customEvent.detail);
            window.removeEventListener('agentConfigDataResponse', handleAgentConfigResponse);
          };
          
          window.addEventListener('agentConfigDataResponse', handleAgentConfigResponse);
          window.dispatchEvent(new CustomEvent('getAgentConfigData'));
          
          // set a timeout to prevent infinite waiting
          setTimeout(() => {
            window.removeEventListener('agentConfigDataResponse', handleAgentConfigResponse);
            resolve({businessLogic: '', systemPrompt: ''});
          }, 1000);
        });

        // check if the business description is filled
        if (!agentConfigData.businessLogic || agentConfigData.businessLogic.trim() === '') {
          message.error("请先完成业务描述");
          return; // prevent continue
        }

        // check if the system prompt is generated
        if (!agentConfigData.systemPrompt || agentConfigData.systemPrompt.trim() === '') {
          message.error("请先生成系统提示词");
          return; // prevent continue
        }

        // if the check is passed, continue to execute the save configuration logic
        setIsSavingConfig(true)
        // Get the current global configuration
        const currentConfig = configStore.getConfig()
        
        // Call the backend save configuration API
        const saveResult = await configService.saveConfigToBackend(currentConfig)
        
        if (saveResult) {
          message.success("配置已保存")
          // After saving successfully, redirect to the chat page
          router.push("/chat")
        } else {
          message.error("保存配置失败，请重试")
        }
      } catch (error) {
        console.error("保存配置异常:", error)
        message.error("系统异常，请稍后重试")
      } finally {
        setIsSavingConfig(false)
      }
    } else if (selectedKey === "2") {
      // 如果是管理员，跳转到第三页；如果是普通用户，直接完成配置跳转到chat页面
      if (user?.role === "admin") {
        setSelectedKey("3")
      } else {
        // 普通用户在第二页直接完成配置
        try {
          setIsSavingConfig(true)
          // Get the current global configuration
          const currentConfig = configStore.getConfig()
          
          // Call the backend save configuration API
          const saveResult = await configService.saveConfigToBackend(currentConfig)
          
          if (saveResult) {
            message.success("配置已保存")
            // After saving successfully, redirect to the chat page
            router.push("/chat")
          } else {
            message.error("保存配置失败，请重试")
          }
        } catch (error) {
          console.error("保存配置异常:", error)
          message.error("系统异常，请稍后重试")
        } finally {
          setIsSavingConfig(false)
        }
      }
    } else if (selectedKey === "1") {
      // Validate required fields when jumping from the first page to the second page
      try {
        // Get the current configuration
        const currentConfig = configStore.getConfig()
        
        // Check the application name
        if (!currentConfig.app.appName.trim()) {
          message.error("请填写应用名称")
          
          // Trigger a custom event to notify the AppConfigSection to mark the application name input box as an error
          window.dispatchEvent(new CustomEvent('highlightMissingField', {
            detail: { field: 'appName' }
          }))
          
          return // Interrupt the jump
        }
        
        // Check the main model
        if (!currentConfig.models.llm.modelName) {
          message.error("请选择主模型")
          
          // Trigger a custom event to notify the ModelConfigSection to mark the main model dropdown as an error
          window.dispatchEvent(new CustomEvent('highlightMissingField', {
            detail: { field: 'llm.main' }
          }))
          
          return
        }
        
        // All required fields have been filled, allow the jump to the second page
        setSelectedKey("2")

        // Call the backend save configuration API
        await configService.saveConfigToBackend(currentConfig)
      } catch (error) {
        console.error("验证配置异常:", error)
        message.error("系统异常，请稍后重试")
      }
    }
  }

  // Handle the logic of the user switching to the first page
  const handleBackToFirstPage = () => {
    if (selectedKey === "3") {
      setSelectedKey("2")
    } else if (selectedKey === "2") {
      // 只有管理员才能返回第一页
      if (user?.role !== "admin") {
        message.error("只有管理员可以访问模型配置页面")
        return
      }
      setSelectedKey("1")
      // Set the flag to indicate that the user is returning from the second page to the first page
      setIsFromSecondPage(true)
    }
  }

  return (
    <>
      <Layout
        connectionStatus={connectionStatus}
        lastChecked={lastChecked}
        isCheckingConnection={isCheckingConnection}
        onCheckConnection={checkModelEngineConnection}
        selectedKey={selectedKey}
        onBackToFirstPage={handleBackToFirstPage}
        onCompleteConfig={handleCompleteConfig}
        isSavingConfig={isSavingConfig}
        userRole={user?.role}
        showDebugButton={selectedKey === "3"}
      >
        {renderContent()}
      </Layout>
    </>
  )
}