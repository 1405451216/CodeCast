export const zhCN = {
  common: {
    loading: '加载中...',
    error: '发生错误',
    retry: '重试',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    close: '关闭',
    search: '搜索...',
    noResults: '未找到结果',
    back: '返回',
    next: '下一步',
    previous: '上一步'
  },
  app: {
    title: 'CodeCast',
    welcome: '欢迎使用 CodeCast',
    description: 'AI 驱动的代码助手'
  },
  sidebar: {
    newChat: '新对话',
    history: '历史记录',
    settings: '设置',
    plugins: '插件',
    automation: '自动化'
  },
  commandPalette: {
    placeholder: '输入命令搜索...',
    noResults: '未找到匹配的命令',
    recentUsed: '最近使用',
    navigation: '导航',
    actions: '操作',
    settings: '设置',
    aiFeatures: 'AI 功能',
    view: '视图',
    navigateHint: '↑↓ 导航 · ↵ 执行'
  },
  theme: {
    light: '浅色模式',
    dark: '深色模式',
    system: '跟随系统',
    accentColor: '强调色'
  },
  messages: {
    user: '用户',
    assistant: '助手',
    thinking: '思考中...',
    generating: '生成中...',
    copyCode: '复制代码',
    codeCopied: '已复制!',
    sendMessage: '发送消息 (Enter)',
    stopGeneration: '停止生成'
  },
  pwa: {
    install: '安装应用',
    installDescription: '将 CodeCast 安装到桌面，获得更好的体验',
    offline: '您当前处于离线模式',
    reconnect: '重新连接',
    updateAvailable: '有可用更新',
    updateNow: '立即更新'
  },
  settings: {
    title: '设置',
    general: '通用',
    appearance: '外观',
    language: '语言',
    about: '关于'
  }
};

export type TranslationKeys = typeof zhCN;