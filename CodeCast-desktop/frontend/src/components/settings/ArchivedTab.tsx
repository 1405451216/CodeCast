import React, { useState, useEffect } from 'react';
import { ArchivedSession } from './settingsHelpers';
import * as api from '../../api';

const ArchivedTab: React.FC = () => {
  const [archivedSessions, setArchivedSessions] = useState<ArchivedSession[]>([]);

  useEffect(() => {
    const loadArchivedSessions = async () => {
      try {
        const archived = await api.getArchivedSessions();
        if (Array.isArray(archived)) setArchivedSessions(archived);
      } catch (e) { /* ignore */ }
    };
    loadArchivedSessions();
  }, []);

  return (
    <div className="stab-panel">
      <div className="settings-section-title">已归档对话</div>

      <div className="settings-group">
        <div className="domain-list">
          {archivedSessions.length === 0 ? (
            <div className="empty-hint">暂无已归档对话</div>
          ) : (
            archivedSessions.map((s) => (
              <div className="domain-item" key={s.ID}>
                <span>{s.Name || s.ID}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {s.CreatedAt ? new Date(s.CreatedAt).toLocaleDateString() : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchivedTab;
