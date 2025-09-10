/**
 * Unified Setup page layout constants
 * Based on the design of the first page (config.tsx)
 */

// Header configuration
export const HEADER_CONFIG = {
  // Header height (including padding)
  HEIGHT: "64px",
  
  // Vertical padding
  VERTICAL_PADDING: "16px", // py-4
  
  // Horizontal padding
  HORIZONTAL_PADDING: "24px", // px-6
} as const;

// Footer configuration
export const FOOTER_CONFIG = {
  // Footer height (including padding)
  HEIGHT: "64px",
  
  // Vertical padding
  VERTICAL_PADDING: "16px", // py-4
  
  // Horizontal padding
  HORIZONTAL_PADDING: "16px", // px-4
} as const;

// Page level container configuration
export const SETUP_PAGE_CONTAINER = {
  // Maximum width constraint
  MAX_WIDTH: "1920px",
  
  // Horizontal padding (corresponding to px-4)
  HORIZONTAL_PADDING: "16px",
  
  // Main content area height
  MAIN_CONTENT_HEIGHT: "83vh",
} as const;

// Two column layout responsive configuration (based on the first page design)
export const TWO_COLUMN_LAYOUT = {
  // Row/Col spacing configuration
  GUTTER: [24, 16] as [number, number],
  
  // Responsive column ratio
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

// Flex two column layout configuration (based on the KnowledgeBaseManager design)
export const FLEX_TWO_COLUMN_LAYOUT = {
  // Left knowledge base list width
  LEFT_WIDTH: "33.333333%", // 1/3
  
  // Right content area width  
  RIGHT_WIDTH: "66.666667%", // 2/3
  
  // Column spacing
  GAP: "12px",
} as const;

// Standard card style configuration (based on the first page design)
export const STANDARD_CARD = {
  // Base style class name
  BASE_CLASSES: "bg-white border border-gray-200 rounded-md flex flex-col overflow-hidden",
  
  // Padding
  PADDING: "16px", // Corresponds to p-4
  
  // Content area scroll configuration
  CONTENT_SCROLL: {
    overflowY: "auto" as const,
    overflowX: "hidden" as const,
  },
} as const;

// Card header configuration
export const CARD_HEADER = {
  // Header margin
  MARGIN_BOTTOM: "16px", // Corresponds to mb-4
  
  // Header padding
  PADDING: "0 8px", // Corresponds to px-2
  
  // Divider style
  DIVIDER_CLASSES: "h-[1px] bg-gray-200 mt-2",
} as const;
