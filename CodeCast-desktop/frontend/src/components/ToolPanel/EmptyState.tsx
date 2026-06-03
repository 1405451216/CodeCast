import React from 'react';

export const EmptyState: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="empty-state">
    <div className="empty-state-title">{title}</div>
    {hint && <div className="empty-state-hint">{hint}</div>}
  </div>
);

export default EmptyState;
