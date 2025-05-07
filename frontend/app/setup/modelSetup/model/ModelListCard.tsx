"use strict";
import { Select, Tooltip, Tag } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { ModelConnectStatus, ModelOption, ModelSource, ModelType } from '@/types/config'
import { useEffect, useState, useRef, useCallback } from 'react'
import { modelService } from '@/services/modelService'

// 重构：风格被嵌入在组件内
const pulsingAnimation = `
  @keyframes pulse {
    0% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(41, 128, 185, 0.7);
    }
    
    70% {
      transform: scale(1);
      box-shadow: 0 0 0 5px rgba(41, 128, 185, 0);
    }
    
    100% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(41, 128, 185, 0);
    }
  }
`;

const getStatusStyle = (status?: ModelConnectStatus): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    width: '12px',  // 扩大尺寸
    height: '12px', // 扩大尺寸
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '4px',
    cursor: 'pointer', // 添加指针样式表明可点击
    transition: 'all 0.2s ease', // 添加过渡效果
    position: 'relative', // 用于伪元素定位
  };
  
  if (status === "检测中") {
    return {
      ...baseStyle,
      backgroundColor: '#2980b9',
      boxShadow: '0 0 3px #2980b9',
      animation: 'pulse 1.5s infinite'
    };
  }
  
  return baseStyle;
};

const { Option } = Select

// 创建全局变量以确保多个组件实例共享同一个fetchTimestamp
let lastFetchTimestamp = 0;
// 全局请求标记，防止并发请求
let isFetching = false;
// 全局定时器引用
let globalTimerRef: NodeJS.Timeout | null = null;
// 全局注册表，存储所有ModelListCard实例的更新函数
type UpdateFunction = (data: ModelOption[]) => void;
const modelUpdateRegistry = new Map<string, UpdateFunction>();

