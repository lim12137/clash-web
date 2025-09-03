import { API_ENDPOINTS } from './api';

import { fetchWithAuth } from '@/lib/auth';
// @ts-ignore
const fetch = fetchWithAuth;

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
   * Upload files to storage service
   * @param files List of files to upload
   * @param folder Optional folder path
   * @returns Upload result
   */
  async uploadFiles(
    files: File[],
    folder: string = 'attachments'
  ): Promise<StorageUploadResult> {
    // Create FormData object
    const formData = new FormData();
    
    // Add files
    files.forEach(file => {
      formData.append('files', file);
    });
    
    // Add folder parameter
    formData.append('folder', folder);
    
    // Send request
    const response = await fetch(API_ENDPOINTS.storage.upload, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload files to Minio: ${response.statusText}`);
    }
    
    return await response.json();
  },
  
  /**
   * Get the URL of a single file
   * @param objectName File object name
   * @returns File URL
   */
  async getFileUrl(objectName: string): Promise<string> {
    const response = await fetch(API_ENDPOINTS.storage.file(objectName));
    
    if (!response.ok) {
      throw new Error(`Failed to get file URL from Minio: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.url;
  }
}; 