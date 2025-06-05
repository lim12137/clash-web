import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 获取状态优先级
function getStatusPriority(status: string): number {
  switch (status) {
    case 'WAIT_FOR_PROCESSING': // 等待解析
      return 1;
    case 'PROCESSING': // 解析中
      return 2;
    case 'WAIT_FOR_FORWARDING': // 等待入库
      return 3;
    case 'FORWARDING': // 入库中
      return 4;
    case 'COMPLETED': // 解析完成
      return 5;
    case 'PROCESS_FAILED': // 解析失败
      return 6;
    case 'FORWARD_FAILED': // 入库失败
      return 7;
    default:
      return 8;
  }
}

// 按状态和日期排序
export function sortByStatusAndDate<T extends { status: string; create_time: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // 首先按状态优先级排序
    const statusPriorityA = getStatusPriority(a.status);
    const statusPriorityB = getStatusPriority(b.status);
    
    if (statusPriorityA !== statusPriorityB) {
      return statusPriorityA - statusPriorityB;
    }
    
    // 状态相同时，按日期排序（从新到旧）
    const dateA = new Date(a.create_time).getTime();
    const dateB = new Date(b.create_time).getTime();
    return dateB - dateA;
  });
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// 格式化日期时间
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return dateString;
  }
}
