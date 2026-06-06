// frontend/src/v2/i18n-keys/en.ts
export const v2en = {
  composer: { placeholder: 'Send message · ⌘⇧P toggle Plan mode', send: 'Send', cancel: 'Cancel', plan: 'Plan' },
  empty: { title: 'What will you do today?', hints: ['/weekly-report', '/translate', '/note', '/schedule', '/pomodoro'] },
  approval: { approve: 'Approve', reject: 'Reject', prompt: (tool: string, target: string) => `Approve ${tool} on ${target}?` },
  errors: { streamInterrupted: 'Stream interrupted (60s no chunk)', retry: 'Resume', toolFailed: (name: string) => `Tool ${name} failed` },
  drawer: { tabs: { files: 'Files', git: 'Git', mcp: 'MCP', memory: 'Memory' } },
  cast: { writing: 'Writing', translation: 'Translation', knowledge: 'Knowledge', schedule: 'Schedule', email: 'Email', tools: 'Tools' },
};
