  /**
   * 将后端类型转换为前端类型
   * @param backendType 后端类型名称
   * @returns 对应的前端类型
   */
  export const convertParamType = (backendType: string): 'string' | 'number' | 'boolean' | 'array' | 'object' | 'OpenAIModel' | 'Optional' => {
    switch (backendType) {
      case 'string':
        return 'string';
      case 'integer':
      case 'float':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'object':
        return 'object';
      case 'Optional':
        return 'string'; 
      case 'OpenAIModel':
        return 'OpenAIModel';    
      default:
        console.warn(`未知类型: ${backendType}，使用string作为默认类型`);
        return 'string';
    }
  };
  