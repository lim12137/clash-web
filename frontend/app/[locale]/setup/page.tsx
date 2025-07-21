"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { theme, Modal, message } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import AppModelConfig from "./modelSetup/config"
import DataConfig from "./knowledgeBaseSetup/KnowledgeBaseManager"
import AgentConfig from "./agentSetup/AgentConfig"
import { configStore } from "@/lib/config"
import { configService } from "@/services/configService"
import modelEngineService, { ConnectionStatus } from "@/services/modelEngineService"
import Layout from "./layout"
import { useTranslation } from 'react-i18next'
import { useTheme } from 'next-themes';


export default function CreatePage() {
  const [selectedKey, setSelectedKey] = useState("1")
  const router = useRouter()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("processing")
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isFromSecondPage, setIsFromSecondPage] = useState(false)
  const { t } = useTranslation()
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [pendingJump, setPendingJump] = useState(false);
  const { token } = theme.useToken ? theme.useToken() : { token: {} };
  const { resolvedTheme } = typeof useTheme === 'function' ? useTheme() : { resolvedTheme: 'light' };
  const isDark = resolvedTheme === 'dark';

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
      // Clear all possible caches
      localStorage.removeItem('preloaded_kb_data');
      localStorage.removeItem('kb_cache');
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
      console.error(t('setup.page.error.checkConnection'), error)
      setConnectionStatus("error")
    } finally {
      setIsCheckingConnection(false)
    }
  }

  const renderContent = () => {
    switch (selectedKey) {
      case "1":
        return <AppModelConfig skipModelVerification={isFromSecondPage} />
      case "2":
        return <DataConfig isActive={selectedKey === "2"} />
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
          message.error(t('agent.message.businessDescriptionRequired'));
          return; // prevent continue
        }

        // check if the system prompt is generated
        if (!agentConfigData.systemPrompt || agentConfigData.systemPrompt.trim() === '') {
          message.error(t('systemPrompt.message.empty'));
          return; // prevent continue
        }

        // if the check is passed, continue to execute the save configuration logic
        setIsSavingConfig(true)
        // Get the current global configuration
        const currentConfig = configStore.getConfig()
        
        // Call the backend save configuration API
        const saveResult = await configService.saveConfigToBackend(currentConfig)
        
        if (saveResult) {
          message.success(t('setup.page.success.configSaved'))
          // After saving successfully, redirect to the chat page
          router.push("/chat")
        } else {
          message.error(t('setup.page.error.saveConfig'))
        }
      } catch (error) {
        console.error(t('setup.page.error.systemError'), error)
        message.error(t('setup.page.error.systemError'))
      } finally {
        setIsSavingConfig(false)
      }
    } else if (selectedKey === "2") {
      // Jump from the second page to the third page
      console.log(t('setup.page.log.readyToJump', { from: '2', to: '3' }));
      setSelectedKey("3")
      console.log(t('setup.page.log.selectedKeyUpdated', { key: '3' }));
    } else if (selectedKey === "1") {
      // Validate required fields when jumping from the first page to the second page
      try {
        // Get the current configuration
        const currentConfig = configStore.getConfig()
        
        // Check the main model
        if (!currentConfig.models.llm.modelName) {
          message.error(t('setup.page.error.selectMainModel'))
          
          // Trigger a custom event to notify the ModelConfigSection to mark the main model dropdown as an error
          window.dispatchEvent(new CustomEvent('highlightMissingField', {
            detail: { field: t('setup.page.error.highlightField.llmMain') }
          }))
          
          return
        }
        
        // 检查 embedding 模型
        if (
          !currentConfig.models.embedding.modelName &&
          !currentConfig.models.multiEmbedding?.modelName
        ) {
          setEmbeddingModalOpen(true);
          setPendingJump(true);
          // 高亮 embedding 下拉框
          window.dispatchEvent(new CustomEvent('highlightMissingField', {
            detail: { field: 'embedding.embedding' }
          }))
          return;
        }
        
        // All required fields have been filled, allow the jump to the second page
        console.log(t('setup.page.log.readyToJump', { from: '1', to: '2' }));
        setSelectedKey("2")
        console.log(t('setup.page.log.selectedKeyUpdated', { key: '2' }));

        // Call the backend save configuration API
        await configService.saveConfigToBackend(currentConfig)
      } catch (error) {
        console.error(t('setup.page.error.systemError'), error)
        message.error(t('setup.page.error.systemError'))
      }
    }
  }

  // Handle the logic of the user switching to the first page
  const handleBackToFirstPage = () => {
    if (selectedKey === "3") {
      console.log(t('setup.page.log.readyToJump', { from: '3', to: '2' }));
      setSelectedKey("2")
      console.log(t('setup.page.log.selectedKeyUpdated', { key: '2' }));
    } else if (selectedKey === "2") {
      console.log(t('setup.page.log.readyToJump', { from: '2', to: '1' }));
      setSelectedKey("1")
      console.log(t('setup.page.log.selectedKeyUpdated', { key: '1' }));
      // Set the flag to indicate that the user is returning from the second page to the first page
      setIsFromSecondPage(true)
    }
  }

  return (
    <Layout
      connectionStatus={connectionStatus}
      lastChecked={lastChecked}
      isCheckingConnection={isCheckingConnection}
      onCheckConnection={checkModelEngineConnection}
      selectedKey={selectedKey}
      onBackToFirstPage={handleBackToFirstPage}
      onCompleteConfig={handleCompleteConfig}
      isSavingConfig={isSavingConfig}
      showDebugButton={selectedKey === "3"}
    >
      {renderContent()}
      <Modal
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExclamationCircleFilled style={{ color: '#faad14', fontSize: 22 }} />
            <span style={{ fontWeight: 600, fontSize: 18, color: isDark ? '#fffbe6' : '#333' }}>{t('embedding.modal.title')}</span>
          </span>
        }
        open={embeddingModalOpen}
        onOk={() => {
          setEmbeddingModalOpen(false);
          if (pendingJump) {
            setPendingJump(false);
            setSelectedKey("2");
          }
        }}
        onCancel={() => setEmbeddingModalOpen(false)}
        okText={t('embedding.modal.ok_continue')}
        cancelButtonProps={{ style: { display: 'none' } }}
        centered
        bodyStyle={{
          padding: '32px 24px 24px 24px',
          background: isDark ? '#23272f' : '#fffbe6',
          borderRadius: 12,
          color: isDark ? '#eee' : '#333',
        }}
        style={{
          borderRadius: 16,
          maxWidth: 1000,
          minWidth: 666,
          background: isDark ? '#23272f' : '#fff',
        }}
      >
        <div
          style={{
            fontSize: 16,
            color: isDark ? '#eee' : '#333',
            textAlign: 'center',
            marginBottom: 8,
          }}
          dangerouslySetInnerHTML={{
            __html: t('embedding.modal.content').replace(
              '<b>', `<b style=\"color:${isDark ? '#ffe58f' : '#faad14'}\">`
            ),
          }}
        />
        <div
          style={{
            textAlign: 'center',
            color: isDark ? '#aaa' : '#999',
            fontSize: 13,
            marginTop: 8,
          }}
        >
          {t('embedding.modal.tip')}
        </div>
      </Modal>
    </Layout>
  )
}