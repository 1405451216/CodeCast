import type { ReactNode } from 'react';

/**
 * ChatArea — 内容区域容器
 * 使用 minHeight: 0 确保 flex 子元素可以正确收缩，
 * overflow: hidden 裁剪溢出但允许子元素内部滚动（子元素需自行设 overflow: auto）
 */
export function ChatArea({ children }: { children: ReactNode }) {
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      // 确保子元素的 overflow:auto 能正确接收滚轮事件
    }}>
      {children}
    </div>
  );
}
