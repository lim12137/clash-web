"use client"

import { createContext, useReducer, useEffect, useContext, ReactNode, useCallback, useMemo } from "react"
import { configStore } from "@/lib/config"
import knowledgeBaseService from "@/services/knowledgeBaseService"
import { KnowledgeBase } from "@/types/knowledgeBase"

// State type definition
interface KnowledgeBaseState {
  knowledgeBases: KnowledgeBase[];
  selectedIds: string[];
  activeKnowledgeBase: KnowledgeBase | null;
  currentEmbeddingModel: string | null;
  isLoading: boolean;
  error: string | null;
}

// Action type definition
type KnowledgeBaseAction = 
  | { type: 'FETCH_SUCCESS', payload: KnowledgeBase[] }
  | { type: 'SELECT_KNOWLEDGE_BASE', payload: string[] }
  | { type: 'SET_ACTIVE', payload: KnowledgeBase | null }
  | { type: 'SET_MODEL', payload: string | null }
  | { type: 'DELETE_KNOWLEDGE_BASE', payload: string }
  | { type: 'ADD_KNOWLEDGE_BASE', payload: KnowledgeBase }
  | { type: 'LOADING', payload: boolean }
  | { type: 'ERROR', payload: string };

// Reducer function
const knowledgeBaseReducer = (state: KnowledgeBaseState, action: KnowledgeBaseAction): KnowledgeBaseState => {
  switch (action.type) {
    case 'FETCH_SUCCESS':
      return {
        ...state,
        knowledgeBases: action.payload,
        error: null
      };
    case 'SELECT_KNOWLEDGE_BASE':
      return {
        ...state,
        selectedIds: action.payload
      };
    case 'SET_ACTIVE':
      return {
        ...state,
        activeKnowledgeBase: action.payload
      };
    case 'SET_MODEL':
      return {
        ...state,
        currentEmbeddingModel: action.payload
      };
    case 'DELETE_KNOWLEDGE_BASE':
      return {
        ...state,
        knowledgeBases: state.knowledgeBases.filter(kb => kb.id !== action.payload),
        selectedIds: state.selectedIds.filter(id => id !== action.payload),
        activeKnowledgeBase: state.activeKnowledgeBase?.id === action.payload ? null : state.activeKnowledgeBase
      };
    case 'ADD_KNOWLEDGE_BASE':
      return {
        ...state,
        knowledgeBases: [...state.knowledgeBases, action.payload]
      };
    case 'LOADING':
      return {
        ...state,
        isLoading: action.payload
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
export const KnowledgeBaseContext = createContext<{
  state: KnowledgeBaseState;
  dispatch: React.Dispatch<KnowledgeBaseAction>;
  fetchKnowledgeBases: (skipHealthCheck?: boolean, shouldLoadSelected?: boolean) => Promise<void>;
  createKnowledgeBase: (name: string, description: string, source?: string) => Promise<KnowledgeBase | null>;
  deleteKnowledgeBase: (id: string) => Promise<boolean>;
  selectKnowledgeBase: (id: string) => void;
  setActiveKnowledgeBase: (kb: KnowledgeBase) => void;
  isKnowledgeBaseSelectable: (kb: KnowledgeBase) => boolean;
  refreshKnowledgeBaseData: (forceRefresh?: boolean) => Promise<void>;
  summaryIndex: (indexName: string, batchSize: number) => Promise<string>;
  changeSummary: (indexName: string, summary: string) => Promise<string>;
}>({
  state: {
    knowledgeBases: [],
    selectedIds: [],
    activeKnowledgeBase: null,
    currentEmbeddingModel: null,
    isLoading: false,
    error: null
  },
  dispatch: () => {},
  fetchKnowledgeBases: async () => {},
  createKnowledgeBase: async () => null,
  deleteKnowledgeBase: async () => false,
  selectKnowledgeBase: () => {},
  setActiveKnowledgeBase: () => {},
  isKnowledgeBaseSelectable: () => false,
  refreshKnowledgeBaseData: async () => {},
  summaryIndex: async () => '',
  changeSummary: async () => '',
});

// Custom hook for using the context
export const useKnowledgeBaseContext = () => useContext(KnowledgeBaseContext);

// Provider component
interface KnowledgeBaseProviderProps {
  children: ReactNode;
}

export const KnowledgeBaseProvider: React.FC<KnowledgeBaseProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(knowledgeBaseReducer, {
    knowledgeBases: [],
    selectedIds: [],
    activeKnowledgeBase: null,
    currentEmbeddingModel: null,
    isLoading: false,
    error: null
  });
  
  // 判断知识库是否可选择 - memoized with useCallback
  const isKnowledgeBaseSelectable = useCallback((kb: KnowledgeBase): boolean => {
    // 如果没有设置当前embedding模型，则不可选择
    if (!state.currentEmbeddingModel) {
      return false;
    }
    // 只有当知识库的模型与当前模型完全匹配时，才可选择
    return kb.embeddingModel === state.currentEmbeddingModel;
  }, [state.currentEmbeddingModel]);

  // 加载知识库列表 - memoized with useCallback
  const fetchKnowledgeBases = useCallback(async (skipHealthCheck = true, shouldLoadSelected = false) => {
    // 如果已经在加载中，直接返回
    if (state.isLoading) {
      return;
    }

    dispatch({ type: 'LOADING', payload: true });
    try {
      let kbs: KnowledgeBase[] = [];
      
      // 如果skipHealthCheck为false，总是从服务器获取数据
      if (skipHealthCheck === false) {
        kbs = await knowledgeBaseService.getKnowledgeBases(false);
        
        // 如果成功获取到数据，更新缓存
        if (kbs.length > 0) {
          localStorage.setItem('preloaded_kb_data', JSON.stringify(kbs));
        } else {
          // 新增：即使是空列表也缓存起来，以减少请求
          localStorage.setItem('preloaded_kb_data_empty', Date.now().toString());
        }
      } else {
        // 首先尝试从预加载的缓存数据获取知识库列表
        if (typeof window !== 'undefined') {
          // 新增：检查是否有空知识库列表缓存
          const emptyKbDataTimestamp = localStorage.getItem('preloaded_kb_data_empty');
          if (emptyKbDataTimestamp) {
            // 检查空缓存是否在有效期内（30秒）
            const now = Date.now();
            const timestamp = parseInt(emptyKbDataTimestamp, 10);
            if (now - timestamp < 30000) { // 30秒缓存期
              kbs = [];
            } else {
              // 缓存已过期，清除
              localStorage.removeItem('preloaded_kb_data_empty');
            }
          }
          
          // 如果没有空列表缓存或已过期，则尝试获取正常缓存
          if (kbs.length === 0 && !emptyKbDataTimestamp) {
            const preloadedKbData = localStorage.getItem('preloaded_kb_data');
            if (preloadedKbData) {
              try {
                kbs = JSON.parse(preloadedKbData);
              } catch (e) {
                console.error("解析预加载知识库数据失败:", e);
              }
            }
          }
        }
        
        // 如果没有预加载数据，则从服务器获取
        if (kbs.length === 0 && !localStorage.getItem('preloaded_kb_data_empty')) {
          kbs = await knowledgeBaseService.getKnowledgeBases(true);
          
          // 如果成功获取到数据，更新缓存
          if (kbs.length > 0) {
            localStorage.setItem('preloaded_kb_data', JSON.stringify(kbs));
          } else {
            // 新增：即使是空列表也缓存起来，以减少请求
            localStorage.setItem('preloaded_kb_data_empty', Date.now().toString());
          }
        }
      }
      
      dispatch({ type: 'FETCH_SUCCESS', payload: kbs });
      
      // 如果需要加载已选中的知识库
      if (shouldLoadSelected && kbs.length > 0) {
        // 从配置中获取已选中的知识库名称
        const config = configStore.getDataConfig();
        if (config.selectedKbNames && config.selectedKbNames.length > 0) {
          // 根据名称找到对应的知识库ID
          const selectedIds = kbs
            .filter(kb => config.selectedKbNames.includes(kb.name))
            .map(kb => kb.id);
          
          if (selectedIds.length > 0) {
            dispatch({ type: 'SELECT_KNOWLEDGE_BASE', payload: selectedIds });
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch knowledge bases:', error);
      dispatch({ type: 'ERROR', payload: '加载知识库失败' });
    } finally {
      dispatch({ type: 'LOADING', payload: false });
    }
  }, [state.isLoading]);

  // 选择知识库 - memoized with useCallback
  const selectKnowledgeBase = useCallback((id: string) => {
    const kb = state.knowledgeBases.find((kb) => kb.id === id);
    if (!kb) return;

    // 检查模型兼容性
    if (!isKnowledgeBaseSelectable(kb)) {
      console.warn(`Cannot select knowledge base ${kb.name}, model mismatch`);
      return;
    }

    // 切换选择状态
    const isSelected = state.selectedIds.includes(id);
    const newSelectedIds = isSelected
      ? state.selectedIds.filter(kbId => kbId !== id)
      : [...state.selectedIds, id];
    
    // 准备名称、模型和来源数组
    const selectedNames = newSelectedIds.map(id => {
      const kb = state.knowledgeBases.find(kb => kb.id === id);
      return kb ? kb.name : '';
    }).filter(name => name !== '');

    const selectedModels = newSelectedIds.map(id => {
      const kb = state.knowledgeBases.find(kb => kb.id === id);
      return kb ? kb.embeddingModel : '';
    }).filter(model => model !== '');

    const selectedSources = newSelectedIds.map(id => {
      const kb = state.knowledgeBases.find(kb => kb.id === id);
      return kb ? kb.source : '';
    }).filter(source => source !== '');
    
    // 更新状态
    dispatch({ type: 'SELECT_KNOWLEDGE_BASE', payload: newSelectedIds });
    
    // 保存选择状态到配置
    configStore.updateDataConfig({
      selectedKbNames: selectedNames,
      selectedKbModels: selectedModels,
      selectedKbSources: selectedSources
    });
  }, [state.knowledgeBases, state.selectedIds, isKnowledgeBaseSelectable]);

  // 设置当前活动知识库 - memoized with useCallback
  const setActiveKnowledgeBase = useCallback((kb: KnowledgeBase) => {
    dispatch({ type: 'SET_ACTIVE', payload: kb });
  }, []);

  // 创建知识库 - memoized with useCallback
  const createKnowledgeBase = useCallback(async (name: string, description: string, source: string = "elasticsearch") => {
    try {
      const newKB = await knowledgeBaseService.createKnowledgeBase({
        name,
        description,
        source,
        embeddingModel: state.currentEmbeddingModel || "text-embedding-3-small"
      });
      
      // 更新知识库列表
      dispatch({ type: 'ADD_KNOWLEDGE_BASE', payload: newKB });
      return newKB;
    } catch (error) {
      console.error('创建知识库失败:', error);
      dispatch({ type: 'ERROR', payload: '创建知识库失败' });
      return null;
    }
  }, [state.currentEmbeddingModel]);

  // 删除知识库 - memoized with useCallback
  const deleteKnowledgeBase = useCallback(async (id: string) => {
    try {
      await knowledgeBaseService.deleteKnowledgeBase(id);
      
      // 更新知识库列表
      dispatch({ type: 'DELETE_KNOWLEDGE_BASE', payload: id });
      
      // 如果当前激活的知识库被删除，清除激活状态
      if (state.activeKnowledgeBase?.id === id) {
        dispatch({ type: 'SET_ACTIVE', payload: null });
      }
      
      // 更新选中的知识库列表
      const newSelectedIds = state.selectedIds.filter(kbId => kbId !== id);
      
      if (newSelectedIds.length !== state.selectedIds.length) {
        // 准备名称、模型和来源数组
        const selectedNames = newSelectedIds.map(id => {
          const kb = state.knowledgeBases.find(kb => kb.id === id);
          return kb ? kb.name : '';
        }).filter(name => name !== '');

        const selectedModels = newSelectedIds.map(id => {
          const kb = state.knowledgeBases.find(kb => kb.id === id);
          return kb ? kb.embeddingModel : '';
        }).filter(model => model !== '');

        const selectedSources = newSelectedIds.map(id => {
          const kb = state.knowledgeBases.find(kb => kb.id === id);
          return kb ? kb.source : '';
        }).filter(source => source !== '');
        
        // 更新配置
        configStore.updateDataConfig({
          selectedKbNames: selectedNames,
          selectedKbModels: selectedModels,
          selectedKbSources: selectedSources
        });
        dispatch({ type: 'SELECT_KNOWLEDGE_BASE', payload: newSelectedIds });
      }
      
      return true;
    } catch (error) {
      console.error('删除知识库失败:', error);
      dispatch({ type: 'ERROR', payload: '删除知识库失败' });
      return false;
    }
  }, [state.knowledgeBases, state.selectedIds, state.activeKnowledgeBase]);

  // 总结知识库内容 - memoized with useCallback
  const summaryIndex = useCallback(async (indexName: string, batchSize: number = 1000) => {
    try {
      const result = await knowledgeBaseService.summaryIndex(indexName, batchSize);
      return result;
    } catch (error) {
      dispatch({ type: 'ERROR', payload: error as Error });
      throw error;
    }
  }, []);

  // 修改知识库总结 - memoized with useCallback
  const changekKnowledgeSummary = useCallback(async (indexName: string, summary: string) => {
    try {
      const result = await knowledgeBaseService.changeSummary(indexName, summary);
      return result;
    } catch (error) {
      dispatch({ type: 'ERROR', payload: error as Error });
      throw error;
    }
  }, []);

  // 添加刷新知识库数据的函数
  const refreshKnowledgeBaseData = useCallback(async (forceRefresh = false) => {
    try {
      
      if (forceRefresh) {
        // 如果强制刷新，清除缓存并从服务器获取
        localStorage.removeItem('preloaded_kb_data');
        localStorage.removeItem('preloaded_kb_data_empty');
        await fetchKnowledgeBases(false, true);
        return;
      }
      
      // 获取最新知识库数据但不清除缓存
      const knowledgeBases = await knowledgeBaseService.getKnowledgeBases(true);
      
      // 更新知识库缓存
      if (knowledgeBases && knowledgeBases.length > 0) {
        localStorage.setItem('preloaded_kb_data', JSON.stringify(knowledgeBases));
        
        // 更新状态
        dispatch({ type: 'FETCH_SUCCESS', payload: knowledgeBases });
      } else {
        // 为空列表设置缓存
        localStorage.setItem('preloaded_kb_data_empty', Date.now().toString());
        dispatch({ type: 'FETCH_SUCCESS', payload: [] });
      }
    } catch (error) {
      console.error("刷新知识库数据失败:", error);
      dispatch({ type: 'ERROR', payload: '刷新知识库数据失败' });
    }
  }, [fetchKnowledgeBases]);

  // 初始加载数据 - with optimized dependencies
  useEffect(() => {
    // 初始加载时，获取当前的模型配置
    const loadInitialData = async () => {
      const modelConfig = configStore.getModelConfig();
      if (modelConfig.embedding?.modelName) {
        dispatch({ type: 'SET_MODEL', payload: modelConfig.embedding.modelName });
      }
      
      // 初始加载知识库列表
      fetchKnowledgeBases(true);
    };
    
    loadInitialData();
    
    // 监听embedding模型变化事件
    const handleEmbeddingModelChange = (e: CustomEvent) => {
      const newModel = e.detail.model || null;
      
      // 如果模型发生变化
      if (newModel !== state.currentEmbeddingModel) {
        dispatch({ type: 'SET_MODEL', payload: newModel });
        
        // 模型变化时重新加载知识库列表
        fetchKnowledgeBases(true);
      }
    };
    
    // 监听env配置变化事件
    const handleEnvConfigChanged = () => {
      // 重新加载与env相关的配置
      const newModelConfig = configStore.getModelConfig();
      if (newModelConfig.embedding?.modelName !== state.currentEmbeddingModel) {
        dispatch({ type: 'SET_MODEL', payload: newModelConfig.embedding?.modelName || null });
        
        // 模型变化时重新加载知识库列表
        fetchKnowledgeBases(true);
      }
    };
    
    // 监听知识库数据更新事件
    const handleKnowledgeBaseDataUpdated = (e: Event) => {
      
      // 检查是否需要强制从服务器获取数据
      const customEvent = e as CustomEvent;
      const forceRefresh = customEvent.detail?.forceRefresh === true;
      
      if (forceRefresh) {
        // 清除所有缓存，确保强制刷新时获取最新数据
        localStorage.removeItem('preloaded_kb_data');
        localStorage.removeItem('preloaded_kb_data_empty');
        fetchKnowledgeBases(false, true);
        return;
      }
      
      // 检查是否有预加载数据，如果有则使用，否则从服务器获取
      if (typeof window !== 'undefined') {
        // 先检查空列表缓存是否存在且有效
        const emptyKbDataTimestamp = localStorage.getItem('preloaded_kb_data_empty');
        if (emptyKbDataTimestamp) {
          // 检查空缓存是否在有效期内（30秒）
          const now = Date.now();
          const timestamp = parseInt(emptyKbDataTimestamp, 10);
          if (now - timestamp < 30000) { // 30秒缓存期
            dispatch({ type: 'FETCH_SUCCESS', payload: [] });
            return;
          } else {
            // 缓存已过期，清除
            localStorage.removeItem('preloaded_kb_data_empty');
          }
        }
        
        // 如果没有空列表缓存或已过期，尝试获取正常缓存
        const preloadedData = localStorage.getItem('preloaded_kb_data');
        if (preloadedData) {
          try {
            const knowledgeBases = JSON.parse(preloadedData);
            dispatch({ type: 'FETCH_SUCCESS', payload: knowledgeBases });
            return;
          } catch (e) {
            console.error("解析预加载数据失败:", e);
          }
        }
      }
      
      // 如果没有预加载数据或解析失败，则从服务器获取最新数据
      fetchKnowledgeBases(false, true);
    };
    
    window.addEventListener("embeddingModelChanged", handleEmbeddingModelChange as EventListener);
    window.addEventListener("configChanged", handleEnvConfigChanged as EventListener);
    window.addEventListener("knowledgeBaseDataUpdated", handleKnowledgeBaseDataUpdated as EventListener);
    
    return () => {
      window.removeEventListener("embeddingModelChanged", handleEmbeddingModelChange as EventListener);
      window.removeEventListener("configChanged", handleEnvConfigChanged as EventListener);
      window.removeEventListener("knowledgeBaseDataUpdated", handleKnowledgeBaseDataUpdated as EventListener);
    };
  }, [fetchKnowledgeBases]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    state,
    dispatch,
    fetchKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    selectKnowledgeBase,
    setActiveKnowledgeBase,
    isKnowledgeBaseSelectable,
    refreshKnowledgeBaseData,
    summaryIndex
  }), [
    state,
    fetchKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    selectKnowledgeBase,
    setActiveKnowledgeBase,
    isKnowledgeBaseSelectable,
    refreshKnowledgeBaseData,
    summaryIndex
  ]);
  
  return (
    <KnowledgeBaseContext.Provider value={contextValue}>
      {children}
    </KnowledgeBaseContext.Provider>
  );
}; 