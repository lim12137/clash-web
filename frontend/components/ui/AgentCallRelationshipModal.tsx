"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, Spin, message, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { fetchAgentCallRelationship } from '@/services/agentConfigService'
import Tree from 'react-d3-tree';

const { Text } = Typography

interface Tool {
  tool_id: string
  name: string
  type: string
}

interface SubAgent {
  agent_id: string
  name: string
  tools: Tool[]
  sub_agents: SubAgent[]
  depth?: number
}

interface AgentCallRelationship {
  agent_id: string
  name: string
  tools: Tool[]
  sub_agents: SubAgent[]
}

interface AgentCallRelationshipModalProps {
  visible: boolean
  onClose: () => void
  agentId: number
  agentName: string
}

/** 与自定义节点视觉尺寸一致（方便连线在边缘收尾） */
const NODE_W = 140;
const NODE_H = 60;

// 颜色配置
const levelColors = {
  main: '#2c3e50',
  level1: '#3498db',
  level2: '#9b59b6',
  level3: '#e74c3c',
  level4: '#f39c12',
  tool1: '#e67e22',
  tool2: '#1abc9c',
  tool3: '#34495e',
  tool4: '#f1c40f'
};

// 获取节点颜色
const getNodeColor = (type: string, depth: number = 0) => {
  if (type === 'main') return levelColors.main;
  if (type === 'sub') {
    if (depth === 1) return levelColors.level1;
    if (depth === 2) return levelColors.level2;
    if (depth === 3) return levelColors.level3;
    if (depth === 4) return levelColors.level4;
    return levelColors.level1;
  }
  if (type === 'tool') {
    if (depth === 1) return levelColors.tool1;
    if (depth === 2) return levelColors.tool2;
    if (depth === 3) return levelColors.tool3;
    if (depth === 4) return levelColors.tool4;
    return levelColors.tool1;
  }
  return levelColors.main;
};

// 自定义节点 —— 居中对齐，统一字体样式
const CustomNode = ({ nodeDatum }: any) => {
  const isAgent = nodeDatum.type === 'main' || nodeDatum.type === 'sub';
  const color = getNodeColor(nodeDatum.type, nodeDatum.depth);
  const icon = isAgent ? '🤖' : '🔧';

  // 与 NODE_W/H 协同的小尺寸
  const textLength = nodeDatum.name.length;
  const nodeWidth  = Math.max(isAgent ? 110 : 92, Math.min(textLength * 8 + 36, NODE_W));
  const nodeHeight = isAgent ? 54 : 46;

  return (
    <g transform={`translate(-${nodeWidth / 2}, -${nodeHeight / 2})`}>
      <rect
        width={nodeWidth}
        height={nodeHeight}
        rx={isAgent ? 10 : 8}
        fill={`url(#grad-${color.replace('#', '')})`}
        stroke={`${color}80`}
        strokeWidth={1}
      />
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: `${color}20`, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: `${color}08`, stopOpacity: 1 }} />
        </linearGradient>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="3" floodColor="#000" floodOpacity="0.1" />
        </filter>
      </defs>

      <foreignObject
        x={0}
        y={0}
        width={nodeWidth}
        height={nodeHeight}
        style={{ overflow: 'visible' }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            color: '#1f2328',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'normal',
            textAlign: 'center',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {icon} {nodeDatum.name}
        </div>
      </foreignObject>
    </g>
  );
};

/** 让连线在节点边缘收尾：从父矩形下边缘到子矩形上边缘（纵向布局） */
const customPathFunc = (linkData: any, orientation: 'vertical' | 'horizontal') => {
  const { source, target } = linkData;

  if (orientation === 'horizontal') {
    const srcX = source.x + NODE_W / 2;
    const srcY = source.y;
    const tgtX = target.x - NODE_W / 2;
    const tgtY = target.y;
    const midX = (srcX + tgtX) / 2;
    return `M ${srcX} ${srcY} L ${midX} ${srcY} L ${midX} ${tgtY} L ${tgtX} ${tgtY}`;
  }

  // 垂直布局：从父节点底边 -> 中折点 -> 子节点顶边
  const srcX = source.x;
  const srcY = source.y + NODE_H / 2;
  const tgtX = target.x;
  const tgtY = target.y - NODE_H / 2;
  const midY = (srcY + tgtY) / 2;
  return `M ${srcX} ${srcY} L ${srcX} ${midY} L ${tgtX} ${midY} L ${tgtX} ${tgtY}`;
};

