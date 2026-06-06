import { useState, useMemo, useRef, useEffect } from 'react';
import { Composer } from '../components/composer/Composer';
import { useError } from '../lib/useError';

interface Props {
  onSend?: (text: string) => void;
  onCancel?: () => void;
  model?: string;
  sessionName?: string;
  projectName?: string;
  thinking?: boolean;
  onToggleEdit?: (accept: boolean) => void;
}

/**
 * Code 模式空状态
 *  - 主体：✱ 接下来做什么？ + 使用统计卡片（tab 切换 + 时间段 + 8 项指标 + 26 周热力图）
 *  - 底部：标签栏 + 输入框 + 像素机器人头像
 */
export function CodeEmptyState({
  onSend, onCancel, model, sessionName: _sessionName = 'SD session', projectName: _projectName = 'AgentPrimordia',
  thinking, onToggleEdit,
}: Props) {
  useError('chat');
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'overview' | 'model'>('overview');
  const [period, setPeriod] = useState<'all' | '30d' | '7d'>('all');
  const [acceptEdit, setAcceptEdit] = useState(true);
  const [tag, setTag] = useState<'local' | 'agent' | 'branch' | 'worktree'>('local');
  const [popover, setPopover] = useState<'edit' | 'add' | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // 接受编辑菜单：5 项
  const editMenuItems = [
    { id: 'mode', label: '模式', hint: '↑', key: 'Ctrl M' },
    { id: 'perm', label: '请求权限', key: '1' },
    { id: 'accept', label: '接受编辑', key: '2', check: acceptEdit },
    { id: 'plan', label: '计划模式', key: '3' },
    { id: 'bypass', label: '绕过权限', key: '4' },
  ];

  // 工具添加菜单：6 项
  const addMenuItems = [
    { id: 'file', label: '添加文件或照片', hint: 'Ctrl+U', icon: 'paperclip' },
    { id: 'folder', label: '添加文件夹', icon: 'folder' },
    { id: 'github', label: '导入 GitHub 问题', icon: 'github' },
    { id: 'slash', label: '斜线命令', icon: 'slash' },
    { id: 'connector', label: '添加连接器', icon: 'plug' },
    { id: 'plugin', label: '添加插件…', icon: 'puzzle' },
  ];

  // 点击外部关闭
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [popover]);

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'auto',
        background: 'var(--c-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 主体：紧凑展示在左上角（标题 + 统计卡片） */}
      <div style={{ padding: '24px 16px 16px' }}>
        <div style={{ maxWidth: 640, marginLeft: 32 }}>
          {/* 标题 */}
          <h1
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--c-text)',
              margin: '0 0 16px',
              fontFamily: 'var(--font-serif)',
            }}
          >
            <SparkleIcon color="var(--c-accent)" size={20} />
            接下来做什么？
          </h1>

          {/* 统计卡片 */}
          <div
            style={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-lg)',
              padding: '12px 14px 14px',
            }}
          >
            {/* tab + 时间段 */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>概述</TabBtn>
                <TabBtn active={tab === 'model'} onClick={() => setTab('model')}>模型</TabBtn>
              </div>
              <div style={{ flex: 1 }} />
              <Segmented
                value={period}
                onChange={(v) => setPeriod(v as any)}
                options={[
                  { value: 'all', label: '全部' },
                  { value: '30d', label: '30天' },
                  { value: '7d', label: '7天' },
                ]}
              />
            </div>

            {/* 8 项指标网格 4×2 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                marginBottom: 10,
              }}
            >
              <Stat label="会话" value="9" />
              <Stat label="消息" value="5,929" />
              <Stat label="Token 总数" value="22.4M" />
              <Stat label="活跃天数" value="6" />
              <Stat label="当前连胜" value="1 天" />
              <Stat label="最长连胜" value="5 天" />
              <Stat label="高峰时段" value="21 时" />
              <Stat label="常用模型" value="MiniMax-M3" small />
            </div>

            {/* 热力图 */}
            <Heatmap period={period} />

            {/* 说明 */}
            <p
              style={{
                fontSize: 12,
                color: 'var(--c-textMute)',
                margin: '10px 0 0',
                lineHeight: 1.5,
              }}
            >
              你使用的 token 数约为 The Great Gatsby 的 ~361 倍。
            </p>
          </div>
        </div>
      </div>

      {/* 对话框：水平居中 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 720, position: 'relative' }}>
          {/* 标签栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            <TagPill active={tag === 'local'} onClick={() => setTag('local')}>
              <FolderIcon size={11} /> 本地
            </TagPill>
            <TagPill active={tag === 'agent'} onClick={() => setTag('agent')}>
              <FolderIcon size={11} /> agentprimordia
            </TagPill>
            <TagPill active={tag === 'branch'} onClick={() => setTag('branch')}>
              <BranchIcon size={11} /> main
            </TagPill>
            <TagPill active={tag === 'worktree'} onClick={() => setTag('worktree')}>
              <WorktreeIcon size={11} /> 工作树
            </TagPill>
            <div style={{ flex: 1 }} />
            <button
              aria-label="切换标签"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                color: 'var(--c-textMute)',
                cursor: 'pointer',
              }}
            >
              <SwitchIcon size={14} />
            </button>
          </div>

          {/* 输入框 + 机器人头像 */}
          <div style={{ position: 'relative' }}>
            <Composer
              sessionId="code-empty"
              model={model || 'MiniMax-M3'}
              thinking={!!thinking}
              text={text}
              setText={setText}
              onSend={(v) => { onSend?.(v); setText(''); }}
              onCancel={onCancel || (() => {})}
              placeholder="描述任务或提出问题"
            />
            <div
              style={{
                position: 'absolute',
                right: -8,
                top: -8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PixelBot />
            </div>
          </div>

          {/* 接受编辑 + 工具 + 模型 */}
          <div
            ref={popoverRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 4px 0',
              fontSize: 12,
              color: 'var(--c-textSub)',
            }}
          >
            {/* 接受编辑触发器 */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setPopover((p) => (p === 'edit' ? null : 'edit'))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: popover === 'edit' ? 'var(--c-surface-hover)' : 'var(--c-bgSub)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--c-textSub)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'background var(--dur-fast) var(--ease)',
                }}
              >
                {acceptEdit ? '✓ 接受编辑' : '○ 接受编辑'}
              </button>
              {popover === 'edit' && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 'calc(100% + 6px)',
                    minWidth: 220,
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 'var(--r-lg)',
                    boxShadow: 'var(--shadow-pop)',
                    padding: 4,
                    zIndex: 50,
                    animation: 'fadeUp var(--dur-base) var(--ease)',
                  }}
                >
                  {editMenuItems.map((m) => {
                    const isAccept = m.id === 'accept';
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (isAccept) {
                            setAcceptEdit((v) => { onToggleEdit?.(!v); return !v; });
                          }
                          setPopover(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          padding: '6px 8px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 'var(--r-sm)',
                          color: 'var(--c-text)',
                          fontSize: 12,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ flex: 1 }}>{m.label}</span>
                        {isAccept && (
                          <span style={{ color: 'var(--c-textMute)', fontSize: 11 }}>✓</span>
                        )}
                        <span
                          style={{
                            display: 'inline-flex',
                            gap: 4,
                            alignItems: 'center',
                            color: 'var(--c-textMute)',
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {m.hint && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: 16,
                              height: 16,
                              padding: '0 4px',
                              border: '1px solid var(--c-border)',
                              borderRadius: 3,
                              fontSize: 10,
                              background: 'var(--c-bgSub)',
                            }}>{m.hint}</span>
                          )}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 18,
                            height: 16,
                            padding: '0 4px',
                            border: '1px solid var(--c-border)',
                            borderRadius: 3,
                            fontSize: 10,
                            background: 'var(--c-bgSub)',
                          }}>{m.key}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* + 工具添加触发器 */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setPopover((p) => (p === 'add' ? null : 'add'))}
                aria-label="添加工具"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  padding: 0,
                  background: popover === 'add' ? 'var(--c-surface-hover)' : 'var(--c-bgSub)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--c-textSub)',
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: 'pointer',
                  transition: 'background var(--dur-fast) var(--ease)',
                }}
              >
                <PlusIcon size={12} />
              </button>
              {popover === 'add' && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 'calc(100% + 6px)',
                    minWidth: 240,
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 'var(--r-lg)',
                    boxShadow: 'var(--shadow-pop)',
                    padding: 4,
                    zIndex: 50,
                    animation: 'fadeUp var(--dur-base) var(--ease)',
                  }}
                >
                  {addMenuItems.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPopover(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '6px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--r-sm)',
                        color: 'var(--c-text)',
                        fontSize: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: 'var(--c-textMute)', display: 'inline-flex' }}>
                        <AddMenuIcon kind={m.icon as any} size={13} />
                      </span>
                      <span style={{ flex: 1 }}>{m.label}</span>
                      {m.hint && (
                        <span style={{
                          color: 'var(--c-textMute)',
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                        }}>{m.hint}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{model || 'MiniMax-M3'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
 *  子组件
 * ==================================================================== */

function SparkleIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ color }}>
      <path d="M8 1 9.4 6 14 7.4 9.4 8.8 8 13.5 6.6 8.8 2 7.4 6.6 6z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AddMenuIcon({ kind, size = 13 }: { kind: 'paperclip' | 'folder' | 'github' | 'slash' | 'plug' | 'puzzle'; size?: number }) {
  const p = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (kind) {
    case 'paperclip':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" {...p}>
          <path d="M11.5 6.5 7 11a2 2 0 0 1-2.8-2.8l5.3-5.3a1.4 1.4 0 0 1 2 2L6.2 10.2a.5.5 0 0 1-.7-.7L9.7 5.3" />
        </svg>
      );
    case 'folder':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" {...p}>
          <path d="M2 5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Z" />
        </svg>
      );
    case 'github':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" {...p}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M6 11.5c-1.5.5-1.5-1-2-1M10 13v-1.5a1 1 0 0 0-.4-.8c1.3-.2 2.4-1 2.4-2.4 0-.5-.2-1-.5-1.4.1-.3.1-.7 0-1-.4 0-1 .2-1.5.5a4 4 0 0 0-2 0C7.5 5.3 7 5 6.5 5c-.1.3-.1.7 0 1-.3.4-.5.9-.5 1.4 0 1.4 1 2.2 2.4 2.4a1 1 0 0 0-.4.8V13" />
        </svg>
      );
    case 'slash':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" {...p}>
          <circle cx="8" cy="8" r="5.5" />
          <path d="m10.5 5.5-5 5" />
        </svg>
      );
    case 'plug':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" {...p}>
          <path d="M6 2v3M10 2v3M4 5h8v3a3 3 0 0 1-3 3v3M9 11v3" />
        </svg>
      );
    case 'puzzle':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" {...p}>
          <path d="M7 2.5h2v1.5a1 1 0 0 0 1 1H12v2.5h-1.5a1 1 0 0 0 0 2H12V12H8.5a1 1 0 0 1-1 1v.5H5v-1.5a1 1 0 0 1 1-1V8.5H3.5a1 1 0 0 1 0-2H5V4h2v1.5a1 1 0 0 0 0 0Z" />
        </svg>
      );
  }
}

function FolderIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3h2.59c.46 0 .9.18 1.22.5L8 4.18c.32.32.76.5 1.22.5h3.28c.83 0 1.5.67 1.5 1.5v6.32c0 .83-.67 1.5-1.5 1.5h-10c-.83 0-1.5-.67-1.5-1.5V4.5Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function BranchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="4" cy="3" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="6" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 4.5v7M4 9c0-2 1.5-3 4-3l2.5-.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function WorktreeIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="2" y="10" width="12" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function SwitchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 5h8l-2-2M13 11H5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        background: active ? 'var(--c-bgSub)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-md)',
        color: active ? 'var(--c-text)' : 'var(--c-textSub)',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Segmented({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        padding: 2,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const a = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '3px 9px',
              background: a ? 'var(--c-surface)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              color: a ? 'var(--c-text)' : 'var(--c-textSub)',
              fontSize: 12,
              fontWeight: a ? 500 : 400,
              cursor: 'pointer',
              boxShadow: a ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--c-bgSub)',
        borderRadius: 'var(--r-md)',
        padding: '8px 10px',
        minHeight: 52,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--c-textMute)' }}>{label}</div>
      <div
        style={{
          fontSize: small ? 13 : 18,
          fontWeight: 600,
          color: 'var(--c-text)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TagPill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        color: active ? 'var(--c-text)' : 'var(--c-textSub)',
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/* ====================================================================
 *  热力图（GitHub 贡献图风格）
 * ==================================================================== */

function Heatmap({ period }: { period: 'all' | '30d' | '7d' }) {
  // 26 周 × 7 天 = 182 个格子
  const weeks = 26;
  const data = useMemo(() => {
    const arr: number[][] = [];
    for (let w = 0; w < weeks; w++) {
      const col: number[] = [];
      for (let d = 0; d < 7; d++) {
        // 根据 period 决定数据分布
        if (period === '7d') {
          // 只在最右列高亮
          col.push(w === weeks - 1 ? Math.random() * 0.9 + 0.1 : 0);
        } else if (period === '30d') {
          // 右 4-5 列有数据
          col.push(w >= weeks - 5 ? Math.random() * 0.9 + 0.1 : Math.random() * 0.2);
        } else {
          // 全部：近期活跃
          const trend = w / weeks;
          col.push(Math.max(0, Math.min(1, Math.random() * 0.7 + trend * 0.3)));
        }
      }
      arr.push(col);
    }
    return arr;
  }, [period]);

  const cell = 11;
  const gap = 2;

  return (
    <div
      style={{
        display: 'flex',
        gap,
        overflow: 'hidden',
        justifyContent: 'flex-start',
      }}
    >
      {data.map((col, ci) => (
        <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap }}>
          {col.map((v, ri) => {
            const bg =
              v < 0.1 ? 'var(--c-bgSub)' :
              v < 0.3 ? 'rgba(120,160,210,0.25)' :
              v < 0.5 ? 'rgba(120,160,210,0.45)' :
              v < 0.7 ? 'rgba(90,130,200,0.65)' :
                        'rgba(60,100,180,0.95)';
            return (
              <div
                key={ri}
                style={{
                  width: cell,
                  height: cell,
                  background: bg,
                  borderRadius: 2,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ====================================================================
 *  像素机器人
 * ==================================================================== */

function PixelBot() {
  // 8x8 像素艺术机器人
  const grid = [
    '..XXXX..',
    '.XAAAAX.',
    'XAYAYAYX',
    'XAXAXAX.',
    'XAAAAAX.',
    'XXAYYAX.',
    'XAXAXAX.',
    '.XXXXXX.',
  ];
  const palette: Record<string, string> = {
    X: '#E07B3F', // 主体橙
    A: '#2A2520', // 眼/嘴框
    Y: '#FFFFFF', // 眼白/嘴
  };
  return (
    <svg width="32" height="32" viewBox="0 0 8 8" shapeRendering="crispEdges">
      {grid.map((row, y) =>
        row.split('').map((c, x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={palette[c] || 'transparent'} />
        ))
      )}
    </svg>
  );
}

/* 全局动画：popover fadeUp */
if (typeof document !== 'undefined' && !document.getElementById('code-empty-fadeup')) {
  const style = document.createElement('style');
  style.id = 'code-empty-fadeup';
  style.textContent = `
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
