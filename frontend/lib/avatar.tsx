import { createAvatar } from '@dicebear/core';
import * as iconStyle from '@dicebear/icons';
import type { AppConfig } from '../types/config';
import { presetIcons } from "@/types/avatar"

// 基于种子的随机数生成器
class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    // 将字符串转换为数字种子
    this.seed = Array.from(seed).reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
  }

  // 生成0到1之间的随机数
  random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  // 生成指定范围内的随机整数
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}

// 直接生成头像 URI 并返回
export const generateAvatarUri = (icon: string, color: string, size: number = 30, scale: number = 80): string => {
  const selectedIcon = presetIcons.find(preset => preset.key === icon) || presetIcons[0];
  const mainColor = color.replace("#", "");
  const secondaryColor = generateComplementaryColor(mainColor);
  
  const avatar = createAvatar(iconStyle, {
    seed: selectedIcon.icon,
    backgroundColor: [mainColor, secondaryColor],
    backgroundType: ["gradientLinear"], 
    icon: [selectedIcon.key],
    scale: scale,
    size: size,
    radius: 50
  });
  
  return avatar.toDataUri();
};

// Helper function to get avatar URL based on configuration
export const getAvatarUrl = (config: AppConfig, size: number = 30, scale: number = 80): string => {
  if (config.iconType === "custom" && config.customIconUrl) {
    // Return custom image URL
    return config.customIconUrl;
  } else if (config.avatarUri) {
    // 如果存在预生成的 URI，直接返回
    return config.avatarUri;
  } else {
    // 默认返回第一个预设图标
    const defaultIcon = presetIcons[0];
    const mainColor = "235fe1";
    const secondaryColor = generateComplementaryColor(mainColor);

    const avatar = createAvatar(iconStyle, {
      seed: mainColor,
      backgroundColor: [mainColor, secondaryColor],
      backgroundType: ["gradientLinear"], 
      icon: [defaultIcon.key],
      scale: scale,
      size: size,
      radius: 50
    });

    return avatar.toDataUri();
  }
};

/**
 * 根据主色生成随机的配色
 * @param mainColor 主色（十六进制颜色值，可带可不带#前缀）
 * @returns 生成的副色（十六进制颜色值，不带#前缀）
 */
export const generateComplementaryColor = (mainColor: string): string => {
  // 移除可能存在的#前缀
  const colorHex = mainColor.replace('#', '');
  
  // 将十六进制颜色转换为RGB
  const r = parseInt(colorHex.substring(0, 2), 16);
  const g = parseInt(colorHex.substring(2, 4), 16);
  const b = parseInt(colorHex.substring(4, 6), 16);
  
  // 使用颜色值作为随机数种子
  const random = new SeededRandom(colorHex);
  
  // 生成随机变化方向（几种常见的变化模式）
  const variation = random.randomInt(0, 3);
  
  let newR = r, newG = g, newB = b;
  
  switch(variation) {
    case 0: // 调暗 - 生成更深的颜色
      newR = Math.max(0, r - 40 - random.randomInt(0, 30));
      newG = Math.max(0, g - 40 - random.randomInt(0, 30));
      newB = Math.max(0, b - 40 - random.randomInt(0, 30));
      break;
    case 1: // 调亮 - 生成更亮的颜色
      newR = Math.min(255, r + 40 + random.randomInt(0, 30));
      newG = Math.min(255, g + 40 + random.randomInt(0, 30));
      newB = Math.min(255, b + 40 + random.randomInt(0, 30));
      break;
    case 2: // 相似色 - 微调RGB中的一个或两个通道
      const channel = random.randomInt(0, 2);
      if (channel === 0) {
        newR = Math.min(255, Math.max(0, r + random.randomInt(0, 120) - 60));
      } else if (channel === 1) {
        newG = Math.min(255, Math.max(0, g + random.randomInt(0, 120) - 60));
      } else {
        newB = Math.min(255, Math.max(0, b + random.randomInt(0, 120) - 60));
      }
      break;
    case 3: // HSL调整 - 转HSL后调整色相
      const [h, s, l] = rgbToHsl(r, g, b);
      const newH = (h + 0.05 + random.random() * 0.2) % 1; // 调整色相±30-90度
      const [adjR, adjG, adjB] = hslToRgb(newH, s, l);
      newR = adjR;
      newG = adjG;
      newB = adjB;
      break;
  }
  
  // 确保RGB值在有效范围内
  newR = Math.min(255, Math.max(0, Math.round(newR)));
  newG = Math.min(255, Math.max(0, Math.round(newG)));
  newB = Math.min(255, Math.max(0, Math.round(newB)));
  
  // 转回十六进制
  return ((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1);
}

// 辅助函数: RGB转HSL
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch(max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    
    h /= 6;
  }
  
  return [h, s, l];
}

// 辅助函数: HSL转RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // 灰色
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * 从Dicebear生成的Data URI中提取主色和次色，预留给app名称使用
 * @param dataUri Dicebear生成的头像data URI
 * @returns 包含mainColor和secondaryColor的对象，颜色值不含#前缀
 */
export const extractColorsFromUri = (dataUri: string): { mainColor: string | null, secondaryColor: string | null } =>  {
  // 默认返回值
  const result = { 
    mainColor: "", 
    secondaryColor: "" 
  };
  
  try {
    // 检查是否是Data URI
    if (!dataUri || !dataUri.startsWith('data:')) {
      return result;
    }
    
    // 提取Base64或URL编码的内容
    let svgContent = '';
    if (dataUri.includes('base64')) {
      // 处理Base64编码
      const base64Content = dataUri.split(',')[1];
      svgContent = atob(base64Content); // 解码Base64
    } else {
      // 处理URL编码
      const uriContent = dataUri.split(',')[1];
      svgContent = decodeURIComponent(uriContent);
    }
    
    // 查找线性渐变定义
    const gradientMatch = svgContent.match(/<linearGradient[^>]*>([\s\S]*?)<\/linearGradient>/);
    if (!gradientMatch) {
      // 如果没有渐变，查找背景填充色
      const fillMatch = svgContent.match(/fill="(#[0-9a-fA-F]{6})"/);
      if (fillMatch && fillMatch[1]) {
        result.mainColor = fillMatch[1].replace('#', '');
      }
      return result;
    }
    
    // 提取渐变中的颜色
    const stopMatches = svgContent.matchAll(/<stop[^>]*stop-color="(#[0-9a-fA-F]{6})"[^>]*>/g);
    const colors: string[] = [];
    
    for (const match of stopMatches) {
      if (match[1]) {
        colors.push(match[1].replace('#', ''));
      }
    }
    
    // 通常第一个是主色，第二个是次色
    if (colors.length >= 1) {
      result.mainColor = colors[0];
    }
    if (colors.length >= 2) {
      result.secondaryColor = colors[1];
    }
    
  } catch (error) {
    console.error('提取颜色时出错:', error);
  }
  
  return result;
}