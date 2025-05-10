"use client"

import { useState } from 'react'
import BusinessLogicConfig from './AgentManagementConfig'
import SystemPromptConfig from './SystemPromptConfig'
import { generateSystemPrompt } from './components/utils'
import DebugConfig from './DebugConfig'
import { Typography, Row, Col, Drawer } from 'antd'
const { Title } = Typography

// 布局高度常量配置
const LAYOUT_CONFIG = {
  MAIN_CONTENT_HEIGHT: "calc(70vh - 48px)",
  CARD_HEADER_PADDING: "10px 24px",
  CARD_BODY_PADDING: "12px 20px",
  CARD_GAP: 12,
  DRAWER_WIDTH: 400,
}

// 卡片主题
const cardTheme = {
  borderColor: "#e6e6e6",
  backgroundColor: "#ffffff",
}

/**
 * Agent配置主组件
 */
export default function AgentConfig() {
  const [businessLogic, setBusinessLogic] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedAgents, setSelectedAgents] = useState<any[]>([])
  const [selectedTools, setSelectedTools] = useState<any[]>([])
  const [testQuestion, setTestQuestion] = useState("")
  const [testAnswer, setTestAnswer] = useState("")
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false)

  // 处理生成系统提示词
  const handleGenerateSystemPrompt = async () => {
    if (!businessLogic.trim()) return
    
    setIsGenerating(true)
    setSystemPrompt("")
    
    try {
      // 使用generateSystemPrompt服务
      const generatedPrompt = await generateSystemPrompt(businessLogic, selectedAgents, selectedTools)
      setSystemPrompt(generatedPrompt)
    } catch (error) {
      console.error("Error generating system prompt:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  // 暴露调试抽屉控制方法给父组件
  if (typeof window !== 'undefined') {
    window.openDebugDrawer = () => setIsDebugDrawerOpen(true)
  }

  return (
    <div className="w-full mx-auto px-4" style={{ maxWidth: "1920px" }}>
      <div className="w-full">
        <Row gutter={[LAYOUT_CONFIG.CARD_GAP, LAYOUT_CONFIG.CARD_GAP]}>
          {/* 左侧面板 - 业务逻辑配置 */}
          <Col xs={24} md={24} lg={12} xl={12}>
            <div className="bg-white border border-gray-200 rounded-md flex flex-col overflow-hidden p-4">
              <div className="mb-4 px-2">
                <Title level={4}>业务逻辑配置</Title>
                <div className="h-[1px] bg-gray-200 mt-2"></div>
              </div>
              <div style={{ 
                height: LAYOUT_CONFIG.MAIN_CONTENT_HEIGHT, 
                overflowY: "auto",
                overflowX: "hidden"
              }}>
                <BusinessLogicConfig 
                  businessLogic={businessLogic}
                  setBusinessLogic={setBusinessLogic}
                  selectedAgents={selectedAgents}
                  setSelectedAgents={setSelectedAgents}
                  selectedTools={selectedTools}
                  setSelectedTools={setSelectedTools}
                  onGenerateSystemPrompt={handleGenerateSystemPrompt}
                  systemPrompt={systemPrompt}
                />
              </div>
            </div>
          </Col>
          
          {/* 中间面板 - 系统提示词配置 */}
          <Col xs={24} md={24} lg={12} xl={12}>
            <div className="bg-white border border-gray-200 rounded-md flex flex-col overflow-hidden p-4">
              <div className="mb-4 px-2">
                <Title level={4}>系统提示词配置</Title>
                <div className="h-[1px] bg-gray-200 mt-2"></div>
              </div>
              <div style={{ 
                height: LAYOUT_CONFIG.MAIN_CONTENT_HEIGHT, 
                overflowY: "auto",
                overflowX: "hidden"
              }}>
                <SystemPromptConfig 
                  systemPrompt={systemPrompt}
                  setSystemPrompt={setSystemPrompt}
                  isGenerating={isGenerating}
                />
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* 调试抽屉 */}
      <Drawer
        title="调试配置"
        placement="right"
        onClose={() => setIsDebugDrawerOpen(false)}
        open={isDebugDrawerOpen}
        width={LAYOUT_CONFIG.DRAWER_WIDTH}
        styles={{
          body: {
            padding: 0,
            height: '100%',
            overflow: 'hidden'
          }
        }}
      >
        <div className="h-full">
          <DebugConfig 
            testQuestion={testQuestion}
            setTestQuestion={setTestQuestion}
            testAnswer={testAnswer}
            setTestAnswer={setTestAnswer}
          />
        </div>
      </Drawer>
    </div>
  )
} 