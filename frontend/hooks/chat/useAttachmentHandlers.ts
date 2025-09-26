import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePreview } from '@/types/chat';
import { storageService } from '@/services/storageService';
import log from '@/lib/logger';

/**
 * Handle file upload
 * @param file Uploaded file
 * @param setFileUrls Callback function to set file URL
 * @param t Translation function
 * @returns File ID
 */
const handleFileUploadInternal = (
  file: File,
  setFileUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  t: any
): string => {
  const fileId = `file-${Date.now()}-${Math.random()
    .toString(36)
    .substring(7)}`;

  // If it is not an image type, create a file preview URL
  if (!file.type.startsWith("image/")) {
    const fileUrl = URL.createObjectURL(file);
    setFileUrls((prev) => ({ ...prev, [fileId]: fileUrl }));
  }

  return fileId;
};

/**
 * Handle image upload
 * @param file Uploaded image file
 * @param t Translation function
 */
const handleImageUploadInternal = (file: File, t: any): void => {
  // Image validation can be added here if needed
};

/**
 * Upload attachments to storage service
 * @param attachments Attachment list
 * @param t Translation function
 * @returns Uploaded file URLs and object names
 */
const uploadAttachmentsInternal = async (
  attachments: FilePreview[],
  t: any
): Promise<{
  uploadedFileUrls: Record<string, string>;
  objectNames: Record<string, string>;
  error?: string;
}> => {
  if (attachments.length === 0) {
    return { uploadedFileUrls: {}, objectNames: {} };
  }

  try {
    // Upload all files to storage service
    const uploadResult = await storageService.uploadFiles(
      attachments.map((attachment) => attachment.file)
    );

    // Handle upload results
    const uploadedFileUrls: Record<string, string> = {};
    const objectNames: Record<string, string> = {};

    if (uploadResult.success_count > 0) {
      uploadResult.results.forEach((result) => {
        if (result.success) {
          uploadedFileUrls[result.file_name] = result.url;
          objectNames[result.file_name] = result.object_name;
        }
      });
    }

    return { uploadedFileUrls, objectNames };
  } catch (error) {
    log.error(t("chatPreprocess.fileUploadFailed"), error);
    return {
      uploadedFileUrls: {},
      objectNames: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Create message attachment objects from attachment list
 * @param attachments Attachment list
 * @param uploadedFileUrls Uploaded file URLs
 * @param fileUrls File URL mapping
 * @returns Message attachment object array
 */
const createMessageAttachmentsInternal = (
  attachments: FilePreview[],
  uploadedFileUrls: Record<string, string>,
  fileUrls: Record<string, string>
): { type: string; name: string; size: number; url?: string }[] => {
  return attachments.map((attachment) => ({
    type: attachment.type,
    name: attachment.file.name,
    size: attachment.file.size,
    url:
      uploadedFileUrls[attachment.file.name] ||
      (attachment.type === "image"
        ? attachment.previewUrl
        : fileUrls[attachment.id]),
  }));
};

/**
 * Clean up attachment URLs
 * @param attachments Attachment list
 * @param fileUrls File URL mapping
 */
const cleanupAttachmentUrlsInternal = (
  attachments: FilePreview[],
  fileUrls: Record<string, string>
): void => {
  // Clean up attachment preview URLs
  attachments.forEach((attachment) => {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  });

  // Clean up other file URLs
  Object.values(fileUrls).forEach((url) => {
    URL.revokeObjectURL(url);
  });
};

/**
 * Hook for managing attachment-related operations
 * Handles file uploads, previews, and cleanup
 */
export function useAttachmentHandlers() {
  const { t } = useTranslation('common');
  
  // Attachment state management
  const [attachments, setAttachments] = useState<FilePreview[]>([]);
  const [fileUrls, setFileUrls] = useState<{ [id: string]: string }>({});
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Cleanup attachment URLs when component unmounts
  useEffect(() => {
    return () => {
      cleanupAttachmentUrlsInternal(attachments, fileUrls);
    };
  }, [attachments, fileUrls]);

  /**
   * Handle file upload
   * @param file The file to upload
   * @returns File ID for tracking
   */
  const handleFileUpload = useCallback((file: File): string => {
    try {
      const fileId = handleFileUploadInternal(file, setFileUrls, t);
      
      const newAttachment: FilePreview = {
        id: fileId,
        file,
        type: 'file',
        previewUrl: fileUrls[fileId] || ''
      };
      
      setAttachments(prev => [...prev, newAttachment]);
      
      return fileId;
    } catch (error) {
      log.error('File upload failed:', error);
      throw error;
    }
  }, [fileUrls, t]);

  /**
   * Handle image upload
   * @param file The image file to upload
   */
  const handleImageUpload = useCallback((file: File): string => {
    try {
      handleImageUploadInternal(file, t);
      
      const fileId = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const previewUrl = URL.createObjectURL(file);
      
      const newAttachment: FilePreview = {
        id: fileId,
        file,
        type: 'image',
        previewUrl
      };
      
      setAttachments(prev => [...prev, newAttachment]);
      setFileUrls(prev => ({ ...prev, [fileId]: previewUrl }));
      
      return fileId;
    } catch (error) {
      log.error('Image upload failed:', error);
      throw error;
    }
  }, [t]);

  /**
   * Handle attachment changes
   * @param newAttachments New attachment list
   */
  const handleAttachmentsChange = useCallback((newAttachments: FilePreview[]): void => {
    setAttachments(newAttachments);
  }, []);

  /**
   * Upload attachments to storage service
   * @returns Upload result with URLs and object names
   */
  const uploadAttachmentsToStorage = useCallback(async (): Promise<{
    uploadedFileUrls: Record<string, string>;
    objectNames: Record<string, string>;
    error?: string;
  }> => {
    if (attachments.length === 0) {
      return { uploadedFileUrls: {}, objectNames: {} };
    }

    try {
      const result = await uploadAttachmentsInternal(attachments, t);
      return result;
    } catch (error) {
      log.error('Attachment upload failed:', error);
      return {
        uploadedFileUrls: {},
        objectNames: {},
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [attachments, t]);

  /**
   * Create message attachments from current attachments
   * @param uploadedFileUrls Uploaded file URLs
   * @returns Message attachment objects
   */
  const createMessageAttachmentsFromCurrent = useCallback((
    uploadedFileUrls: Record<string, string>
  ) => {
    return createMessageAttachmentsInternal(attachments, uploadedFileUrls, fileUrls);
  }, [attachments, fileUrls]);

  /**
   * Clear all attachments
   */
  const clearAttachments = useCallback((): void => {
    setAttachments([]);
    // Clean up URLs
    Object.values(fileUrls).forEach((url) => {
      URL.revokeObjectURL(url);
    });
    setFileUrls({});
  }, [fileUrls]);

  /**
   * Handle image click for viewing
   * @param imageUrl URL of the image to view
   */
  const handleImageClick = useCallback((imageUrl: string): void => {
    setViewingImage(imageUrl);
  }, []);

  /**
   * Close image viewer
   */
  const closeImageViewer = useCallback((): void => {
    setViewingImage(null);
  }, []);

  return {
    // State
    attachments,
    fileUrls,
    viewingImage,
    
    // Actions
    handleFileUpload,
    handleImageUpload,
    handleAttachmentsChange,
    uploadAttachmentsToStorage,
    createMessageAttachmentsFromCurrent,
    clearAttachments,
    handleImageClick,
    closeImageViewer,
  };
}
