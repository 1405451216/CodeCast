import type { ReactNode } from 'react';

interface Props {
  top: ReactNode;
  sidebar: ReactNode;
  chat: ReactNode;
  rightPanel?: ReactNode;
  bottom: ReactNode;
}

/**
 * Claude Code 风格 2 栏布局：
 *   - 顶栏 44px
 *   - 左侧 Sidebar 240px（固定）
 *   - 中间 Chat 居中（最大 760px）
 *   - 右侧浮动面板（可选，不占网格列，叠加在 Chat 上方）
 *   - 底栏 32px
 */
export function WorkspaceFrame({ top, sidebar, chat, rightPanel, bottom }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'var(--topbar-h) 1fr var(--bottombar-h)',
        gridTemplateColumns: 'var(--sidebar-w) 1fr',
        gridTemplateAreas: '"top top" "side chat" "bot bot"',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--c-bg)',
      }}
    >
      <div
        style={{
          gridArea: 'top',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-bg)',
          zIndex: 10,
        }}
      >
        {top}
      </div>
      <div
        style={{
          gridArea: 'side',
          borderRight: '1px solid var(--c-border)',
          overflow: 'hidden',
          background: 'var(--c-bg)',
        }}
      >
        {sidebar}
      </div>
      <div
        style={{
          gridArea: 'chat',
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--c-bg)',
        }}
      >
        {chat}
        {rightPanel}
      </div>
      <div
        style={{
          gridArea: 'bot',
          borderTop: '1px solid var(--c-border)',
          background: 'var(--c-bg)',
        }}
      >
        {bottom}
      </div>
    </div>
  );
}
