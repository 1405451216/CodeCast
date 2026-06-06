import type { MenuItem } from './MenuPanel';

/**
 * CodeCast 主菜单结构
 *  - 文件 / 编辑 / 查看 / 开发者 / 帮助
 *  - 完整复刻 Claude Code 风格
 */
export const mainMenu: MenuItem[] = [
  {
    kind: 'submenu',
    id: 'file',
    label: '文件',
    children: [
      { kind: 'action', id: 'new', label: '新对话', shortcut: 'Ctrl+N' },
      { kind: 'action', id: 'settings', label: '设置…', shortcut: 'Ctrl+逗号' },
      { kind: 'separator', id: 's1' },
      { kind: 'action', id: 'close-window', label: '关闭窗口', shortcut: 'Ctrl+W' },
      { kind: 'action', id: 'quit', label: '退出', shortcut: 'Ctrl+Q' },
    ],
  },
  {
    kind: 'submenu',
    id: 'edit',
    label: '编辑',
    children: [
      { kind: 'action', id: 'undo', label: '撤销', shortcut: 'Ctrl+Z' },
      { kind: 'action', id: 'redo', label: '重做', shortcut: 'Ctrl+Shift+Z' },
      { kind: 'separator', id: 's1' },
      { kind: 'action', id: 'cut', label: '剪切', shortcut: 'Ctrl+X' },
      { kind: 'action', id: 'copy', label: '复制', shortcut: 'Ctrl+C' },
      { kind: 'action', id: 'paste', label: '粘贴', shortcut: 'Ctrl+V' },
      { kind: 'action', id: 'select-all', label: '全选', shortcut: 'Ctrl+A' },
      { kind: 'separator', id: 's2' },
      { kind: 'action', id: 'find', label: '查找', shortcut: 'Ctrl+F' },
    ],
  },
  {
    kind: 'submenu',
    id: 'view',
    label: '查看',
    children: [
      { kind: 'action', id: 'reload', label: '重新加载', shortcut: 'Ctrl+R' },
      { kind: 'separator', id: 's1' },
      { kind: 'action', id: 'actual-size', label: '实际大小', shortcut: 'Ctrl+0' },
      { kind: 'action', id: 'zoom-in', label: '放大', shortcut: 'Ctrl++' },
      { kind: 'action', id: 'zoom-out', label: '缩小', shortcut: 'Ctrl+-' },
      { kind: 'separator', id: 's2' },
      { kind: 'action', id: 'copy-url', label: '复制 URL' },
    ],
  },
  {
    kind: 'submenu',
    id: 'developer',
    label: '开发者',
    children: [
      { kind: 'action', id: 'open-mcp-log', label: '打开 MCP 日志文件…' },
      { kind: 'action', id: 'reload-mcp', label: '重新加载 MCP 配置' },
      { kind: 'separator', id: 's1' },
      { kind: 'action', id: 'config-third-party', label: '配置第三方推理…' },
      { kind: 'separator', id: 's2' },
      {
        kind: 'submenu',
        id: 'extensions',
        label: '扩展',
        children: [
          { kind: 'action', id: 'ext-installed', label: '已安装的扩展' },
          { kind: 'action', id: 'ext-market', label: '扩展市场…' },
          { kind: 'separator', id: 'sx' },
          { kind: 'action', id: 'ext-install-local', label: '从本地文件安装…' },
        ],
      },
      { kind: 'separator', id: 's3' },
      { kind: 'action', id: 'open-app-config', label: '打开应用配置文件…' },
      { kind: 'action', id: 'open-dev-config', label: '打开开发者配置文件…' },
      { kind: 'separator', id: 's4' },
      { kind: 'action', id: 'show-devtools', label: '显示开发者工具', shortcut: 'Alt+Ctrl+I' },
      { kind: 'action', id: 'show-all-devtools', label: '显示所有开发者工具' },
      { kind: 'separator', id: 's5' },
      { kind: 'action', id: 'enable-main-debugger', label: 'Enable Main Process Debugger' },
      { kind: 'action', id: 'record-perf', label: 'Record Performance Trace' },
      { kind: 'action', id: 'heap-snapshot', label: 'Write Main Process Heap Snapshot' },
      { kind: 'action', id: 'record-mem', label: 'Record Memory Trace (auto-stop)' },
    ],
  },
  {
    kind: 'submenu',
    id: 'help',
    label: '帮助',
    children: [
      { kind: 'action', id: 'open-docs', label: '打开文档' },
      { kind: 'action', id: 'check-update', label: '检查更新…' },
      { kind: 'action', id: 'last-update-failed', label: '上次更新尝试失败…', disabled: true },
      { kind: 'separator', id: 's1' },
      {
        kind: 'submenu',
        id: 'troubleshoot',
        label: '故障排除',
        children: [
          { kind: 'action', id: 'reset-session', label: '重置当前会话' },
          { kind: 'action', id: 'clear-cache', label: '清除本地缓存…' },
          { kind: 'action', id: 'view-logs', label: '查看运行日志' },
          { kind: 'separator', id: 'st' },
          { kind: 'action', id: 'report-bug', label: '报告 Bug…' },
        ],
      },
      { kind: 'separator', id: 's2' },
      { kind: 'action', id: 'get-support', label: '获取支持' },
      { kind: 'action', id: 'about', label: '关于…' },
    ],
  },
];