// 全局函数：获取模型状态
const fetchModelStatus = async () => {
  // 如果距离上次请求不足2秒或者当前有正在进行的请求，则不执行
  const now = Date.now();
  if (now - lastFetchTimestamp < 2000 || isFetching) {
    return;
  }
  
  try {
    // 设置请求标志和时间戳
    isFetching = true;
    lastFetchTimestamp = now;
    
    // 使用modelService获取自定义模型列表，与ModelConfigSection共享同一逻辑
    const customModels = await modelService.getCustomModels();
    
    // 通知所有注册的组件更新
    if (customModels && customModels.length > 0) {
      
      // 检查各模型状态并记录
      const statusCounts = {
        "可用": 0,
        "不可用": 0,
        "检测中": 0,
        "未检测": 0,
        "未知": 0
      };
      
      customModels.forEach(model => {
        const status = model.connect_status || "未知";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      // 通知所有注册的组件更新
      modelUpdateRegistry.forEach((updateFn, instanceId) => {
        updateFn(customModels);
      });
    } else {
      console.warn("全局定时器：获取模型状态返回空数据");
    }
  } catch (error) {
    console.error("全局定时器：获取模型状态失败:", error);
  } finally {
    // 无论成功或失败，都清除请求标志
    isFetching = false;
  }
};

interface ModelListCardProps {
  type: ModelType
  modelId: string
  modelName: string
  selectedModel: string
  onModelChange: (value: string) => void
  officialModels: ModelOption[]
  customModels: ModelOption[]
  onVerifyModel?: (modelName: string, modelType: ModelType) => void // 新增验证模型的回调
  errorFields?: {[key: string]: boolean} // 新增错误字段状态
}

// 获取模型来源对应的标签样式
const getSourceTagStyle = (source: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    marginRight: '4px',
    fontSize: '12px',
    lineHeight: '16px',
    padding: '0 6px',
    borderRadius: '10px',
  };
  
  if (source === "ModelEngine") {
    return {
      ...baseStyle,
      color: '#1890ff',
      backgroundColor: '#e6f7ff',
      borderColor: '#91d5ff',
    };
  } else if (source === "自定义") {
    return {
      ...baseStyle,
      color: '#722ed1',
      backgroundColor: '#f9f0ff',
      borderColor: '#d3adf7',
    };
  } else {
    return {
      ...baseStyle,
      color: '#595959',
      backgroundColor: '#fafafa',
      borderColor: '#d9d9d9',
    };
  }
};

export const ModelListCard = ({
  type,
  modelId,
  modelName,
  selectedModel,
  onModelChange,
  officialModels,
  customModels,
  onVerifyModel,
  errorFields
}: ModelListCardProps) => {
  // 添加模型列表状态，用于更新
  const [modelsData, setModelsData] = useState({
    official: [...officialModels],
    custom: [...customModels]
  });

  // 组件唯一ID，用于注册表
  const instanceIdRef = useRef(`${type}-${modelId}-${Math.random().toString(36).substring(2, 9)}`);

  // 添加下拉框展开状态
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 在组件中创建一个style元素，包含动画定义
  useEffect(() => {
    // 创建style元素
    const styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.innerHTML = pulsingAnimation;
    document.head.appendChild(styleElement);

    // 清理函数，组件卸载时移除style元素
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // 获取模型列表时需要考虑具体的选项类型
  const getModelsBySource = (): Record<ModelSource, ModelOption[]> => {
    // 具体处理不同类型的模型获取逻辑
    return {
      official: modelsData.official.filter(model => model.type === type),
      custom: modelsData.custom.filter(model => model.type === type)
    }
  }

  // 获取模型来源
  const getModelSource = (modelName: string): string => {
    if (type === 'tts' || type === 'stt' || type === 'vlm') {
      const modelOfType = modelsData.custom.find((m) => m.type === type && m.name === modelName)
      if (modelOfType) return "自定义"
    }

    const officialModel = modelsData.official.find((m) => m.type === type && m.name === modelName)
    if (officialModel) return "ModelEngine"

    const customModel = modelsData.custom.find((m) => m.type === type && m.name === modelName)
    return customModel ? "自定义" : "未知来源"
  }

  // 获取连接状态对应的文字描述
  const getConnectStatusText = (status?: ModelConnectStatus): string => {
    if (!status) return "未知状态";
    return status;
  }

  // 获取连接状态指示器的颜色
  const getConnectStatusColor = (status?: ModelConnectStatus): string => {
    if (!status) return "#17202a";
    
    switch (status) {
      case "可用":
        return "#52c41a";
      case "不可用":
        return "#ff4d4f";
      case "检测中":
        return "#2980b9";
      case "未检测":
      default:
        return "#95a5a6";
    }
  }

  const modelsBySource = getModelsBySource()

  // 处理模型变更，需要清除连接状态样式
  const handleModelChange = (value: string) => {
    onModelChange(value)
  }

  // 更新当前组件的自定义模型状态
  const updateModelStatus = useCallback((apiData: any[]) => {
    // 获取当前组件关注的模型类型
    const currentType = type;
    
    // 过滤出当前组件关注的模型类型的数据
    const relevantModels = apiData.filter(m => 
      m.type === currentType || 
      m.model_type === currentType || 
      (currentType === 'vlm' && (m.type === 'vlm' || m.model_type === 'vlm'))
    );
    
    // 如果没有找到相关模型数据，则不更新
    if (relevantModels.length === 0) return;
    
    // 更新UI状态
    setModelsData(prevData => {
      const updatedCustomModels = prevData.custom.map(model => {
        // 查找对应的模型数据，注意字段映射关系
        const updatedModel = apiData.find(
          (m: any) => (m.name === model.name || m.model_name === model.name) && 
                      (m.type === model.type || m.model_type === model.type)
        );
        
        // 如果找到了模型更新信息
        if (updatedModel) {
          const newStatus = (updatedModel.connect_status as ModelConnectStatus) || model.connect_status || "未检测";
          
          return {
            ...model,
            connect_status: newStatus
          };
        }
        return model; // 没有找到对应的更新数据，保持原状态
      });
      
      // 保持官方模型不变
      return {
        official: prevData.official,
        custom: updatedCustomModels
      };
    });
  }, [type]);

  // 本地更新模型状态
  const updateLocalModelStatus = (modelName: string, status: ModelConnectStatus) => {
    setModelsData(prevData => {
      // 查找要更新的模型
      const modelToUpdate = prevData.custom.find(m => m.name === modelName && m.type === type);
      if (!modelToUpdate) {
        console.warn(`未找到要更新的模型: ${modelName}, 类型: ${type}`);
        return prevData;
      }
      
      const updatedCustomModels = prevData.custom.map(model => {
        if (model.name === modelName && model.type === type) {
          return {
            ...model,
            connect_status: status
          };
        }
        return model;
      });
      
      return {
        official: prevData.official,
        custom: updatedCustomModels
      };
    });
  };

  // 当父组件传入的模型列表更新时，更新本地状态
  useEffect(() => {
    // 输出当前自定义模型的状态以便调试
    if (customModels.length > 0) {
      const typeModels = customModels.filter(m => m.type === type);
    }
    
    // 更新本地状态，但不触发fetchModelsStatus
    setModelsData(prevData => {
      const updatedOfficialModels = officialModels.map(model => {
        // 保留已有的connect_status，如果存在的话
        const existingModel = prevData.official.find(m => m.name === model.name && m.type === model.type);
        return {
          ...model,
          connect_status: existingModel?.connect_status || "可用" as ModelConnectStatus
        };
      });
      
      const updatedCustomModels = customModels.map(model => {
        // 优先使用新传入的状态，这样能反映后端的最新状态
        return {
          ...model,
          connect_status: model.connect_status || "未检测" as ModelConnectStatus
        };
      });
      
      return {
        official: updatedOfficialModels,
        custom: updatedCustomModels
      };
    });
  }, [officialModels, customModels, type, modelId]);

  // 组件挂载时注册更新函数，组件卸载时注销
  useEffect(() => {
    const instanceId = instanceIdRef.current;
    
    // 注册更新函数
    modelUpdateRegistry.set(instanceId, updateModelStatus);
    
    // 组件卸载时清理
    return () => {
      modelUpdateRegistry.delete(instanceId);
    };
  }, [updateModelStatus]);

  // 处理状态指示灯点击事件
  const handleStatusClick = (e: React.MouseEvent, modelName: string) => {
    e.stopPropagation(); // 阻止事件冒泡
    e.preventDefault(); // 阻止默认行为
    e.nativeEvent.stopImmediatePropagation(); // 阻止所有同级事件处理程序
    
    if (onVerifyModel && modelName) {
      // 先更新本地状态为"检测中"
      updateLocalModelStatus(modelName, "检测中");
      // 然后调用验证函数
      onVerifyModel(modelName, type);
    }
    
    return false; // 确保不会继续冒泡
  };

  // 动态hover效果的样式
  const getHoverStyle = {
    transform: 'scale(1.2)', // hover时放大效果
    boxShadow: '0 0 5px currentColor', // 增加阴影效果
  };

  return (
    <div>
      <div className="font-medium mb-1.5 flex items-center justify-between">
        <div className="flex items-center">
          {modelName}
          {(modelName === "主模型" || modelName === "向量模型") && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </div>
        {selectedModel && (
          <div className="flex items-center">
            <Tag style={getSourceTagStyle(getModelSource(selectedModel))}>
              {getModelSource(selectedModel)}
            </Tag>
          </div>
        )}
      </div>
      <Select
        style={{ 
          width: "100%",
        }}
        placeholder="选择模型"
        value={selectedModel || undefined}
        onChange={handleModelChange}
        allowClear={{ 
          clearIcon: <CloseOutlined />,
        }}
        onClear={() => handleModelChange("")}
        size="middle"
        onClick={(e) => e.stopPropagation()}
        getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
        status={errorFields && errorFields[`${type}.${modelId}`] ? "error" : ""}
        className={errorFields && errorFields[`${type}.${modelId}`] ? "error-select" : ""}
        onDropdownVisibleChange={setIsDropdownOpen}
      >
        {modelsBySource.official.length > 0 && (
          <Select.OptGroup label="ModelEngine模型">
            {modelsBySource.official.map((model) => (
              <Option key={`${type}-${model.name}-official`} value={model.name}>
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate" title={model.name}>
                    {model.displayName || model.name}
                  </div>
                </div>
              </Option>
            ))}
          </Select.OptGroup>
        )}
        {modelsBySource.custom.length > 0 && (
          <Select.OptGroup label="自定义模型">
            {modelsBySource.custom.map((model) => (
              <Option key={`${type}-${model.displayName}-custom`} value={model.name}>
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate" title={model.name}>
                    {model.displayName || model.name}
                  </div>
                  <Tooltip title="点击可验证连通性">
                    <span 
                      onClick={(e) => handleStatusClick(e, model.name)}
                      onMouseDown={(e: React.MouseEvent) => {
                        e.stopPropagation(); 
                        e.preventDefault();
                        if (onVerifyModel) {
                          updateLocalModelStatus(model.name, "检测中");
                          onVerifyModel(model.name, type);
                        }
                        return false;
                      }}
                      style={{ 
                        ...getStatusStyle(model.connect_status),
                        backgroundColor: model.connect_status === "检测中" 
                          ? "#2980b9" 
                          : getConnectStatusColor(model.connect_status),
                        boxShadow: model.connect_status === "检测中"
                          ? "0 0 3px #2980b9"
                          : `0 0 3px ${getConnectStatusColor(model.connect_status)}`
                      }}
                      className="status-indicator"
                      onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        Object.assign(target.style, getHoverStyle);
                      }}
                      onMouseLeave={(e) => {
                        const target = e.currentTarget as HTMLElement;
                        target.style.transform = '';
                        target.style.boxShadow = model.connect_status === "检测中"
                          ? "0 0 3px #2980b9"
                          : `0 0 3px ${getConnectStatusColor(model.connect_status)}`;
                      }}
                    />
                  </Tooltip>
                </div>
              </Option>
            ))}
          </Select.OptGroup>
        )}
      </Select>
    </div>
  )
} 