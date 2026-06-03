import React from 'react';

interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: string;
  action?: React.ReactNode;
}

/**
 * EmptyState 统一的空状态展示。
 * - icon: 大图标（emoji 或文字）
 * - title: 主标题
 * - hint: 灰色提示
 * - action: 可选的行动按钮/链接
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, hint, icon = '📭', action }) => (
  <div className="empty-state">
    <div className="empty-state-icon" aria-hidden="true">{icon}</div>
    <div className="empty-state-title">{title}</div>
    {hint && <div className="empty-state-hint">{hint}</div>}
    {action && <div className="empty-state-action">{action}</div>}
  </div>
);

export default EmptyState;