// 类型定义
interface TreeNodeDatum {
  name: string;
  type?: string;
  color?: string;
  count?: string;
  children?: TreeNodeDatum[];
  depth?: number;
  attributes?: { toolType?: string };
}

declare module 'react-d3-tree';

export default function AgentCallRelationshipModal({
  visible,
  onClose,
  agentId,
  agentName
}: AgentCallRelationshipModalProps) {
  const { t } = useTranslation('common')
  const [loading, setLoading] = useState(false)
  const [relationshipData, setRelationshipData] = useState<AgentCallRelationship | null>(null)

  const treeWrapRef = useRef<HTMLDivElement>(null);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 800, y: 120 });

  useEffect(() => {
    if (visible && agentId) {
      loadCallRelationship()
    }
  }, [visible, agentId])

  useEffect(() => {
    if (treeWrapRef.current && visible) {
      const { clientWidth } = treeWrapRef.current;
      const x = Math.round(clientWidth / 2);
      const y = 100;
      setTranslate({ x, y });
    }
  }, [visible]);

  const loadCallRelationship = async () => {
    setLoading(true)
    try {
      const result = await fetchAgentCallRelationship(agentId)
      if (result.success) {
        setRelationshipData(result.data)
      } else {
        message.error(result.message || '获取调用关系失败')
      }
    } catch (error) {
      console.error('获取Agent调用关系失败:', error)
      message.error('获取Agent调用关系失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 生成树形数据（保持你的写法）
  const generateTreeData = useCallback((data: AgentCallRelationship): TreeNodeDatum => {
    const centerX = 600;
    const startY = 50;
    const levelHeight = 180;
    const agentSpacing = 280;
    const toolSpacing = 180;

    const treeData: TreeNodeDatum = {
      name: data.name,
      type: 'main',
      depth: 0,
      color: levelColors.main,
      children: []
    };

    if (data.tools && data.tools.length > 0) {
      const toolsPerRow = Math.min(3, data.tools.length);
      const startX2 = centerX - (toolsPerRow - 1) * toolSpacing / 2;

      data.tools.forEach((tool, index) => {
        const row = Math.floor(index / toolsPerRow);
        const col = index % toolsPerRow;
        const x = startX2 + col * toolSpacing;
        const y = startY + levelHeight + row * 60;

        treeData.children!.push({
          name: tool.name,
          type: 'tool',
          depth: 1,
          color: levelColors.tool1,
          attributes: { toolType: tool.type },
          children: []
        });
      });
    };

    if (data.sub_agents && data.sub_agents.length > 0) {
      const startX3 = centerX - (data.sub_agents.length - 1) * agentSpacing / 2;

      data.sub_agents.forEach((subAgent, index) => {
        const x = startX3 + index * agentSpacing;
        const y = startY + levelHeight;

        const subAgentNode: TreeNodeDatum = {
          name: subAgent.name,
          type: 'sub',
          depth: subAgent.depth || 1,
          color: getNodeColor('sub', subAgent.depth || 1),
          children: []
        };

        if (subAgent.tools && subAgent.tools.length > 0) {
          const toolsPerRow = Math.min(2, subAgent.tools.length);
          const toolStartX = x - (toolsPerRow - 1) * toolSpacing / 2;

          subAgent.tools.forEach((tool, toolIndex) => {
            const row = Math.floor(toolIndex / toolsPerRow);
            const col = toolIndex % toolsPerRow;
            const toolX = toolStartX + col * toolSpacing;
            const toolY = y + levelHeight + row * 60;

            subAgentNode.children!.push({
              name: tool.name,
              type: 'tool',
              depth: (subAgent.depth || 1) + 1,
              color: getNodeColor('tool', (subAgent.depth || 1) + 1),
              attributes: { toolType: tool.type },
              children: []
            });
          });
        }

        if (subAgent.sub_agents && subAgent.sub_agents.length > 0) {
          subAgent.sub_agents.forEach((deepSubAgent) => {
            const deepSubAgentNode: TreeNodeDatum = {
              name: deepSubAgent.name,
              type: 'sub',
              depth: deepSubAgent.depth || 2,
              color: getNodeColor('sub', deepSubAgent.depth || 2),
              children: []
            };

            if (deepSubAgent.tools && deepSubAgent.tools.length > 0) {
              deepSubAgent.tools.forEach((tool) => {
                deepSubAgentNode.children!.push({
                  name: tool.name,
                  type: 'tool',
                  depth: (deepSubAgent.depth || 2) + 1,
                  color: getNodeColor('tool', (deepSubAgent.depth || 2) + 1),
                  attributes: { toolType: tool.type },
                  children: []
                });
              });
            }

            if (deepSubAgent.sub_agents && deepSubAgent.sub_agents.length > 0) {
              deepSubAgent.sub_agents.forEach((deeperSubAgent) => {
                const deeperSubAgentNode: TreeNodeDatum = {
                  name: deeperSubAgent.name,
                  type: 'sub',
                  depth: deeperSubAgent.depth || 3,
                  color: getNodeColor('sub', deeperSubAgent.depth || 3),
                  children: []
                };

                if (deeperSubAgent.tools && deeperSubAgent.tools.length > 0) {
                  deeperSubAgent.tools.forEach((tool) => {
                    deeperSubAgentNode.children!.push({
                      name: tool.name,
                      type: 'tool',
                      depth: (deeperSubAgent.depth || 3) + 1,
                      color: getNodeColor('tool', (deeperSubAgent.depth || 3) + 1),
                      attributes: { toolType: tool.type },
                      children: []
                    });
                  });
                }

                if (deeperSubAgent.sub_agents && deeperSubAgent.sub_agents.length > 0) {
                  deeperSubAgent.sub_agents.forEach((deepestSubAgent) => {
                    const deepestSubAgentNode: TreeNodeDatum = {
                      name: deepestSubAgent.name,
                      type: 'sub',
                      depth: deepestSubAgent.depth || 4,
                      color: getNodeColor('sub', deepestSubAgent.depth || 4),
                      children: []
                    };

                    if (deepestSubAgent.tools && deepestSubAgent.tools.length > 0) {
                      deepestSubAgent.tools.forEach((tool) => {
                        deepestSubAgentNode.children!.push({
                          name: tool.name,
                          type: 'tool',
                          depth: (deepestSubAgent.depth || 4) + 1,
                          color: getNodeColor('tool', (deepestSubAgent.depth || 4) + 1),
                          attributes: { toolType: tool.type },
                          children: []
                        });
                      });
                    }

                    if (deepestSubAgent.sub_agents && deepestSubAgent.sub_agents.length > 0) {
                      deepestSubAgent.sub_agents.forEach((level5SubAgent) => {
                        const level5SubAgentNode: TreeNodeDatum = {
                          name: level5SubAgent.name,
                          type: 'sub',
                          depth: level5SubAgent.depth || 5,
                          color: getNodeColor('sub', level5SubAgent.depth || 5),
                          children: []
                        };

                        if (level5SubAgent.tools && level5SubAgent.tools.length > 0) {
                          level5SubAgent.tools.forEach((tool) => {
                            level5SubAgentNode.children!.push({
                              name: tool.name,
                              type: 'tool',
                              depth: (level5SubAgent.depth || 5) + 1,
                              color: getNodeColor('tool', (level5SubAgent.depth || 5) + 1),
                              attributes: { toolType: tool.type },
                              children: []
                            });
                          });
                        }

                        if (level5SubAgent.sub_agents && level5SubAgent.sub_agents.length > 0) {
                          level5SubAgent.sub_agents.forEach((level6SubAgent) => {
                            const level6SubAgentNode: TreeNodeDatum = {
                              name: level6SubAgent.name,
                              type: 'sub',
                              depth: level6SubAgent.depth || 6,
                              color: getNodeColor('sub', level6SubAgent.depth || 6),
                              children: []
                            };

                            if (level6SubAgent.tools && level6SubAgent.tools.length > 0) {
                              level6SubAgent.tools.forEach((tool) => {
                                level6SubAgentNode.children!.push({
                                  name: tool.name,
                                  type: 'tool',
                                  depth: (level6SubAgent.depth || 6) + 1,
                                  color: getNodeColor('tool', (level6SubAgent.depth || 6) + 1),
                                  attributes: { toolType: tool.type },
                                  children: []
                                });
                              });
                            }

                            level5SubAgentNode.children!.push(level6SubAgentNode);
                          });
                        }

                        deepestSubAgentNode.children!.push(level5SubAgentNode);
                      });
                    }

                    deeperSubAgentNode.children!.push(deepestSubAgentNode);
                  });
                }

                deepSubAgentNode.children!.push(deeperSubAgentNode);
              });
            }

            subAgentNode.children!.push(deepSubAgentNode);
          });
        }

        treeData.children!.push(subAgentNode);
      });
    }

    return treeData;
  }, []);

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌳 Agent调用关系树</span>
            <Text type="secondary" style={{ fontSize: '14px', fontWeight: 'normal' }}>
              {agentName}
            </Text>
          </div>
        }
        open={visible}
        onCancel={onClose}
        footer={null}
        width={1800}
        destroyOnClose
        centered
        style={{ top: 20 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">正在加载调用关系...</Text>
            </div>
          </div>
        ) : relationshipData ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Text type="secondary">
                此流程图显示了 {relationshipData.name} 及其所有工具和协作Agent的调用关系
              </Text>
            </div>
            <div
              ref={treeWrapRef}
              style={{
                height: '900px',
                width: '100%',
                background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
                borderRadius: 16,
                overflow: 'hidden',
                padding: 0,
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
              }}
            >
              <Tree
                data={generateTreeData(relationshipData)}
                orientation="vertical"
                /** 自定义路径：线条在节点边缘结束，不再插到内部 */
                pathFunc={(linkData: any) => customPathFunc(linkData, 'vertical')}
                translate={translate}
                renderCustomNodeElement={CustomNode}
                depthFactor={140}
                separation={{ siblings: 1.3, nonSiblings: 1.6 }}
                nodeSize={{ x: NODE_W, y: NODE_H }}
                pathClassFunc={() => 'connection'}
                zoomable={true}
                scaleExtent={{ min: 0.7, max: 1.8 }}
                collapsible={false}
                initialDepth={undefined}
                enableLegacyTransitions={true}
                transitionDuration={250}
                /** 显式替换默认 label 为隐藏组件（确保不再渲染默认文本） */
                allowForeignObjects={true}
                nodeLabelComponent={{
                  render: <div style={{ display: 'none' }} />,
                  foreignObjectProps: { width: 0, height: 0, x: 0, y: 0 },
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">暂无调用关系数据</Text>
          </div>
        )}
      </Modal>

      <style jsx>{`
        .connection {
          stroke: #4a4a4a;
          stroke-width: 1.5;
          stroke-opacity: 0.9;
          fill: none;
          stroke-linecap: square;
          stroke-linejoin: miter;
          transition: stroke-width 0.2s, stroke-opacity 0.2s;
        }
        .connection:hover {
          stroke-opacity: 1;
          stroke-width: 2;
        }
        /* 双保险：强制隐藏库自带 label（不同版本类名可能不同） */
        :global(.rd3t-label),
        :global(.rd3t-label__title),
        :global(.rd3t-label__attributes) {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
        
        /* 确保SVG文本渲染一致 */
        :global(svg text) {
          text-rendering: optimizeSpeed !important;
        }
      `}</style>
    </>
  );
}

