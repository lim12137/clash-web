"use client"

import { createContext, useReducer, useContext, ReactNode, useCallback, useEffect } from "react"
import { Document } from "@/types/knowledgeBase"
import knowledgeBaseService from "@/services/knowledgeBaseService"

// Document state interface
interface DocumentState {
  documentsMap: Record<string, Document[]>;
  selectedIds: string[];
  uploadFiles: File[];
  isUploading: boolean;
  loadingKbIds: Set<string>;
  error: string | null;
}

// Document action type
type DocumentAction = 
  | { type: 'FETCH_SUCCESS', payload: { kbId: string, documents: Document[] } }
  | { type: 'SELECT_DOCUMENT', payload: string }
  | { type: 'SELECT_DOCUMENTS', payload: string[] }
  | { type: 'SELECT_ALL', payload: { kbId: string, selected: boolean } }
  | { type: 'SET_UPLOAD_FILES', payload: File[] }
  | { type: 'SET_UPLOADING', payload: boolean }
  | { type: 'DELETE_DOCUMENT', payload: { kbId: string, docId: string } }
  | { type: 'SET_LOADING_KB_ID', payload: { kbId: string, isLoading: boolean } }
  | { type: 'CLEAR_DOCUMENTS', payload?: undefined }
  | { type: 'ERROR', payload: string };

// Reducer function
const documentReducer = (state: DocumentState, action: DocumentAction): DocumentState => {
  switch (action.type) {
    case 'FETCH_SUCCESS':
      return {
        ...state,
        documentsMap: {
          ...state.documentsMap,
          [action.payload.kbId]: action.payload.documents
        },
        error: null
      };
    case 'SELECT_DOCUMENT':
      // Toggle document selection
      const docId = action.payload;
      const isSelected = state.selectedIds.includes(docId);
      return {
        ...state,
        selectedIds: isSelected
          ? state.selectedIds.filter(id => id !== docId)
          : [...state.selectedIds, docId]
      };
    case 'SELECT_DOCUMENTS':
      return {
        ...state,
        selectedIds: action.payload
      };
    case 'SELECT_ALL':
      const { kbId, selected } = action.payload;
      const documents = state.documentsMap[kbId] || [];
      
      // If selected is true, add all document IDs, else remove all
      const newSelectedIds = selected
        ? [...new Set([...state.selectedIds, ...documents.map(doc => doc.id)])]
        : state.selectedIds.filter(id => !documents.some(doc => doc.id === id));
      
      return {
        ...state,
        selectedIds: newSelectedIds
      };
    case 'SET_UPLOAD_FILES':
      return {
        ...state,
        uploadFiles: action.payload
      };
    case 'SET_UPLOADING':
      return {
        ...state,
        isUploading: action.payload
      };
    case 'DELETE_DOCUMENT':
      const { kbId: deleteKbId, docId: deleteDocId } = action.payload;
      // Remove the document from the map and the selected IDs
      return {
        ...state,
        documentsMap: {
          ...state.documentsMap,
          [deleteKbId]: state.documentsMap[deleteKbId]?.filter(doc => doc.id !== deleteDocId) || []
        },
        selectedIds: state.selectedIds.filter(id => id !== deleteDocId)
      };
    case 'SET_LOADING_KB_ID':
      const { kbId: loadingKbId, isLoading } = action.payload;
      const newLoadingKbIds = new Set(state.loadingKbIds);
      
      if (isLoading) {
        newLoadingKbIds.add(loadingKbId);
      } else {
        newLoadingKbIds.delete(loadingKbId);
      }
      
      return {
        ...state,
        loadingKbIds: newLoadingKbIds
      };
    case 'CLEAR_DOCUMENTS':
      return {
        ...state,
        documentsMap: {},
        selectedIds: []
      };
    case 'ERROR':
      return {
        ...state,
        error: action.payload
      };
    default:
      return state;
  }
};

