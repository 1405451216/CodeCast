import React, { useEffect, useState, useCallback, useRef } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import * as api from '../api';

interface Toast {
  id: string;
  title: string;
  body: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'permission' | 'question';
}

interface ConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface PopoutData {
  sessionId: string;
  sessionName: string;
  timestamp: number;
}

const TYPE_ICONS: Record<string, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  permission: '🔐',
  question: '?',
};

const TYPE_COLORS: Record<string, string> = {
  success: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#7c7cff',
  permission: '#f472b6',
  question: '#60a5fa',
};

const NotificationCenter: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmDialog>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });
  const [popoutVisible, setPopoutVisible] = useState(false);
  const [popoutData, setPopoutData] = useState<PopoutData | null>(null);
  const toastIdRef = useRef(0);

  const addToast = useCallback((title: string, body: string, type: Toast['type']) => {
    const id = `toast-${++toastIdRef.current}`;
    setToasts((prev) => [...prev, { id, title, body, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const sub = EventsOn('notification', (data: { title: string; body: string; type: string }) => {
      if (data?.title && data?.body) {
        addToast(data.title, data.body, (data.type as Toast['type']) || 'info');
      }
    });
    unsubs.push(sub);

    const sub2 = EventsOn('git-commit-confirm', async (data: { file: string; directory: string }) => {
      if (!data?.file) return;
      setConfirm({
        open: true,
        title: 'Git 自动提交确认',
        message: `是否提交文件: ${data.file}`,
        detail: `目录: ${data.directory}`,
        onConfirm: async () => {
          try {
            await api.confirmGitCommit(data.file);
            addToast('Git 已提交', `已自动提交: ${data.file}`, 'success');
          } catch (e: any) {
            addToast('Git 提交失败', e.message || '未知错误', 'error');
          }
          setConfirm((p) => ({ ...p, open: false }));
        },
        onCancel: () => setConfirm((p) => ({ ...p, open: false })),
      });
    });
    unsubs.push(sub2);

    const sub3 = EventsOn('task-completed', (data: { id: string; name: string; status: string; duration: string; output: string }) => {
      if (!data?.name) return;
      const isOk = data.status === 'completed';
      addToast(
        isOk ? '任务完成' : '任务异常',
        `${data.name} (${data.duration})${!isOk ? '\n' + (data.output?.slice(0, 100) || '') : ''}`,
        isOk ? 'success' : 'error',
      );
    });
    unsubs.push(sub3);

    const sub4 = EventsOn('popout-requested', (data: PopoutData) => {
      if (data?.sessionId) {
        setPopoutData(data);
        setPopoutVisible(true);
      }
    });
    unsubs.push(sub4);

    return () => unsubs.forEach((unsub) => unsub());
  }, [addToast]);

  return (
    <>
      {/* Toast Container */}
      <div className="notification-container">
        {toasts.map((t) => (
          <div key={t.id} className={`notification-toast notification-${t.type}`} onClick={() => removeToast(t.id)}>
            <span className="notification-icon">{TYPE_ICONS[t.type] || 'ℹ'}</span>
            <div className="notification-content">
              <div className="notification-title">{t.title}</div>
              <div className="notification-body">{t.body}</div>
            </div>
            <button className="notification-close" onClick={(e) => { e.stopPropagation(); removeToast(t.id); }}>×</button>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirm.open && (
        <div className="dialog-overlay" onClick={confirm.onCancel}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">{confirm.title}</h3>
            <p className="dialog-message">{confirm.message}</p>
            {confirm.detail && <pre className="dialog-detail">{confirm.detail}</pre>}
            <div className="dialog-actions">
              <button className="btn-dialog btn-dialog-cancel" onClick={confirm.onCancel}>取消</button>
              <button className="btn-dialog btn-dialog-confirm" onClick={confirm.onConfirm}>确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Popout Overlay */}
      {popoutVisible && popoutData && (
        <div className="popout-overlay" onClick={() => setPopoutVisible(false)}>
          <div className="popout-window" onClick={(e) => e.stopPropagation()}>
            <div className="popout-header">
              <span className="popout-title">💬 {popoutData.sessionName || '对话'}</span>
              <button className="popout-close" onClick={() => setPopoutVisible(false)}>×</button>
            </div>
            <div className="popot-body">
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px 20px' }}>
                浮窗模式 — 此会话已独立显示
              </p>
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>
                会话 ID: {popoutData.sessionId}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationCenter;
