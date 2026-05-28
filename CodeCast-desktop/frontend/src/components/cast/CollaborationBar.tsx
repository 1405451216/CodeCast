import React, { useState, useMemo, useCallback } from 'react';
import type { CollaborativeDocument, CollabUser } from '../../types/cast-collab';
import { useCastCollabStore } from '../../store/useCastCollabStore';

interface CollaborationBarProps {
  documentId: string;
  documentType: CollaborativeDocument['type'];
  compact?: boolean;
}

const CollaborationBar: React.FC<CollaborationBarProps> = React.memo(({
  documentId,
  documentType,
  compact = false
}) => {
  const {
    workspace,
    members,
    documents,
    unresolvedConflicts,
    hasLock,
    acquireLock,
    releaseLock,
    generateInviteLink
  } = useCastCollabStore();

  const [showShareMenu, setShowShareMenu] = useState(false);

  const doc = useMemo(
    () => documents.find(d => d.id === documentId),
    [documents, documentId]
  );

  const lockInfo = useMemo(
    () => hasLock(documentId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, documents]
  );

  const collaborators = useMemo(() => {
    if (!doc) return [];
    return (doc.collaborators as CollabUser[]).filter(c => c.id !== workspace?.ownerId);
  }, [doc, workspace?.ownerId]);

  const isLockedByOther = lockInfo !== null && lockInfo.userId !== workspace?.ownerId;
  const canEdit = !isLockedByOther;

  const handleToggleLock = useCallback(() => {
    if (lockInfo) {
      releaseLock(documentId);
    } else {
      acquireLock(documentId);
    }
  }, [lockInfo, releaseLock, acquireLock, documentId]);

  const handleCopyLink = useCallback(() => {
    const link = generateInviteLink();
    navigator.clipboard.writeText(link || '');
    setShowShareMenu(false);
  }, [generateInviteLink]);

  if (!workspace) {
    return null;
  }

  const MAX_AVATARS = compact ? 3 : 5;
  const visibleCollabs = collaborators.slice(0, MAX_AVATARS);
  const extraCount = collaborators.length - MAX_AVATARS;

  return (
    <div className={`cast-collab-bar ${compact ? 'compact' : ''}`}>
      {/* Collaborator Avatars */}
      <div className="cast-collab-bar-avatars">
        {visibleCollabs.map(collab => (
          <div
            key={collab.id}
            className="cast-collab-bar-avatar"
            style={{ backgroundColor: collab.color }}
            title={`${collab.name} (${collab.online ? '在线' : '离线'})`}
          >
            <span className="cast-collab-bar-avatar-text">{collab.name.charAt(0)}</span>
            <span className={`cast-collab-bar-avatar-dot ${collab.online ? 'online' : ''}`} />
          </div>
        ))}
        {extraCount > 0 && (
          <div className="cast-collab-bar-avatar cast-collab-bar-avatar-more" title={`+${extraCount} 位协作者`}>
            +{extraCount}
          </div>
        )}
        {collaborators.length === 0 && (
          <span className="cast-collab-bar-no-collab">仅自己</span>
        )}
      </div>

      {/* Lock Status */}
      {!compact && (
        <div
          className={`cast-collab-bar-lock ${isLockedByOther ? 'locked-other' : canEdit ? 'editable' : ''}`}
          onClick={handleToggleLock}
          title={isLockedByOther ? `被其他用户锁定` : lockInfo ? '点击解锁' : '点击锁定'}
        >
          {isLockedByOther ? (
            <>
              <span className="cast-collab-bar-lock-icon">🔒</span>
              <span className="cast-collab-bar-lock-text">已锁定</span>
            </>
          ) : (
            <>
              <span className="cast-collab-bar-lock-icon">{lockInfo ? '🔓' : '✏️'}</span>
              <span className="cast-collab-bar-lock-text">{lockInfo ? '可解锁' : '可编辑'}</span>
            </>
          )}
        </div>
      )}

      {compact && (
        <div
          className={`cast-collab-bar-lock-compact ${isLockedByOther ? 'locked' : ''}`}
          title={isLockedByOther ? '被其他用户锁定' : lockInfo ? '已锁定（你）' : '未锁定'}
        >
          {isLockedByOther ? '🔒' : lockInfo ? '🔒' : '✏️'}
        </div>
      )}

      {/* Conflict Warning */}
      {unresolvedConflicts > 0 && (
        <div className="cast-collab-bar-conflict" title={`${unresolvedConflicts} 个未解决冲突`}>
          <span className="cast-collab-bar-conflict-dot" />
          {!compact && <span className="cast-collab-bar-conflict-text">{unresolvedConflicts}</span>}
        </div>
      )}

      {/* Share Button */}
      <div className="cast-collab-bar-share-wrapper">
        <button
          className="cast-collab-bar-share-btn"
          onClick={() => setShowShareMenu(!showShareMenu)}
          title="分享文档"
        >
          {compact ? '↗️' : '分享'}
        </button>

        {showShareMenu && (
          <div className="cast-collab-bar-share-menu">
            <button onClick={handleCopyLink}>🔗 复制邀请链接</button>
            <button onClick={() => setShowShareMenu(false)}>取消</button>
          </div>
        )}
      </div>

      {/* Last Saved Time */}
      {!compact && doc && (
        <span className="cast-collab-bar-saved-time">
          保存于 {formatRelativeTime(doc.updatedAt)}
        </span>
      )}

      {/* Document Type Badge */}
      <span className="cast-collab-bar-type-badge">
        {documentType === 'note' && '📝'}
        {documentType === 'schedule' && '📅'}
        {documentType === 'memory' && '🧠'}
        {documentType === 'email_draft' && '📧'}
        {documentType === 'document' && '📄'}
      </span>
    </div>
  );
});

CollaborationBar.displayName = 'CollaborationBar';

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

export default CollaborationBar;