// Create context with default values
export const DocumentContext = createContext<{
  state: DocumentState;
  dispatch: React.Dispatch<DocumentAction>;
  fetchDocuments: (kbId: string) => Promise<void>;
  uploadDocuments: (kbId: string, files: File[]) => Promise<void>;
  deleteDocument: (kbId: string, docId: string) => Promise<void>;
}>({
  state: {
    documentsMap: {},
    selectedIds: [],
    uploadFiles: [],
    isUploading: false,
    loadingKbIds: new Set<string>(),
    error: null
  },
  dispatch: () => {},
  fetchDocuments: async () => {},
  uploadDocuments: async () => {},
  deleteDocument: async () => {}
});

// Custom hook for using the context
export const useDocumentContext = () => useContext(DocumentContext);

// Provider component
interface DocumentProviderProps {
  children: ReactNode;
}

export const DocumentProvider: React.FC<DocumentProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(documentReducer, {
    documentsMap: {},
    selectedIds: [],
    uploadFiles: [],
    isUploading: false,
    loadingKbIds: new Set<string>(),
    error: null
  });

  // 监听文档更新事件
  useEffect(() => {
    const handleDocumentsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.kbId && customEvent.detail.documents) {
        const { kbId, documents } = customEvent.detail;
        
        // 直接更新文档信息
        dispatch({ 
          type: 'FETCH_SUCCESS', 
          payload: { kbId, documents } 
        });
      }
    };
    
    // 添加事件监听器
    window.addEventListener('documentsUpdated', handleDocumentsUpdated as EventListener);
    
    // 清理函数
    return () => {
      window.removeEventListener('documentsUpdated', handleDocumentsUpdated as EventListener);
    };
  }, []);

  // Fetch documents for a knowledge base
  const fetchDocuments = useCallback(async (kbId: string) => {
    // Skip if already loading this kb
    if (state.loadingKbIds.has(kbId)) return;
    
    // 首先检查是否已经在缓存中
    if (state.documentsMap[kbId] && state.documentsMap[kbId].length > 0) {
      return; // 如果已经有缓存数据，直接返回，不再请求服务器
    }
    
    dispatch({ type: 'SET_LOADING_KB_ID', payload: { kbId, isLoading: true } });
    
    try {
      const documents = await knowledgeBaseService.getDocuments(kbId);
      dispatch({ 
        type: 'FETCH_SUCCESS', 
        payload: { kbId, documents } 
      });
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      dispatch({ type: 'ERROR', payload: '加载文档失败' });
    } finally {
      dispatch({ type: 'SET_LOADING_KB_ID', payload: { kbId, isLoading: false } });
    }
  }, [state.loadingKbIds, state.documentsMap]);

  // Upload documents to a knowledge base
  const uploadDocuments = useCallback(async (kbId: string, files: File[]) => {
    dispatch({ type: 'SET_UPLOADING', payload: true });
    
    try {
      await knowledgeBaseService.uploadDocuments(kbId, files);
      
      // 上传完成后立即获取一次最新状态（使用forceRefresh参数）
      const latestDocuments = await knowledgeBaseService.getDocuments(kbId, true);
      
      // 更新文档状态
      dispatch({ 
        type: 'FETCH_SUCCESS', 
        payload: { kbId, documents: latestDocuments } 
      });
      
      // 触发文档状态更新事件，通知其他组件
      window.dispatchEvent(new CustomEvent('documentsUpdated', {
        detail: { 
          kbId,
          documents: latestDocuments 
        }
      }));
      
      // 清除上传文件
      dispatch({ type: 'SET_UPLOAD_FILES', payload: [] });
    } catch (error) {
      console.error('Failed to upload documents:', error);
      dispatch({ type: 'ERROR', payload: '上传文档失败' });
    } finally {
      dispatch({ type: 'SET_UPLOADING', payload: false });
    }
  }, []);

  // Delete a document
  const deleteDocument = useCallback(async (kbId: string, docId: string) => {
    try {
      await knowledgeBaseService.deleteDocument(docId, kbId);
      dispatch({ 
        type: 'DELETE_DOCUMENT', 
        payload: { kbId, docId } 
      });
    } catch (error) {
      console.error('Failed to delete document:', error);
      dispatch({ type: 'ERROR', payload: '删除文档失败' });
    }
  }, []);

  return (
    <DocumentContext.Provider 
      value={{ 
        state, 
        dispatch,
        fetchDocuments,
        uploadDocuments,
        deleteDocument,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}; 