/**
 * 统一的Setup页面布局常量
 * 以第一页(config.tsx)的设计为标准
 */

// 页面级别容器配置
export const SETUP_PAGE_CONTAINER = {
  // 最大宽度约束
  MAX_WIDTH: "1920px",
  
  // 水平内边距 (对应 px-4)
  HORIZONTAL_PADDING: "16px",
  
  // 主要内容区域高度
  MAIN_CONTENT_HEIGHT: "77vh",
} as const;

// 两列布局响应式配置 (基于第一页的设计)
export const TWO_COLUMN_LAYOUT = {
  // Row/Col 间距配置
  GUTTER: [24, 16] as [number, number],
  
  // 响应式列比例
  LEFT_COLUMN: {
    xs: 24,
    md: 24,
    lg: 10,
    xl: 9,
    xxl: 8,
  },
  
  RIGHT_COLUMN: {
    xs: 24,
    md: 24, 
    lg: 14,
    xl: 15,
    xxl: 16,
  },
} as const;

// 三列布局响应式配置 (基于AgentConfig的设计，但统一高度)
export const THREE_COLUMN_LAYOUT = {
  // Row/Col 间距配置
  GUTTER: [12, 12] as [number, number],
  
  // 响应式列比例
  LEFT_COLUMN: {
    xs: 24,
    md: 24,
    lg: 4,
    xl: 4,
  },
  
  MIDDLE_COLUMN: {
    xs: 24,
    md: 24,
    lg: 13,
    xl: 13,
  },
  
  RIGHT_COLUMN: {
    xs: 24,
    md: 24,
    lg: 7,
    xl: 7,
  },
} as const;

// Flex 两列布局配置 (基于KnowledgeBaseManager的设计)
export const FLEX_TWO_COLUMN_LAYOUT = {
  // 左侧知识库列表宽度
  LEFT_WIDTH: "33.333333%", // 1/3
  
  // 右侧内容区域宽度  
  RIGHT_WIDTH: "66.666667%", // 2/3
  
  // 列间距
  GAP: "12px",
} as const;

// 标准卡片样式配置 (基于第一页的设计)
export const STANDARD_CARD = {
  // 基础样式类名
  BASE_CLASSES: "bg-white border border-gray-200 rounded-md flex flex-col overflow-hidden",
  
  // 内边距
  PADDING: "16px", // 对应 p-4
  
  // 内容区域滚动配置
  CONTENT_SCROLL: {
    overflowY: "auto" as const,
    overflowX: "hidden" as const,
  },
} as const;

// 卡片头部配置
export const CARD_HEADER = {
  // 头部边距
  MARGIN_BOTTOM: "16px", // 对应 mb-4
  
  // 头部内边距
  PADDING: "0 8px", // 对应 px-2
  
  // 分割线样式
  DIVIDER_CLASSES: "h-[1px] bg-gray-200 mt-2",
} as const;

// 导出所有常量的类型定义
export type SetupPageContainer = typeof SETUP_PAGE_CONTAINER;
export type TwoColumnLayout = typeof TWO_COLUMN_LAYOUT;  
export type ThreeColumnLayout = typeof THREE_COLUMN_LAYOUT;
export type FlexTwoColumnLayout = typeof FLEX_TWO_COLUMN_LAYOUT;
export type StandardCard = typeof STANDARD_CARD;
export type CardHeader = typeof CARD_HEADER; 