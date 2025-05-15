"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { message, Modal } from "antd"
import { ExclamationCircleOutlined } from '@ant-design/icons'
import AppModelConfig from "./modelSetup/config"
import DataConfig from "./knowledgeBaseSetup/KnowledgeBaseManager"
import { configStore } from "@/lib/config"
import { configService } from "@/services/configService"
import knowledgeBaseService from "@/services/knowledgeBaseService"
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
    }
  }, [user, userLoading, selectedKey, confirm, openLoginModal, router])

  // 初始化时检查连接状态
  useEffect(() => {
    checkModelEngineConnection()
    
    // 预加载知识库数据
    preloadKnowledgeBaseData()

    // 一秒后触发知识库数据更新事件，确保DataConfig组件可以获取到数据
    const timerId = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated'))
    }, 1000)

    // 检查是否需要显示知识库配置选项卡
    const showKbConfig = localStorage.getItem('show_kb_config')
    if (showKbConfig === 'true') {
      // 切换到知识库配置选项卡
      setSelectedKey("2")
      // 清除标志，避免下次访问页面时自动切换
      localStorage.removeItem('show_kb_config')
    }

    return () => clearTimeout(timerId)
  }, [])

  // 添加预加载知识库数据的函数
  const preloadKnowledgeBaseData = async () => {
    try {
      // 总是直接调用API获取最新知识库列表数据
      const knowledgeBases = await knowledgeBaseService.getKnowledgeBases(true)
      
      // 将知识库数据保存到localStorage中，这样可以被KnowledgeBaseContext直接使用
      if (knowledgeBases && knowledgeBases.length > 0) {
        const now = Date.now()
        localStorage.setItem('preloaded_kb_data', JSON.stringify(knowledgeBases))
        // 保存缓存时间信息
        localStorage.setItem('kb_data_cache_info', JSON.stringify({
          timestamp: now,
          count: knowledgeBases.length
        }))
      }
      
      // 触发自定义事件，通知KnowledgeBaseContext立即更新数据
      window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated'))
    } catch (error) {
      console.error("预加载知识库数据失败:", error)
      // 错误发生时不阻止页面加载，但会记录错误
    }
  }

  // 添加自动检查间隔
  useEffect(() => {
    const interval = setInterval(() => {
      checkModelEngineConnection()
    }, 30000) // 每30秒检查一次

    // 清理函数
    return () => clearInterval(interval)
  }, [])

  // 监听selectedKey变化，在进入第二页时刷新知识库数据
  useEffect(() => {
    if (selectedKey === "2") {
      // 进入第二页时，重置标志
      setIsFromSecondPage(false)
      // 进入第二页时，主动更新知识库数据
      updateKnowledgeBaseData()
    }
  }, [selectedKey])

  // 更新知识库数据的函数
  const updateKnowledgeBaseData = async () => {
    try {
      // 直接调用API获取最新知识库列表
      const knowledgeBases = await knowledgeBaseService.getKnowledgeBases(true)
      
      if (knowledgeBases && knowledgeBases.length > 0) {
        const now = Date.now()
        // 更新本地缓存
        localStorage.setItem('preloaded_kb_data', JSON.stringify(knowledgeBases))
        // 更新缓存时间信息
        localStorage.setItem('kb_data_cache_info', JSON.stringify({
          timestamp: now,
          count: knowledgeBases.length
        }))
        
        // 触发自定义事件，通知KnowledgeBaseContext重新获取数据
        window.dispatchEvent(new CustomEvent('knowledgeBaseDataUpdated'))
      }
    } catch (error) {
      console.error("更新知识库数据失败:", error)
    }
  }

  // 检查ModelEngine连接状态的函数
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
    
    switch (selectedKey) {
      case "1":
        return <AppModelConfig skipModelVerification={isFromSecondPage} />
      case "2":
        return <DataConfig />
      default:
        return null
    }
  }

  // 处理完成配置
  const handleCompleteConfig = async () => {
    if (selectedKey === "2") {
      setIsSavingConfig(true)
      try {
        // 获取当前全局配置
        const currentConfig = configStore.getConfig()
        
        // 调用后端保存配置API
        const saveResult = await configService.saveConfigToBackend(currentConfig)
        
        if (saveResult) {
          message.success("配置已保存")
          // 保存成功后跳转到聊天页面
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
    } else if (selectedKey === "1") {
      // 从第一页跳转到第二页时验证必填项
      try {
        // 获取当前配置
        const currentConfig = configStore.getConfig()
        
        // 检查应用名称
        if (!currentConfig.app.appName.trim()) {
          message.error("请填写应用名称")
          
          // 触发自定义事件，通知AppConfigSection将应用名称输入框标记为错误
          window.dispatchEvent(new CustomEvent('highlightMissingField', {
            detail: { field: 'appName' }
          }))
          
          return // 中断跳转
        }
        
        // 检查主模型
        if (!currentConfig.models.llm.modelName) {
          message.error("请选择主模型")
          
          // 触发自定义事件，通知ModelConfigSection将主模型下拉框标记为错误
          window.dispatchEvent(new CustomEvent('highlightMissingField', {
            detail: { field: 'llm.main' }
          }))
          
          return // 中断跳转
        }
        
        // 所有必填项都已填写，允许跳转到第二页
        setSelectedKey("2")

        // 调用后端保存配置API
        await configService.saveConfigToBackend(currentConfig)
      } catch (error) {
        console.error("验证配置异常:", error)
        message.error("系统异常，请稍后重试")
      }
    }
  }

  // 处理用户切换到第一页的逻辑
  const handleBackToFirstPage = () => {
    // 只有管理员才能返回第一页
    if (user?.role !== "admin") {
      message.error("只有管理员可以访问模型配置页面")
      return
    }
    
    if (selectedKey === "2") {
      setSelectedKey("1")
      // 设置标志，表示用户是从第二页返回第一页
      setIsFromSecondPage(true)
      // 当用户从第二页返回第一页时，预加载数据以备后用
      preloadKnowledgeBaseData()
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
      >
        {renderContent()}
      </Layout>
    </>
  )
}