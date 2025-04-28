interface ConfigData {
  appInfo: any
  dataPrep: any
  modelSelection: any
  agentConfig: any
}

const CONFIG_KEY = "agent_config"

export const storageService = {
  saveConfig: (config: ConfigData) => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
      return true
    } catch (error) {
      console.error("保存配置失败:", error)
      return false
    }
  },

  getConfig: (): ConfigData | null => {
    try {
      const config = localStorage.getItem(CONFIG_KEY)
      return config ? JSON.parse(config) : null
    } catch (error) {
      console.error("获取配置失败:", error)
      return null
    }
  },

  hasConfig: (): boolean => {
    return !!localStorage.getItem(CONFIG_KEY)
  },

  clearConfig: () => {
    localStorage.removeItem(CONFIG_KEY)
  },
}

