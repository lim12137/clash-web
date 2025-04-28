// 预设的颜色选项
export const colorOptions = [
  "#2689cb", // Primary Blue
  "#1d56d0", // Secondary Blue
  "#1f9351", // Green
  "#a62719", // Red
  "#c3c01a", // Yellow
  "#7672ce", // Purple
  "#aeb6bf", // Gray
  "#273746", // Black
] as const;

// 预设图标配置
export const presetIcons = [
  { icon: "search", key: "search" as const },
  { icon: "keyboard", key: "keyboard" as const },
  { icon: "house-door", key: "houseDoor" as const },
  { icon: "lightbulb", key: "lightbulb" as const },
  { icon: "book", key: "book" as const },
  { icon: "envelope", key: "envelope" as const },
  { icon: "pen", key: "pen" as const },
  { icon: "globe2", key: "globe2" as const },
  { icon: "mortarboard", key: "mortarboard" as const },
  { icon: "display", key: "display" as const },
] as const;

// 类型定义
export type PresetIconKey = typeof presetIcons[number]["key"];
export type ColorOption = typeof colorOptions[number];

// 颜色提取结果接口
export interface ExtractedColors {
  mainColor?: string;
  secondaryColor?: string;
}
