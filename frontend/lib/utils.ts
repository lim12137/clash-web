import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Get status priority
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

// Sort by status and date
export function sortByStatusAndDate<T extends { status: string; create_time: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // First sort by status priority
    const statusPriorityA = getStatusPriority(a.status);
    const statusPriorityB = getStatusPriority(b.status);
    
    if (statusPriorityA !== statusPriorityB) {
      return statusPriorityA - statusPriorityB;
    }
    
    // When the status is the same, sort by date (from new to old)
    const dateA = new Date(a.create_time).getTime();
    const dateB = new Date(b.create_time).getTime();
    return dateB - dateA;
  });
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Format date time
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

// Format date
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return ""
    }
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    })
  } catch (error) {
    return ""
  }
}

// Format URL display
export interface SearchResultUrl {
  source_type?: string;
  url?: string;
  filename?: string;
}

export function formatUrl(result: SearchResultUrl): string {
  try {
    if (!result.source_type) return ""
    
    if (result.source_type === "url") {
      if (!result.url || result.url === "#") return ""
      return result.url.replace(/(^\w+:|^)\/\//, '').split('/')[0]
    } else if (result.source_type === "file") {
      if (!result.filename) return ""
      return result.filename
    }
    return ""
  } catch (error) {
    return ""
  }
}
