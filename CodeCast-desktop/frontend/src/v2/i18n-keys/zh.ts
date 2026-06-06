export const v2zh = {
  composer: { placeholder: '发消息 · ⌘⇧P 切换 Plan 模式', send: '发送', cancel: '取消', plan: 'Plan' },
  empty: { title: '今天做什么？', hints: ['/写周报', '/翻译', '/笔记', '/日程', '/番茄钟'] },
  approval: { approve: '同意', reject: '拒绝', prompt: (tool: string, target: string) => `需要批准 ${tool} 操作 ${target}？` },
  errors: { streamInterrupted: '流式响应中断（60 秒无内容）', retry: '继续', toolFailed: (name: string) => `工具 ${name} 执行失败` },
  drawer: { tabs: { files: 'Files', git: 'Git', mcp: 'MCP', memory: 'Memory' } },
  cast: { writing: '写作', translation: '翻译', knowledge: '知识库', schedule: '日程', email: '邮件', tools: '工具箱' },
};
