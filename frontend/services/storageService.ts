import { API_ENDPOINTS } from './api';

interface StorageUploadResult {
  message: string;
  success_count: number;
  failed_count: number;
  results: {
    success: boolean;
    object_name: string;
    file_name: string;
    file_size: number;
    content_type: string;
    upload_time: string;
    url: string;
    error?: string;
  }[];
}

export const storageService = {
  /**
   * 上传文件到存储服务
   * @param files 要上传的文件列表
   * @param folder 可选的文件夹路径
   * @returns 上传结果
   */
  async uploadFiles(
    files: File[],
    folder: string = 'attachments'
  ): Promise<StorageUploadResult> {
    // 创建 FormData 对象
    const formData = new FormData();
    
    // 添加文件
    files.forEach(file => {
      formData.append('files', file);
    });
    
    // 添加文件夹参数
    formData.append('folder', folder);
    
    // 发送请求
    const response = await fetch(API_ENDPOINTS.storage.upload, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`上传文件失败: ${response.statusText}`);
    }
    
    return await response.json();
  },
  
  /**
   * 获取文件列表
   * @param prefix 可选的文件前缀
   * @param limit 返回的最大文件数量
   * @returns 文件列表
   */
  async getFiles(prefix: string = '', limit: number = 100): Promise<any> {
    const url = new URL(API_ENDPOINTS.storage.files, window.location.origin);
    url.searchParams.append('prefix', prefix);
    url.searchParams.append('limit', limit.toString());
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`获取文件列表失败: ${response.statusText}`);
    }
    
    return await response.json();
  },
  
  /**
   * 获取单个文件的URL
   * @param objectName 文件对象名称
   * @returns 文件URL
   */
  async getFileUrl(objectName: string): Promise<string> {
    const response = await fetch(API_ENDPOINTS.storage.file(objectName));
    
    if (!response.ok) {
      throw new Error(`获取文件URL失败: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.url;
  },
  
  /**
   * 删除文件
   * @param objectName 文件对象名称
   * @returns 删除结果
   */
  async deleteFile(objectName: string): Promise<any> {
    const response = await fetch(API_ENDPOINTS.storage.delete(objectName), {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`删除文件失败: ${response.statusText}`);
    }
    
    return await response.json();
  }
}; 