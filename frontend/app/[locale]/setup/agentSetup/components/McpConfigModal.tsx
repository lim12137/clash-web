"use client"

import { useState, useEffect } from 'react'
import { Modal, Button, Input, Table, message, Space, Typography, Card, Divider, Tag } from 'antd'
import { DeleteOutlined, EyeOutlined, PlusOutlined, LoadingOutlined, ExpandAltOutlined, CompressOutlined, RedoOutlined } from '@ant-design/icons'
import { getMcpServerList, addMcpServer, deleteMcpServer, getMcpTools, updateToolList, recoverMcpServers, McpServer, McpTool } from '@/services/mcpService'
import { useTranslation } from 'react-i18next'

const { Text, Title } = Typography

interface McpConfigModalProps {
  visible: boolean
  onCancel: () => void
}

export default function McpConfigModal({ visible, onCancel }: McpConfigModalProps) {
  const { t } = useTranslation('common')
  const [serverList, setServerList] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(false)
  const [addingServer, setAddingServer] = useState(false)
  const [newServerName, setNewServerName] = useState('')
  const [newServerUrl, setNewServerUrl] = useState('')
  const [toolsModalVisible, setToolsModalVisible] = useState(false)
  const [currentServerTools, setCurrentServerTools] = useState<McpTool[]>([])
  const [currentServerName, setCurrentServerName] = useState('')
  const [loadingTools, setLoadingTools] = useState(false)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  const [recovering, setRecovering] = useState(false)
  const [updatingTools, setUpdatingTools] = useState(false)

  // 加载MCP服务器列表
  const loadServerList = async () => {
    setLoading(true)
    try {
      const result = await getMcpServerList()
      if (result.success) {
        setServerList(result.data)
      } else {
        message.error(result.message)
      }
    } catch (error) {
      message.error(t('mcpConfig.message.loadServerListFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 添加MCP服务器
  const handleAddServer = async () => {
    if (!newServerName.trim() || !newServerUrl.trim()) {
      message.error(t('mcpConfig.message.completeServerInfo'))
      return
    }

    // 验证服务器名称格式
    const serverName = newServerName.trim()
    const nameRegex = /^[a-zA-Z0-9]+$/
    
    if (!nameRegex.test(serverName)) {
      message.error(t('mcpConfig.message.invalidServerName'))
      return
    }
    
    if (serverName.length > 20) {
      message.error(t('mcpConfig.message.serverNameTooLong'))
      return
    }

    // 检查是否已存在相同的服务器
    const exists = serverList.some(
      server => server.service_name === serverName || server.mcp_url === newServerUrl.trim()
    )
    if (exists) {
      message.error(t('mcpConfig.message.serverExists'))
      return
    }

    setAddingServer(true)
    try {
      const result = await addMcpServer(newServerUrl.trim(), serverName)
      if (result.success) {
        message.success(t('mcpConfig.message.addServerSuccess'))
        setNewServerName('')
        setNewServerUrl('')
        await loadServerList() // 重新加载列表
        
        // 设置工具更新状态并自动刷新工具列表
        setUpdatingTools(true)
        try {
          const updateResult = await updateToolList()
          if (updateResult.success) {
            message.success(t('mcpConfig.message.addServerSuccessToolsUpdated'))
            // 通知父组件更新工具列表
            window.dispatchEvent(new CustomEvent('toolsUpdated'))
          } else {
            message.warning(t('mcpConfig.message.addServerSuccessToolsFailed'))
          }
        } catch (updateError) {
          console.log(t('mcpConfig.debug.autoUpdateToolsFailed'), updateError)
          message.warning(t('mcpConfig.message.addServerSuccessToolsFailed'))
        } finally {
          setUpdatingTools(false)
        }
      } else {
        message.error(result.message)
      }
    } catch (error) {
      message.error(t('mcpConfig.message.addServerFailed'))
    } finally {
      setAddingServer(false)
    }
  }

  // 删除MCP服务器
  const handleDeleteServer = async (server: McpServer) => {
    Modal.confirm({
      title: t('mcpConfig.delete.confirmTitle'),
      content: t('mcpConfig.delete.confirmContent', { name: server.service_name }),
      okType: 'danger',
      cancelButtonProps: { disabled: updatingTools },
      okButtonProps: { disabled: updatingTools, loading: updatingTools },
      onOk: async () => {
        try {
          const result = await deleteMcpServer(server.mcp_url, server.service_name)
          if (result.success) {
            message.success(t('mcpConfig.message.deleteServerSuccess'))
            await loadServerList() // 重新加载列表
            
            // 删除成功后立即关闭确认弹窗，然后异步更新工具列表
            setTimeout(async () => {
              message.info(t('mcpConfig.message.updatingToolsList'))
              setUpdatingTools(true)
              try {
                const updateResult = await updateToolList()
                if (updateResult.success) {
                  message.success(t('mcpConfig.message.toolsListUpdated'))
                  // 通知父组件更新工具列表
                  window.dispatchEvent(new CustomEvent('toolsUpdated'))
                } else {
                  message.warning(t('mcpConfig.message.toolsListUpdateFailed'))
                }
              } catch (updateError) {
                console.log(t('mcpConfig.debug.autoUpdateToolsFailed'), updateError)
                message.warning(t('mcpConfig.message.toolsListUpdateFailed'))
              } finally {
                setUpdatingTools(false)
              }
            }, 100) // 给确认弹窗关闭一点时间
          } else {
            message.error(result.message)
          }
        } catch (error) {
          message.error(t('mcpConfig.message.deleteServerFailed'))
        }
      }
    })
  }

  // 查看服务器工具
  const handleViewTools = async (server: McpServer) => {
    setCurrentServerName(server.service_name)
    setLoadingTools(true)
    setToolsModalVisible(true)
    setExpandedDescriptions(new Set()) // 重置展开状态
    
    try {
      const result = await getMcpTools(server.service_name, server.mcp_url)
      if (result.success) {
        setCurrentServerTools(result.data)
      } else {
        message.error(result.message)
        setCurrentServerTools([])
      }
    } catch (error) {
      message.error(t('mcpConfig.message.getToolsFailed'))
      setCurrentServerTools([])
    } finally {
      setLoadingTools(false)
    }
  }

  // 切换描述展开状态
  const toggleDescription = (toolName: string) => {
    const newExpanded = new Set(expandedDescriptions)
    if (newExpanded.has(toolName)) {
      newExpanded.delete(toolName)
    } else {
      newExpanded.add(toolName)
    }
    setExpandedDescriptions(newExpanded)
  }

  // 重新挂载所有MCP服务器
  const handleRecoverServers = async () => {
    setRecovering(true)
    try {
      const result = await recoverMcpServers()
      if (result.success) {
        message.success(t('mcpConfig.message.remountSuccess'))
      } else {
        message.error(result.message)
      }
    } catch (error) {
      message.error(t('mcpConfig.message.remountFailed'))
    } finally {
      try {
        // 不论挂载成功还是失败，都重新加载服务器列表以获取最新状态
        await loadServerList()
        
        // 不论挂载成功还是失败，都更新工具列表并通知工具池刷新
        setUpdatingTools(true)
        try {
          const updateResult = await updateToolList()
          if (updateResult.success) {
            message.success(t('mcpConfig.message.toolsListUpdated'))
            // 通知父组件更新工具列表
            window.dispatchEvent(new CustomEvent('toolsUpdated'))
          } else {
            message.warning(t('mcpConfig.message.toolsListUpdateFailed'))
          }
        } catch (updateError) {
          console.log(t('mcpConfig.debug.autoUpdateToolsFailed'), updateError)
          message.warning(t('mcpConfig.message.toolsListUpdateFailed'))
        } finally {
          setUpdatingTools(false)
        }
      } catch (finalError) {
        console.error('重新挂载后的清理操作失败:', finalError)
      } finally {
        setRecovering(false)
      }
    }
  }

  // 服务器列表表格列定义
  const columns = [
    {
      title: t('mcpConfig.serverList.column.name'),
      dataIndex: 'service_name',
      key: 'service_name',
      width: '25%',
      ellipsis: true,
      render: (text: string, record: McpServer) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: record.status ? '#52c41a' : '#ff4d4f',
              flexShrink: 0
            }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
        </div>
      ),
    },
    {
      title: t('mcpConfig.serverList.column.url'),
      dataIndex: 'mcp_url',
      key: 'mcp_url',
      width: '45%',
      ellipsis: true,
    },
    {
      title: t('mcpConfig.serverList.column.action'),
      key: 'action',
      width: '30%',
      render: (_: any, record: McpServer) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewTools(record)}
            size="small"
            disabled={updatingTools}
          >
            {t('mcpConfig.serverList.button.viewTools')}
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteServer(record)}
            size="small"
            disabled={updatingTools}
          >
            {t('mcpConfig.serverList.button.delete')}
          </Button>
        </Space>
      ),
    },
  ]

  // 工具列表表格列定义
  const toolColumns = [
    {
      title: t('mcpConfig.toolsList.column.name'),
      dataIndex: 'name',
      key: 'name',
      width: '30%',
    },
    {
      title: t('mcpConfig.toolsList.column.description'),
      dataIndex: 'description',
      key: 'description',
      width: '70%',
      render: (text: string, record: McpTool) => {
        const isExpanded = expandedDescriptions.has(record.name)
        const maxLength = 100 // 描述超过100字符时显示展开按钮
        const needsExpansion = text && text.length > maxLength
        
        return (
          <div>
            <div style={{ marginBottom: needsExpansion ? 8 : 0 }}>
              {needsExpansion && !isExpanded 
                ? `${text.substring(0, maxLength)}...` 
                : text}
            </div>
            {needsExpansion && (
              <Button
                type="link"
                size="small"
                icon={isExpanded ? <CompressOutlined /> : <ExpandAltOutlined />}
                onClick={() => toggleDescription(record.name)}
                style={{ padding: 0, height: 'auto' }}
              >
                {isExpanded ? t('mcpConfig.toolsList.button.collapse') : t('mcpConfig.toolsList.button.expand')}
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  // 打开弹窗时加载数据
  useEffect(() => {
    if (visible) {
      loadServerList()
    }
  }, [visible])

  return (
    <>
      <Modal
        title={t('mcpConfig.modal.title')}
        open={visible}
        onCancel={updatingTools ? undefined : onCancel}
        width={800}
        closable={!updatingTools}
        maskClosable={!updatingTools}
        footer={[
          <Button key="cancel" onClick={onCancel} disabled={updatingTools}>
            {updatingTools ? t('mcpConfig.modal.updatingTools') : t('mcpConfig.modal.close')}
          </Button>
        ]}
      >
        <div style={{ padding: '0 0 16px 0' }}>
          {/* 工具更新状态提示 */}
          {updatingTools && (
            <div style={{ 
              marginBottom: 16, 
              padding: 12, 
              backgroundColor: '#f6ffed', 
              border: '1px solid #b7eb8f', 
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center'
            }}>
              <LoadingOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              <Text style={{ color: '#52c41a' }}>{t('mcpConfig.status.updatingToolsHint')}</Text>
            </div>
          )}
          {/* 添加服务器区域 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            <Title level={5} style={{ margin: '0 0 12px 0' }}>
              <PlusOutlined style={{ marginRight: 8 }} />
              {t('mcpConfig.addServer.title')}
            </Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  placeholder={t('mcpConfig.addServer.namePlaceholder')}
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  style={{ flex: 1 }}
                  maxLength={20}
                  disabled={updatingTools || addingServer}
                />
                <Input
                  placeholder={t('mcpConfig.addServer.urlPlaceholder')}
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  style={{ flex: 2 }}
                  disabled={updatingTools || addingServer}
                />
                <Button
                  type="primary"
                  onClick={handleAddServer}
                  loading={addingServer || updatingTools}
                  icon={(addingServer || updatingTools) ? <LoadingOutlined /> : <PlusOutlined />}
                  disabled={updatingTools}
                >
                  {updatingTools ? t('mcpConfig.addServer.button.updating') : t('mcpConfig.addServer.button.add')}
                </Button>
              </div>
            </Space>
          </Card>

          <Divider style={{ margin: '16px 0' }} />

          {/* 服务器列表 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>
                {t('mcpConfig.serverList.title')}
              </Title>
              <Button
                type="text"
                size="small"
                icon={recovering ? <LoadingOutlined /> : <RedoOutlined />}
                onClick={handleRecoverServers}
                loading={recovering}
                disabled={recovering || loading || updatingTools}
                className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                title={t('mcpConfig.serverList.remountTitle')}
              >
                {t('mcpConfig.serverList.button.remount')}
              </Button>
            </div>
            <Table
              columns={columns}
              dataSource={serverList}
              rowKey={(record) => `${record.service_name}-${record.mcp_url}`}
              loading={loading}
              size="small"
              pagination={false}
              locale={{ emptyText: t('mcpConfig.serverList.empty') }}
              scroll={{ y: 300 }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>

      {/* 工具列表弹窗 */}
      <Modal
        title={`${currentServerName} - ${t('mcpConfig.toolsList.title')}`}
        open={toolsModalVisible}
        onCancel={() => setToolsModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setToolsModalVisible(false)}>
            {t('mcpConfig.modal.close')}
          </Button>
        ]}
      >
        <div style={{ padding: '0 0 16px 0' }}>
          {loadingTools ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} />
              <Text>{t('mcpConfig.toolsList.loading')}</Text>
            </div>
          ) : (
            <Table
              columns={toolColumns}
              dataSource={currentServerTools}
              rowKey="name"
              size="small"
              pagination={false}
              locale={{ emptyText: t('mcpConfig.toolsList.empty') }}
              scroll={{ y: 500 }}
              style={{ width: '100%' }}
            />
          )}
        </div>
      </Modal>
    </>
  )
}