import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type {
  CollaborativeDocument,
  CollaborationRole,
  SyncStatus,
  ExportPackage,
  ActivityItem,
  CollabUser
} from '../../types/cast-collab';
import {
  COLLABORATION_ROLES,
  DOCUMENT_TYPE_ICONS,
  DOCUMENT_TYPE_LABELS
} from '../../types/cast-collab';
import { useCastCollabStore } from '../../store/useCastCollabStore';

interface InviteFormData {
  name: string;
  email: string;
  role: CollaborationRole;
}

const EMPTY_INVITE_FORM: InviteFormData = { name: '', email: '', role: 'editor' };

const ROLE_LABELS: Record<CollaborationRole, string> = {
  owner: '所有者',
  editor: '编辑者',
  commenter: '评论者',
  viewer: '查看者'
};

const SYNC_STATUS_CONFIG: Record<SyncStatus, { label: string; icon: string; color: string }> = {
  synced: { label: '已同步', icon: '✅', color: '#22c55e' },
  syncing: { label: '同步中...', icon: '🔄', color: '#3b82f6' },
  conflict: { label: '有冲突', icon: '⚠️', color: '#f59e0b' },
  offline: { label: '离线', icon: '📴', color: '#9ca3af' },
  error: { label: '错误', icon: '❌', color: '#ef4444' }
};

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

function formatActivityTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CollabPanel: React.FC = React.memo(() => {
  const {
    workspace,
    documents,
    members,
    activityFeed,
    isMultiWindowSyncEnabled,
    syncStatus,
    unresolvedConflicts,

    initWorkspace,
    updateWorkspace,
    addMember,
    removeMember,
    updateRole,
    createDoc,
    deleteDoc,
    acquireLock,
    releaseLock,
    hasLock,
    enableMultiWindowSync,
    disableMultiWindowSync,
    exportPackage,
    importPackage,
    generateInviteLink,
    loadFromStorage,
    clearAll
  } = useCastCollabStore();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>(EMPTY_INVITE_FORM);
  const [docTypeFilter, setDocTypeFilter] = useState<CollaborativeDocument['type'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWsName, setEditingWsName] = useState(false);
  const [wsNameInput, setWsNameInput] = useState('');
  const [exportSize, setExportSize] = useState<string>('');
  const [importResult, setImportResult] = useState<{ merged: number; conflicts: number; errors: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'documents' | 'sync' | 'activity'>('members');

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (workspace?.name && !wsNameInput) {
      setWsNameInput(workspace.name);
    }
  }, [workspace?.name]);

  const filteredDocs = useMemo(() => {
    let result = documents;
    if (docTypeFilter !== 'all') {
      result = result.filter(d => d.type === docTypeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [documents, docTypeFilter, searchQuery]);

  const handleInitWorkspace = useCallback(() => {
    initWorkspace('我的工作空间', 'CodeCast 本地协作空间');
  }, [initWorkspace]);

  const handleRenameWorkspace = useCallback(() => {
    if (wsNameInput.trim()) {
      updateWorkspace({ name: wsNameInput.trim() });
      setEditingWsName(false);
    }
  }, [wsNameInput, updateWorkspace]);

  const handleInviteSubmit = useCallback(() => {
    if (!inviteForm.name.trim()) return;
    addMember({
      name: inviteForm.name.trim(),
      email: inviteForm.email.trim() || undefined,
      role: inviteForm.role,
      color: `hsl(${Math.random() * 360}, 70%, 55%)`,
      permissions: []
    });
    setInviteForm(EMPTY_INVITE_FORM);
    setShowInviteModal(false);
  }, [inviteForm, addMember]);

  const handleExport = useCallback(async () => {
    const pkg = await exportPackage();
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cast-collab-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportSize(`${(blob.size / 1024).toFixed(1)}KB`);
  }, [exportPackage]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const pkg: ExportPackage = JSON.parse(text);
        const result = await importPackage(pkg);
        setImportResult(result);
      } catch {
        setImportResult({ merged: 0, conflicts: 0, errors: ['无效的同步包文件'] });
      }
    };
    input.click();
  }, [importPackage]);

  const handleCopyInviteLink = useCallback(() => {
    const link = generateInviteLink();
    navigator.clipboard.writeText(link || '');
  }, [generateInviteLink]);

  const handleCreateDoc = useCallback(() => {
    createDoc({
      type: 'document',
      title: '新文档',
      content: '',
      collaborators: [],
      metadata: {},
      tags: [],
      updatedBy: ''
    });
  }, [createDoc]);

  const handleToggleDocLock = useCallback((docId: string) => {
    const lockInfo = hasLock(docId);
    if (lockInfo) {
      releaseLock(docId);
    } else {
      acquireLock(docId);
    }
  }, [hasLock, releaseLock, acquireLock]);

  const syncConfig = SYNC_STATUS_CONFIG[syncStatus];

  if (!workspace) {
    return (
      <div className="cast-collab-panel">
        <div className="cast-collab-header">
          <span className="cast-collab-title-icon">👥</span>
          <h3>Cast 协作空间</h3>
        </div>
        <div className="cast-collab-empty">
          <div className="cast-collab-empty-icon">🤝</div>
          <p>尚未创建协作空间</p>
          <p className="cast-collab-empty-hint">
            创建本地协作空间，支持多窗口实时同步、导出/导入数据包、团队文档共享
          </p>
          <button className="cast-collab-btn cast-collab-btn-primary" onClick={handleInitWorkspace}>
            创建工作空间
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cast-collab-panel">
      <div className="cast-collab-header">
        <span className="cast-collab-title-icon">👥</span>
        <h3>Cast 协作空间</h3>
      </div>

      {/* Workspace Info Card */}
      <section className="cast-collab-section cast-collab-ws-info">
        <div className="cast-collab-ws-info-top">
          <div className="cast-collab-ws-name-area">
            <span className="cast-collab-folder-icon">📁</span>
            {editingWsName ? (
              <input
                className="cast-collab-input cast-collab-input-sm"
                value={wsNameInput}
                onChange={(e) => setWsNameInput(e.target.value)}
                onBlur={handleRenameWorkspace}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameWorkspace()}
                autoFocus
              />
            ) : (
              <span className="cast-collab-ws-name" onClick={() => setEditingWsName(true)}>
                {workspace.name}
              </span>
            )}
            <button
              className="cast-collab-icon-btn"
              onClick={() => setEditingWsName(true)}
              title="改名"
            >
              ✏️
            </button>
            <button
              className="cast-collab-icon-btn"
              onClick={handleCopyInviteLink}
              title="分享"
            >
              📤
            </button>
          </div>
        </div>

        <div className="cast-collab-ws-stats">
          <span className="cast-collab-stat">
            成员: <strong>{members.length} 人</strong>
          </span>
          <span className="cast-collab-stat">
            文档: <strong>{documents.length} 个</strong>
          </span>
          <span className="cast-collab-stat" style={{ color: syncConfig.color }}>
            状态: {syncConfig.icon} {syncConfig.label}
          </span>
          <label className="cast-collab-toggle-label">
            多窗口同步:
            <input
              type="checkbox"
              checked={isMultiWindowSyncEnabled}
              onChange={(e) => e.target.checked ? enableMultiWindowSync() : disableMultiWindowSync()}
              className="cast-collab-toggle"
            />
            <span className={`cast-collab-toggle-slider ${isMultiWindowSyncEnabled ? 'active' : ''}`}>
              {isMultiWindowSyncEnabled ? '开启' : '关闭'}
            </span>
          </label>
          <span className="cast-collab-stat">
            冲突: <strong style={{ color: unresolvedConflicts > 0 ? '#f59e0b' : '#22c55e' }}>{unresolvedConflicts}</strong>
          </span>
        </div>
      </section>

      {/* Tab Navigation */}
      <nav className="cast-collab-tabs">
        {([
          ['members', '团队成员'],
          ['documents', '共享文档'],
          ['sync', '同步控制'],
          ['activity', '活动动态']
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={`cast-collab-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <section className="cast-collab-section">
          <div className="cast-collab-member-list">
            {members.map(member => (
              <div key={member.id} className="cast-collab-member-row">
                <div className="cast-collab-member-avatar" style={{ backgroundColor: member.color }}>
                  {member.name.charAt(0)}
                </div>
                <div className="cast-collab-member-info">
                  <span className="cast-collab-member-name">
                    {member.name}
                    {member.id === workspace.ownerId && <span className="cast-collab-badge owner">(所有者)</span>}
                  </span>
                  <span className="cast-collab-role-badge" style={{ color: COLLABORATION_ROLES.find(r => r.key === member.role)?.color }}>
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
                <span className={`cast-collab-online-dot ${member.online ? 'online' : 'offline'}`} />
                <span className="cast-collab-online-text">{member.online ? '在线' : '离线'}</span>
                {member.id !== workspace.ownerId && (
                  <div className="cast-collab-member-actions">
                    <select
                      className="cast-collab-select-sm"
                      value={member.role}
                      onChange={(e) => updateRole(member.id, e.target.value as CollaborationRole)}
                    >
                      {COLLABORATION_ROLES.filter(r => r.key !== 'owner').map(r => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      className="cast-collab-btn-danger-sm"
                      onClick={() => removeMember(member.id)}
                      title="移除成员"
                    >
                      移除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            className="cast-collab-btn cast-collab-btn-outline"
            onClick={() => setShowInviteModal(true)}
          >
            + 邀请成员
          </button>
        </section>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <section className="cast-collab-section">
          <div className="cast-collab-doc-toolbar">
            <div className="cast-collab-doc-filters">
              <select
                className="cast-collab-select"
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value as typeof docTypeFilter)}
              >
                <option value="all">全部</option>
                {(Object.keys(DOCUMENT_TYPE_LABELS) as Array<keyof typeof DOCUMENT_TYPE_LABELS>).map(k => (
                  <option key={k} value={k}>{DOCUMENT_TYPE_ICONS[k]} {DOCUMENT_TYPE_LABELS[k]}</option>
                ))}
              </select>
              <input
                type="text"
                className="cast-collab-input cast-collab-input-search"
                placeholder="搜索文档..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="cast-collab-doc-actions">
              <button className="cast-collab-btn cast-collab-btn-primary-sm" onClick={handleCreateDoc}>
                + 新建文档
              </button>
              <button className="cast-collab-btn cast-collab-btn-outline-sm" onClick={handleImport}>
                📥 导入
              </button>
            </div>
          </div>

          <div className="cast-collab-doc-list">
            {filteredDocs.length === 0 ? (
              <div className="cast-collab-empty-list">暂无文档</div>
            ) : (
              filteredDocs.map(doc => {
                const lockInfo = hasLock(doc.id);
                const isLockedByMe = lockInfo?.userId === workspace.ownerId;
                const author = members.find(m => m.id === doc.updatedBy);
                return (
                  <div key={doc.id} className="cast-collab-doc-row">
                    <span className="cast-collab-doc-type-icon">{DOCUMENT_TYPE_ICONS[doc.type]}</span>
                    <div className="cast-collab-doc-info">
                      <span className="cast-collab-doc-title">{doc.title}</span>
                      <span className="cast-collab-doc-meta">
                        👤{author?.name ?? '未知'} &middot; v{doc.version} &middot; {formatTime(doc.updatedAt)}
                      </span>
                    </div>
                    <div className="cast-collab-doc-status">
                      {lockInfo ? (
                        <span className="cast-collab-lock-badge locked" title={`被 ${lockInfo.userId} 锁定`}>
                          🔒 已锁定
                        </span>
                      ) : (
                        <span className="cast-collab-lock-badge unlocked">✏️ 可编辑</span>
                      )}
                    </div>
                    <div className="cast-collab-doc-row-actions">
                      <button
                        className="cast-collab-icon-btn-sm"
                        onClick={() => handleToggleDocLock(doc.id)}
                        title={lockInfo ? '解锁' : '锁定'}
                      >
                        {lockInfo ? '🔓' : '🔒'}
                      </button>
                      <button
                        className="cast-collab-icon-btn-sm cast-collab-danger-hover"
                        onClick={() => deleteDoc(doc.id)}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Sync Control Tab */}
      {activeTab === 'sync' && (
        <section className="cast-collab-section">
          <div className="cast-collab-sync-group">
            <h4 className="cast-collab-subtitle">导出/导入同步</h4>
            <div className="cast-collab-sync-row">
              <div className="cast-collab-sync-item">
                <span className="cast-collab-sync-label">导出同步包:</span>
                <button className="cast-collab-btn cast-collab-btn-outline" onClick={handleExport}>
                  📦 导出JSON
                </button>
                {exportSize && <span className="cast-collab-sync-size">大小: ~{exportSize}</span>}
              </div>
              <div className="cast-collab-sync-item">
                <span className="cast-collab-sync-label">导入同步包:</span>
                <button className="cast-collab-btn cast-collab-btn-outline" onClick={handleImport}>
                  📥 选择文件
                </button>
                {importResult && (
                  <span className="cast-collab-import-result">
                    合并: {importResult.merged} | 冲突: {importResult.conflicts}
                    {importResult.errors.length > 0 && ` | 错误: ${importResult.errors.join(', ')}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="cast-collab-sync-group">
            <h4 className="cast-collab-subtitle">邀请链接</h4>
            <div className="cast-collab-sync-row">
              <button className="cast-collab-btn cast-collab-btn-outline" onClick={handleCopyInviteLink}>
                🔗 复制链接
              </button>
              <button className="cast-collab-btn cast-collab-btn-ghost" onClick={generateInviteLink}>
                🔄 刷新链接
              </button>
            </div>
          </div>

          <div className="cast-collab-sync-group">
            <h4 className="cast-collab-subtitle">共享设置</h4>
            <div className="cast-collab-settings-grid">
              {([
                ['sharedKnowledge', '共享知识库', workspace.sharedKnowledge],
                ['sharedSchedule', '共享日程', workspace.sharedSchedule],
                ['sharedMemory', '共享记忆', workspace.sharedMemory],
                ['allowComments', '允许评论', workspace.settings.allowComments],
                ['requireApproval', '需要审批', workspace.settings.requireApproval]
              ] as const).map(([key, label, value]) => (
                <label key={key} className="cast-collab-setting-toggle">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => {
                      if (key.startsWith('shared')) {
                        updateWorkspace({ [key]: e.target.checked } as Partial<typeof workspace>);
                      } else {
                        updateWorkspace({
                          settings: { ...workspace.settings, [key]: e.target.checked }
                        });
                      }
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="cast-collab-sync-group">
            <h4 className="cast-collab-subtitle">危险操作</h4>
            <button
              className="cast-collab-btn cast-collab-btn-danger"
              onClick={() => {
                if (confirm('确定要清除所有协作数据吗？此操作不可恢复。')) {
                  clearAll();
                }
              }}
            >
              清除所有协作数据
            </button>
          </div>
        </section>
      )}

      {/* Activity Feed Tab */}
      {activeTab === 'activity' && (
        <section className="cast-collab-section">
          <div className="cast-collab-activity-feed">
            {activityFeed.length === 0 ? (
              <div className="cast-collab-empty-list">暂无活动记录</div>
            ) : (
              activityFeed.map((item, idx) => (
                <div key={`${item.timestamp}-${idx}`} className="cast-collab-activity-item">
                  <span className="cast-collab-activity-time">[{formatActivityTime(item.timestamp)}]</span>
                  <span className="cast-collab-activity-user">{item.userName}</span>
                  <span className="cast-collab-activity-action">{item.action}</span>
                  {item.documentTitle && (
                    <span className="cast-collab-activity-doc">&quot;{item.documentTitle}&quot;</span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Security Notice */}
      <footer className="cast-collab-footer">
        <span className="cast-collab-security-icon">🔒</span>
        安全: 本地优先 · 数据不出设备 · 端到端加密可选
      </footer>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="cast-collab-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="cast-collab-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cast-collab-modal-header">
              <h4>邀请成员</h4>
              <button className="cast-collab-modal-close" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>
            <div className="cast-collab-modal-body">
              <label className="cast-collab-form-label">姓名 *</label>
              <input
                className="cast-collab-input"
                placeholder="输入成员姓名"
                value={inviteForm.name}
                onChange={(e) => setInviteForm(f => ({ ...f, name: e.target.value }))}
              />

              <label className="cast-collab-form-label">邮箱（可选）</label>
              <input
                className="cast-collab-input"
                placeholder="输入邮箱地址"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
              />

              <label className="cast-collab-form-label">角色</label>
              <select
                className="cast-collab-select"
                value={inviteForm.role}
                onChange={(e) => setInviteForm(f => ({ ...f, role: e.target.value as CollaborationRole }))}
              >
                {COLLABORATION_ROLES.filter(r => r.key !== 'owner').map(r => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="cast-collab-modal-footer">
              <button className="cast-collab-btn cast-collab-btn-ghost" onClick={() => setShowInviteModal(false)}>
                取消
              </button>
              <button
                className="cast-collab-btn cast-collab-btn-primary"
                onClick={handleInviteSubmit}
                disabled={!inviteForm.name.trim()}
              >
                发送邀请
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

CollabPanel.displayName = 'CollabPanel';

export default CollabPanel;
