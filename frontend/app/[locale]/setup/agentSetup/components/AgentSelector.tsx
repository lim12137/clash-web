"use client"

import { useState, useEffect } from 'react'
import { Card, List, Avatar, Typography, Spin, Empty, message } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { fetchAllAgentsBasicInfo } from '@/services/agentConfigService'

const { Text, Title } = Typography

interface AgentBasicInfo {
  agent_id: number
  name: string
  description: string
  is_available: boolean
}

interface AgentSelectorProps {
  onAgentSelect: (agent: AgentBasicInfo) => void
  selectedAgentId?: number | null
}

export default function AgentSelector({ onAgentSelect, selectedAgentId }: AgentSelectorProps) {
  const { t } = useTranslation('common')
  const [agents, setAgents] = useState<AgentBasicInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<AgentBasicInfo | null>(null)

  // 获取所有agent的基本信息
  const loadAgents = async () => {
    setLoading(true)
    try {
      const result = await fetchAllAgentsBasicInfo()
      if (result.success) {
        setAgents(result.data)
        // 如果有预选的agent，设置选中状态
        if (selectedAgentId) {
          const preSelectedAgent = result.data.find(agent => agent.agent_id === selectedAgentId)
          if (preSelectedAgent) {
            setSelectedAgent(preSelectedAgent)
          }
        }
      } else {
        message.error(result.message || t('agent.error.fetchAgentList'))
      }
    } catch (error) {
      console.error('获取Agent列表失败:', error)
      message.error(t('agent.error.fetchAgentListRetry'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAgents()
  }, [])

  const handleAgentClick = (agent: AgentBasicInfo) => {
    setSelectedAgent(agent)
    onAgentSelect(agent)
  }

  const renderAgentItem = (agent: AgentBasicInfo) => {
    const isSelected = selectedAgent?.agent_id === agent.agent_id
    const isAvailable = agent.is_available

    return (
      <List.Item
        onClick={() => isAvailable && handleAgentClick(agent)}
        style={{
          cursor: isAvailable ? 'pointer' : 'not-allowed',
          backgroundColor: isSelected ? '#f0f0f0' : 'transparent',
          padding: '12px 16px',
          borderRadius: '8px',
          margin: '4px 0',
          border: isSelected ? '2px solid #1890ff' : '1px solid #f0f0f0',
          opacity: isAvailable ? 1 : 0.6
        }}
      >
        <List.Item.Meta
          avatar={
            <Avatar 
              icon={<UserOutlined />} 
              style={{ 
                backgroundColor: isSelected ? '#1890ff' : '#d9d9d9',
                color: isSelected ? 'white' : '#666'
              }} 
            />
          }
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text strong={isSelected} style={{ color: isAvailable ? '#000' : '#999' }}>
                {agent.name}
              </Text>
              {!isAvailable && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  ({t('agent.status.unavailable')})
                </Text>
              )}
            </div>
          }
          description={
            <Text type="secondary" style={{ fontSize: '14px' }}>
              {agent.description || t('agent.description.empty')}
            </Text>
          }
        />
      </List.Item>
    )
  }

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text>{t('agent.loading')}</Text>
          </div>
        </div>
      </Card>
    )
  }

  if (agents.length === 0) {
    return (
      <Card>
        <Empty
          description={t('agent.empty')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    )
  }

  return (
    <Card title={t('agent.select.title')} style={{ marginBottom: '16px' }}>
      <List
        dataSource={agents}
        renderItem={renderAgentItem}
        locale={{
          emptyText: t('agent.empty')
        }}
      />
    </Card>
  )
} 