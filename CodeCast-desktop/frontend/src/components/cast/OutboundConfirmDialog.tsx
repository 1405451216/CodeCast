import React from 'react';
import type { OutboundCategory } from '../../types/cast-privacy';
import { OUTBOUND_CATEGORY_LABELS } from '../../types/cast-privacy';

interface OutboundConfirmDialogProps {
  visible: boolean;
  url: string;
  domain: string;
  category: OutboundCategory;
  dataSize: number;
  preview: string;
  onResolve: (decision: 'allow' | 'deny' | 'allow_remember') => void;
}

export function OutboundConfirmDialog({
  visible, url, domain, category, dataSize, preview, onResolve
}: OutboundConfirmDialogProps) {
  if (!visible) return null;

  const catInfo = OUTBOUND_CATEGORY_LABELS[category];

  function formatDataSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  return (
    <div className="cast-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onResolve('deny'); }}>
      <div className="cast-confirm-dialog">
        <div className="cast-confirm-header">
          <span className="cast-confirm-icon">🔒</span>
          <h3>出站请求确认</h3>
        </div>

        <div className="cast-confirm-body">
          <div className="confirm-field">
            <label>目标域名</label>
            <code className="confirm-domain">{domain}</code>
          </div>

          <div className="confirm-field">
            <label>完整URL</label>
            <code className="confirm-url">{url}</code>
          </div>

          <div className="confirm-field">
            <label>请求类型</label>
            <span className="confirm-category">
              {catInfo?.icon || '?'} {catInfo?.label || category}
            </span>
            <span className="confirm-category-desc">{catInfo?.description}</span>
          </div>

          <div className="confirm-field">
            <label>数据大小</label>
            <span className="confirm-size">{formatDataSize(dataSize)}</span>
          </div>

          {preview && (
            <div className="confirm-field confirm-preview-field">
              <label>数据预览（已脱敏）</label>
              <pre className="confirm-preview">{preview}</pre>
            </div>
          )}

          <div className="confirm-warning">
            ⚠️ 此请求将向外部服务器发送数据。CodeCast 是纯本地 Agent，此操作由你主动触发。
          </div>
        </div>

        <div className="cast-confirm-actions">
          <button className="confirm-btn deny" onClick={() => onResolve('deny')}>
            ❌ 拒绝
          </button>
          <button className="confirm-btn allow-once" onClick={() => onResolve('allow')}>
            ✅ 仅本次允许
          </button>
          <button className="confirm-btn allow-always" onClick={() => onResolve('allow_remember')}>
            ✅ 允许并记住此域名
          </button>
        </div>
      </div>
    </div>
  );
}

export default OutboundConfirmDialog;
