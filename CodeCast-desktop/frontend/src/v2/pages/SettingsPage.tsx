import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { Button } from '../components/primitives/Button';
import { TopBar } from '../layout/TopBar';
import { Skills, Files } from '../wails/adapter';
import { ConfirmDialog } from '../components/primitives/ConfirmDialog';
import type { Skill } from '../wails/types';

/* ====================================================================
 *  分类 ID / 分组结构
 * ==================================================================== */

type SectionId =
  | 'general' | 'privacy' | 'skills' | 'connectors'
  | 'codecast' | 'cowork'
  | 'desktop-general' | 'extensions' | 'developer' | 'updates';

interface NavGroup {
  title?: string; // 分组小标题（无标题 = 顶部分组）
  items: { id: SectionId; label: string }[];
}

const NAV: NavGroup[] = [
  {
    items: [
      { id: 'general', label: '一般' },
      { id: 'privacy', label: '隐私' },
      { id: 'skills', label: '技能' },
      { id: 'connectors', label: '连接器' },
    ],
  },
  {
    items: [
      { id: 'codecast', label: 'CodeCast' },
      { id: 'cowork', label: 'Cowork' },
    ],
  },
  {
    title: '桌面应用',
    items: [
      { id: 'desktop-general', label: '一般' },
      { id: 'extensions', label: '扩展' },
      { id: 'developer', label: '开发者' },
      { id: 'updates', label: '更新' },
    ],
  },
];

/* ====================================================================
 *  页面外壳
 * ==================================================================== */

export function SettingsPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState<SectionId>('general');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => navigate('/')} backLabel="设置" />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 左侧分类导航 */}
        <nav
          style={{
            width: 220,
            padding: '24px 12px',
            borderRight: '1px solid var(--c-divider)',
            background: 'var(--c-bg)',
            overflow: 'auto',
          }}
        >
          {NAV.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 16 }}>
              {group.title && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--c-textMute)',
                    fontWeight: 500,
                    padding: '4px 12px 6px',
                    letterSpacing: 0.2,
                  }}
                >
                  {group.title}
                </div>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => setActive(it.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 12px',
                        background: active === it.id ? 'var(--c-surface-hover)' : 'transparent',
                        color: active === it.id ? 'var(--c-text)' : 'var(--c-textSub)',
                        border: 'none',
                        borderRadius: 'var(--r-md)',
                        fontSize: 13,
                        fontWeight: active === it.id ? 500 : 400,
                        cursor: 'pointer',
                        transition: 'all var(--dur-fast) var(--ease)',
                      }}
                      onMouseEnter={(e) => { if (active !== it.id) e.currentTarget.style.background = 'var(--c-surface-hover)'; }}
                      onMouseLeave={(e) => { if (active !== it.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {it.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* 右侧内容 */}
        <main
          style={{
            flex: 1,
            padding: '24px 32px',
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--c-bg)',
            minHeight: 0,
            overscrollBehavior: 'contain',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {active === 'general' && <GeneralSection />}
            {active === 'privacy' && <PrivacySection />}
            {active === 'skills' && <SkillsSection />}
            {active === 'connectors' && <ConnectorsSection />}
            {active === 'codecast' && <CodeCastSection />}
            {active === 'cowork' && <CoworkSection />}
            {active === 'desktop-general' && <DesktopGeneralSection />}
            {active === 'extensions' && <ExtensionsSection />}
            {active === 'developer' && <DeveloperSection />}
            {active === 'updates' && <UpdatesSection />}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ====================================================================
 *  一般
 * ==================================================================== */

function GeneralSection() {
  const { theme, setTheme, settings, updateKey } = useAppStore();
  const [fullName, setFullName] = useState('');
  const [callYou, setCallYou] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* 个人资料 */}
      <section>
        <SectionTitle>个人资料</SectionTitle>
        <Card>
          <Row label="头像">
            <Avatar name={fullName || 'CC'} />
          </Row>
          <Row label="全名" htmlFor="fullname">
            <TextInput id="fullname" value={fullName} onChange={setFullName} />
          </Row>
          <Row label="CodeCast 应该怎么称呼你?" htmlFor="callyou">
            <TextInput id="callyou" value={callYou} onChange={setCallYou} />
          </Row>
          <Row label="以下哪项最能描述你的工作?" htmlFor="workdesc">
            <Select
              id="workdesc"
              value={settings?.personality ?? ''}
              onChange={(v: string) => updateKey('personality', v)}
              placeholder="选择"
              options={[
                { value: 'engineering', label: '工程 / 软件开发' },
                { value: 'product', label: '产品 / 设计' },
                { value: 'research', label: '研究 / 数据' },
                { value: 'operations', label: '运营 / 行政' },
                { value: 'marketing', label: '市场 / 销售' },
                { value: 'student', label: '学生' },
                { value: 'other', label: '其他' },
              ]}
            />
          </Row>
          <Row
            label="给 CodeCast 的指令"
            htmlFor="castInstr"
            desc="CodeCast 会在聊天和 Cowork 中记住这些内容，并遵守 Anthropic 的准则。"
            link="了解更多"
          >
            <TextArea
              id="castInstr"
              value={settings?.custom_instructions ?? ''}
              onChange={(v: string) => updateKey('custom_instructions', v)}
              placeholder="例如我主要使用 Python 编写代码（不是编码初学者）"
              rows={4}
            />
          </Row>
        </Card>
      </section>

      {/* 偏好设置 */}
      <section>
        <SectionTitle>偏好设置</SectionTitle>
        <Card>
          <Row label="外观">
            <Segmented
              value={theme}
              onChange={(v) => setTheme(v as any)}
              options={[
                { value: 'system', label: '系统', icon: themeIcon('system') },
                { value: 'light', label: '浅色', icon: themeIcon('light') },
                { value: 'dark', label: '深色', icon: themeIcon('dark') },
              ]}
            />
          </Row>
          <Row label="聊天字体" htmlFor="chatfont">
            <Select
              id="chatfont"
              value={settings?.font_size ?? 'Anthropic Serif'}
              onChange={(v: string) => updateKey('font_size', v)}
              options={[
                { value: 'Anthropic Serif', label: 'Anthropic Serif' },
                { value: 'IBM Plex Serif', label: 'IBM Plex Serif' },
                { value: 'IBM Plex Sans', label: 'IBM Plex Sans' },
                { value: 'JetBrains Mono', label: 'JetBrains Mono' },
                { value: 'PingFang SC', label: 'PingFang SC' },
              ]}
            />
          </Row>
        </Card>
      </section>

      {/* 通知 */}
      <section>
        <SectionTitle>通知</SectionTitle>
        <Card>
          <Row label="响应完成" desc="CodeCast 完成回复时通知你。适合长时间运行的任务。">
            <Toggle checked={settings?.notify_complete === 'true'} onChange={(v) => updateKey('notify_complete', v ? 'true' : 'false')} />
          </Row>
          <Row label="权限请求" desc="当 Agent 需要执行需要权限的操作时通知你。">
            <Toggle checked={settings?.notify_permission ?? true} onChange={(v) => updateKey('notify_permission', v)} />
          </Row>
          <Row label="问题报告" desc="当 Agent 遇到错误或问题时通知你。">
            <Toggle checked={settings?.notify_issue ?? true} onChange={(v) => updateKey('notify_issue', v)} />
          </Row>
        </Card>
      </section>

      {/* 浏览器控制 */}
      <section>
        <SectionTitle>浏览器控制</SectionTitle>
        <Card>
          <Row label="允许浏览器" desc="允许 Agent 控制浏览器进行自动化操作。">
            <Toggle checked={settings?.allow_browser ?? false} onChange={(v) => updateKey('allow_browser', v)} />
          </Row>
          <Row label="浏览器审批模式" desc="控制 Agent 使用浏览器时的审批级别。">
            <select
              value={settings?.browser_approval ?? 'always'}
              onChange={(e) => updateKey('browser_approval', e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', background: 'var(--c-surface)', color: 'var(--c-text)' }}
            >
              <option value="always">始终询问</option>
              <option value="first">首次询问</option>
              <option value="never">从不询问</option>
            </select>
          </Row>
        </Card>
      </section>

      {/* Git 设置 */}
      <section>
        <SectionTitle>Git 设置</SectionTitle>
        <Card>
          <Row label="自动提交" desc="Agent 修改文件后自动创建 Git 提交。">
            <Toggle checked={settings?.auto_commit ?? false} onChange={(v) => updateKey('auto_commit', v)} />
          </Row>
          <Row label="提交前确认" desc="在创建 Git 提交前要求确认。">
            <Toggle checked={settings?.confirm_before_commit ?? true} onChange={(v) => updateKey('confirm_before_commit', v)} />
          </Row>
          <Row label="使用 Worktree" desc="使用 Git worktree 进行隔离的代码修改。">
            <Toggle checked={settings?.use_worktree ?? false} onChange={(v) => updateKey('use_worktree', v)} />
          </Row>
        </Card>
      </section>
    </div>
  );
}

function themeIcon(t: 'system' | 'light' | 'dark') {
  if (t === 'system') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 13h4M8 11v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (t === 'light') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3c0-.5.07-1 .18-1.45A6 6 0 1 0 14.45 9.32 5.5 5.5 0 0 1 13 9.5Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/* ====================================================================
 *  隐私
 * ==================================================================== */

function PrivacySection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 顶部信息卡 */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-lg)',
          fontSize: 13,
          color: 'var(--c-textSub)',
          lineHeight: 1.6,
        }}
      >
        你正在通过组织自己的推理提供商 <span style={{ fontFamily: 'var(--font-mono)' }}>(127.0.0.1:15721)</span> 运行 CodeCast。
        你的对话会发送到该提供商，而不是 Anthropic，并受你的组织与该提供商签订的协议约束。
      </div>

      {/* Anthropic 不会看到的内容 */}
      <Block>
        <BlockTitle>Anthropic 不会看到的内容</BlockTitle>
        <ul style={{ listStyle: 'disc', paddingLeft: 20, margin: 0, fontSize: 13, color: 'var(--c-text)', lineHeight: 1.9 }}>
          <li>你的提示词、CodeCast 的回复或任何对话内容</li>
          <li>你的文件、代码或工作区内容</li>
          <li>你的身份或账号详细信息</li>
        </ul>
      </Block>

      {/* Anthropic 可能收到的内容 */}
      <Block>
        <BlockTitle>
          Anthropic 可能收到的内容
          <span style={{ color: 'var(--c-textMute)', fontWeight: 400, marginLeft: 6 }}>（由你的组织配置）</span>
        </BlockTitle>
        <ul style={{ listStyle: 'disc', paddingLeft: 20, margin: 0, fontSize: 13, color: 'var(--c-text)', lineHeight: 1.9 }}>
          <li>崩溃报告和错误诊断，以便我们修复问题</li>
          <li>匿名使用指标，包括使用次数（不包含对话内容）</li>
          <li>更新检查请求，以便应用保持最新</li>
          <li>诊断报告，仅当你明确选择"发送给 Anthropic"时才会发送</li>
        </ul>
      </Block>
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '16px 18px',
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-lg)',
      }}
    >
      {children}
    </div>
  );
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 8px' }}>
      {children}
    </h3>
  );
}

/* ====================================================================
 *  技能
 * ==================================================================== */

function SkillsSection() {
  const [artifacts, setArtifacts] = useState(true);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadSkills = async () => {
    setLoading(true);
    try {
      setSkills(await Skills.list());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadSkills(); }, []);

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      if (editId) {
        await Skills.update(editId, formName, formDesc, formPrompt);
      } else {
        await Skills.create(formName, formDesc, formPrompt);
      }
      setShowForm(false);
      setEditId(null);
      setFormName(''); setFormDesc(''); setFormPrompt('');
      await loadSkills();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await Skills.delete(confirmDeleteId);
      await loadSkills();
    } catch { /* ignore */ }
    setConfirmDeleteId(null);
  };

  const startEdit = (s: Skill) => {
    setEditId(s.id);
    setFormName(s.name);
    setFormDesc(s.description);
    setFormPrompt(s.prompt);
    setShowForm(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>视觉效果</SectionTitle>
        <Card>
          <Row label="Artifacts" desc="在对话旁的专用窗口中生成代码、文档和设计。">
            <Toggle checked={artifacts} onChange={setArtifacts} />
          </Row>
        </Card>
      </section>
      <section>
        <SectionTitle>技能</SectionTitle>
        <Card>
          {loading ? (
            <Row label="" desc="加载中…" />
          ) : skills.length === 0 && !showForm ? (
            <Row label="" desc="暂无自定义技能。">
              <Button variant="primary" onClick={() => { setShowForm(true); setEditId(null); setFormName(''); setFormDesc(''); setFormPrompt(''); }}>
                新建技能
              </Button>
            </Row>
          ) : (
            <>
              {skills.map((s) => (
                <Row
                  key={s.id}
                  label={s.name}
                  desc={s.description.length > 80 ? s.description.slice(0, 80) + '…' : s.description}
                >
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="secondary" onClick={() => startEdit(s)}>编辑</Button>
                    <Button variant="secondary" onClick={() => handleDelete(s.id)}>删除</Button>
                  </div>
                </Row>
              ))}
              {!showForm && (
                <Row label="">
                  <Button variant="primary" onClick={() => { setShowForm(true); setEditId(null); setFormName(''); setFormDesc(''); setFormPrompt(''); }}>
                    新建技能
                  </Button>
                </Row>
              )}
            </>
          )}
          {showForm && (
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--c-divider)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TextInput value={formName} onChange={setFormName} placeholder="技能名称" />
              <TextInput value={formDesc} onChange={setFormDesc} placeholder="描述" />
              <TextArea value={formPrompt} onChange={setFormPrompt} placeholder="提示词" rows={3} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>取消</Button>
                <Button variant="primary" onClick={handleSave}>{editId ? '保存' : '创建'}</Button>
              </div>
            </div>
          )}
        </Card>
      </section>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="删除技能"
        message="确定要删除该技能吗？此操作不可撤销。"
        confirmLabel="删除"
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDeleteId(null)}
        danger
      />
    </div>
  );
}

/* ====================================================================
 *  连接器
 * ==================================================================== */

function ConnectorsSection() {
  const navigate = useNavigate();
  const { servers } = useAppStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>连接器 (MCP)</SectionTitle>
        <Card>
          <Row
            label="MCP 服务器"
            desc={servers.length > 0 ? `已连接 ${servers.filter(s => s.connected).length} / ${servers.length} 个服务器` : '未配置 MCP 服务器。'}
          >
            <Button variant="secondary" onClick={() => navigate('/cast-tools')}>查看工具</Button>
          </Row>
          {servers.map((s) => (
            <Row
              key={s.id}
              label={s.name}
              desc={s.connected ? '已连接' : s.error || '未连接'}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: s.connected ? 'var(--c-success, #4ade80)' : 'var(--c-textMute)',
              }} />
            </Row>
          ))}
        </Card>
      </section>
    </div>
  );
}

/* ====================================================================
 *  CodeCast（代码外观 + 外观 + 本地会话）
 * ==================================================================== */

function CodeCastSection() {
  const { settings, updateKey } = useAppStore();
  const [codeLight, setCodeLight] = useState('CodeCast 浅色');
  const [codeDark, setCodeDark] = useState('CodeCast 深色');
  const [codeFont, setCodeFont] = useState('');
  const [uiFont, setUiFont] = useState<'sans' | 'system'>('sans');
  const [transcriptSize, setTranscriptSize] = useState<'sm' | 'md' | 'lg'>('md');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* 代码外观 */}
      <section>
        <SectionTitle>代码外观</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <CodeThemeCard
            theme={codeLight}
            onChange={setCodeLight}
            label="CodeCast 浅色"
            dark={false}
            sample={SAMPLE_CODE}
          />
          <CodeThemeCard
            theme={codeDark}
            onChange={setCodeDark}
            label="CodeCast 深色"
            dark
            sample={SAMPLE_CODE}
          />
        </div>
        <Card>
          <Row
            label="代码字体"
            htmlFor="codefont"
            desc="为代码和终端设置自定义等宽字体。"
          >
            <TextInput
              id="codefont"
              value={codeFont}
              onChange={setCodeFont}
              placeholder="例如 JetBrains Mono"
            />
          </Row>
        </Card>
      </section>

      {/* 外观 */}
      <section>
        <SectionTitle>外观</SectionTitle>
        <Card>
          <Row label="高对比度深色主题" desc="开启深色模式时使用更暗、接近黑色的背景。">
            <Toggle checked={settings?.theme === 'high-contrast'} onChange={(v) => updateKey('theme', v ? 'high-contrast' : settings?.theme === 'high-contrast' ? 'dark' : (settings?.theme ?? 'dark'))} />
          </Row>
          <Row
            label="界面字体"
            htmlFor="uifont"
            desc="CodeCast 界面字体，包括菜单、侧边栏和聊天。"
          >
            <Segmented
              value={uiFont}
              onChange={(v) => setUiFont(v as any)}
              options={[
                { value: 'sans', label: 'Anthropic Sans' },
                { value: 'system', label: '系统' },
              ]}
            />
          </Row>
          <Row label="转录文本大小" desc="对话转录文本的大小。">
            <Segmented
              value={transcriptSize}
              onChange={(v) => setTranscriptSize(v as any)}
              options={[
                { value: 'sm', label: '小' },
                { value: 'md', label: '中' },
                { value: 'lg', label: '大' },
              ]}
            />
          </Row>
        </Card>
      </section>

      {/* 本地会话 */}
      <section>
        <SectionTitle>本地会话</SectionTitle>
        <Card>
          <Row
            label="允许绕过权限模式"
            desc={
              <span>
                绕过所有权限检查，让 CodeCast 不间断地工作。这对于修复 lint 错误或生成样板代码等工作流程非常有效。
                让 CodeCast 运行任意命令是有风险的，可能会导致数据丢失、系统损坏或数据泄露（例如，通过提示注入攻击）。{' '}
                <a style={{ color: 'var(--c-accentText)' }}>查看安全使用的最佳实践 ↗</a>
              </span>
            }
          >
            <Toggle checked={settings?.full_access ?? false} onChange={(v) => updateKey('full_access', v)} />
          </Row>
          <Row label="默认启用远程控制">
            <Toggle checked={settings?.computer_control ?? false} onChange={(v) => updateKey('computer_control', v)} />
          </Row>
        </Card>
      </section>
    </div>
  );
}

const SAMPLE_CODE = [
  { n: 1, t: 'def', kw: 'def', name: ' greet', paren: '(', pname: 'name', ptype: 'string', paren2: ')', brace: ' {' },
  { n: 2, sign: '-', t: '    return ', str: '"Hello, "', plus: ' + ', name: 'name', semi: ';' },
  { n: 3, sign: '+', t: '    return ', str: "'Hello, ${name}!'", semi: ';' },
  { n: 4, t: '}', brace2: '' },
];

function CodeThemeCard({
  theme, onChange, label, dark, sample,
}: {
  theme: string; onChange: (v: string) => void; label: string; dark?: boolean; sample: typeof SAMPLE_CODE;
}) {
  const bg = dark ? '#1f1d1a' : '#fafaf7';
  const fg = dark ? '#e8e6e0' : '#2a2520';
  const accent = dark ? '#c9a26b' : '#a36a30';
  const addBg = dark ? 'rgba(120,180,90,0.16)' : 'rgba(60,140,80,0.10)';
  const delBg = dark ? 'rgba(200,90,90,0.18)' : 'rgba(200,80,80,0.10)';
  const numCol = dark ? '#7a7060' : '#8a8070';

  return (
    <div
      style={{
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-lg)',
        background: 'var(--c-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--c-divider)',
        }}
      >
        <Select
          value={theme}
          onChange={onChange}
          options={[
            { value: theme, label },
            { value: 'github', label: 'GitHub' },
            { value: 'solarized', label: 'Solarized' },
            { value: 'dracula', label: 'Dracula' },
          ]}
        />
      </div>
      <pre
        style={{
          margin: 0,
          padding: '12px 14px',
          background: bg,
          color: fg,
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.6,
          overflow: 'hidden',
        }}
      >
        {sample.map((line) => (
          <div
            key={line.n}
            style={{
              display: 'flex',
              background: line.sign === '+' ? addBg : line.sign === '-' ? delBg : 'transparent',
            }}
          >
            <span style={{ width: 18, color: numCol, textAlign: 'right', marginRight: 10, userSelect: 'none' }}>{line.n}</span>
            {line.sign && <span style={{ width: 14, color: numCol, userSelect: 'none' }}>{line.sign}</span>}
            <span style={{ flex: 1 }}>
              {line.kw && <span style={{ color: accent }}>{line.kw}</span>}
              {line.name}
              {line.paren && <span style={{ color: fg }}>{line.paren}</span>}
              {line.pname && <span style={{ color: dark ? '#8fb8e0' : '#3a6ea5' }}>{line.pname}</span>}
              {line.ptype && <span style={{ color: dark ? '#c9a26b' : '#a36a30' }}>: {line.ptype}</span>}
              {line.paren2 && <span style={{ color: fg }}>{line.paren2}</span>}
              {line.brace && <span style={{ color: fg }}>{line.brace}</span>}
              {line.t && <span>{line.t.replace(/^(def| {4}return )$/, '')}</span>}
              {line.str && <span style={{ color: dark ? '#a8c97f' : '#5a8b3f' }}>{line.str}</span>}
              {line.plus && <span style={{ color: fg }}>{line.plus}</span>}
              {line.semi && <span style={{ color: fg }}>{line.semi}</span>}
              {line.brace2 && <span style={{ color: fg }}>{line.brace2}</span>}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}

/* ====================================================================
 *  Cowork
 * ==================================================================== */

function CoworkSection() {
  const { settings, updateKey, stats } = useAppStore();
  const sizeStr = stats.sizeBytes > 0 ? `${(stats.sizeBytes / 1024).toFixed(1)} KB` : '—';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cowork 文件 */}
      <Card>
        <Row
          label="Cowork 文件"
          desc={
            <span>
              你的 Artifacts 和计划任务存储在{' '}
              <a style={{ color: 'var(--c-accentText)' }}>C:\Users\Administrator\CodeCast</a>。
            </span>
          }
        >
          <Button variant="secondary" icon={<FolderIcon />} onClick={() => Files.selectFolder().then((p) => { if (p) window.alert(`工作目录已选择: ${p}`); })}>更改</Button>
        </Row>
        {/* 全局指令已移至"给 CodeCast 的指令"（通用设置），避免重复 */}
      </Card>

      {/* 记忆 */}
      <section>
        <SectionTitle>记忆</SectionTitle>
        <Card>
          <Row
            label="在会话中使用记忆"
            desc="CodeCast 将在 Cowork 会话期间阅读并更新这些记忆。"
          >
            <Toggle checked={settings?.auto_memory ?? false} onChange={(v) => updateKey('auto_memory', v)} />
          </Row>
          <Row
            label="记忆统计"
            desc={`共 ${stats.totalEpisodes} 条记忆，占用 ${sizeStr}`}
          />
        </Card>
      </section>
    </div>
  );
}

/* ====================================================================
 *  桌面应用 → 一般
 * ==================================================================== */

function DesktopGeneralSection() {
  const { settings, updateKey } = useAppStore();
  const shortcut = settings?.hotkey ?? 'Control+Alt+Space';
  return (
    <section>
      <SectionTitle>常规桌面设置</SectionTitle>
      <Card>
        <Row label="启动时运行" desc="登录计算机时自动启动 CodeCast">
          <Toggle checked={settings?.desktop_run_on_startup ?? false} onChange={(v) => updateKey('desktop_run_on_startup', v)} />
        </Row>
        <Row
          label="快速输入键盘快捷键"
          desc="从任何地方快速打开 CodeCast"
        >
          <KeyChip label={shortcut} onClear={() => updateKey('hotkey', 'Control+Alt+Space')} />
        </Row>
        <Row label="系统托盘" desc="让 CodeCast 在系统托盘中运行">
          <Toggle checked={settings?.desktop_system_tray ?? true} onChange={(v) => updateKey('desktop_system_tray', v)} />
        </Row>
        <Row
          label="保持计算机处于唤醒状态"
          desc="防止电脑在 CodeCast 打开时进入空闲睡眠，以便计划任务可以运行。显示器仍可关闭。合上笔记本电脑盖子仍会进入睡眠。"
        >
          <Toggle checked={settings?.desktop_keep_awake ?? false} onChange={(v) => updateKey('desktop_keep_awake', v)} />
        </Row>
      </Card>
    </section>
  );
}

/* ====================================================================
 *  扩展
 * ==================================================================== */

function ExtensionsSection() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>扩展</SectionTitle>
        <Card>
          <Row
            desc="允许 CodeCast 直接与计算机上的应用、数据和工具交互。"
          >
            <Button variant="secondary" onClick={() => navigate('/plugins')}>浏览扩展</Button>
          </Row>
        </Card>
      </section>
    </div>
  );
}

function ExtensionsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* 拼图块插槽 */}
      <rect x="22" y="14" width="36" height="36" rx="3" stroke="var(--c-text)" strokeWidth="1.6" />
      <rect x="22" y="14" width="12" height="12" stroke="var(--c-text)" strokeWidth="1.6" />
      {/* 拼图块凸起 */}
      <path
        d="M40 50c0-3 2-5 5-5h2c2 0 3 1 3 3v3c0 2 1 3 3 3h3c2 0 3 1 3 3v2c0 3-2 5-5 5H40V50z"
        fill="var(--c-bgSub)"
        stroke="var(--c-text)"
        strokeWidth="1.6"
      />
      {/* 拼图块内插槽 */}
      <path
        d="M58 60v6"
        stroke="var(--c-text)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ====================================================================
 *  开发者
 * ==================================================================== */

function DeveloperSection() {
  const navigate = useNavigate();
  const {
    checkpoints,
    checkpointLoading,
    loadCheckpoints,
    deleteCheckpoint,
    currentSessionId,
    securityStatus,
    telemetryStatus,
    rotateKey,
    toggleEnabled: toggleTelemetry,
  } = useAppStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>Agent Checkpoints</SectionTitle>
        <Card>
          <Row
            label="当前会话 checkpoints"
            desc={currentSessionId ? `已记录 ${checkpoints.length} 个 checkpoint。` : '未选择会话'}
          >
            <Button
              variant="secondary"
              onClick={() => currentSessionId && loadCheckpoints(currentSessionId, 50)}
            >
              刷新
            </Button>
          </Row>
          {checkpointLoading ? (
            <Row label="" desc="加载中…" />
          ) : checkpoints.length === 0 ? (
            <Row label="" desc="暂无记录" />
          ) : (
            checkpoints.slice(0, 10).map((cp) => (
              <Row
                key={cp.ID}
                label={`#${cp.Turn} · ${cp.ToolName}`}
                desc={`${cp.Status} · ${cp.CreatedAt}`}
              >
                <Button variant="secondary" onClick={() => deleteCheckpoint(cp.ID)}>
                  删除
                </Button>
              </Row>
            ))
          )}
        </Card>
      </section>

      {/* Security 子区 */}
      <section>
        <SectionTitle>安全</SectionTitle>
        <Card>
          <Row
            label="加密状态"
            desc={securityStatus ? (securityStatus.encryptionEnabled ? '已启用' : '未启用') : '加载中…'}
          />
          {securityStatus?.lastKeyRotation && (
            <Row label="上次密钥轮换" desc={securityStatus.lastKeyRotation} />
          )}
          <Row label="密钥轮换" desc={securityStatus?.keyRotationDue ? '需要轮换' : '正常'}>
            <Button variant="secondary" onClick={rotateKey}>立即轮换</Button>
          </Row>
        </Card>
      </section>

      {/* Telemetry 子区 */}
      <section>
        <SectionTitle>遥测</SectionTitle>
        <Card>
          <Row label="启用遥测" desc="发送匿名使用数据帮助改进 CodeCast">
            <Toggle checked={telemetryStatus?.enabled ?? false} onChange={toggleTelemetry} />
          </Row>
          {telemetryStatus?.endpoint && (
            <Row label="端点" desc={telemetryStatus.endpoint} />
          )}
          {telemetryStatus?.eventsSent !== undefined && (
            <Row label="已发送事件" desc={String(telemetryStatus.eventsSent)} />
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>本地 MCP 服务器</SectionTitle>
        <Card>
          <Row desc="添加和管理你正在使用的 MCP 服务器。" />
        </Card>
      </section>

      {/* 空状态 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '40px 0 0',
          textAlign: 'center',
        }}
      >
        <McpIllustration />
        <div style={{ fontSize: 13, color: 'var(--c-textSub)' }}>未添加服务器</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={() => navigate('/settings')}>编辑配置</Button>
          <Button variant="secondary" onClick={() => window.open('https://modelcontextprotocol.io/docs', '_blank')}>
            开发者文档 <ExternalIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function McpIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* 显示器 */}
      <rect x="14" y="18" width="52" height="36" rx="3" stroke="var(--c-text)" strokeWidth="1.6" />
      {/* 屏幕内 MCP 立方体 */}
      <g transform="translate(28 26)">
        <path d="M12 4l10 5v10l-10 5L2 19V9l10-5z" stroke="var(--c-text)" strokeWidth="1.4" />
        <path d="M2 9l10 5 10-5M12 14v10" stroke="var(--c-text)" strokeWidth="1.4" />
      </g>
      {/* 显示器底座 */}
      <path d="M32 60h16M28 64h24" stroke="var(--c-text)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ====================================================================
 *  更新
 * ==================================================================== */

function UpdatesSection() {
  const {
    currentVersion, updateInfo, updateHistory,
    checkUpdate, downloadUpdate, openReleasePage,
    refreshHistory, updaterLoading,
  } = useAppStore();

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>应用更新</SectionTitle>
        <Card>
          <Row label="当前版本" desc={currentVersion || '加载中…'} />
          {updateInfo && updateInfo.version !== currentVersion ? (
            <>
              <Row label="最新版本" desc={`v${updateInfo.version}: ${updateInfo.title}`} />
              <Row label="">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" onClick={() => downloadUpdate(updateInfo.downloadURL)}>
                    下载并安装
                  </Button>
                  <Button variant="secondary" onClick={openReleasePage}>
                    查看详情
                  </Button>
                </div>
              </Row>
            </>
          ) : (
            <Row label="最新版本" desc="已是最新" />
          )}
          <Row label="">
            <Button variant="secondary" onClick={checkUpdate} disabled={updaterLoading}>
              {updaterLoading ? '检查中…' : '立即检查更新'}
            </Button>
          </Row>
        </Card>
      </section>

      {updateHistory.length > 0 && (
        <section>
          <SectionTitle>更新历史</SectionTitle>
          <Card>
            {updateHistory.slice(0, 10).map((r, i) => (
              <Row
                key={i}
                label={`${r.fromVersion} → ${r.toVersion}`}
                desc={`${r.success ? '成功' : '失败'} · ${r.notes || '无备注'}`}
              />
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

/* ====================================================================
 *  通用原子组件
 * ==================================================================== */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px', color: 'var(--c-text)' }}>{children}</h2>;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function Row({
  label, desc, link, htmlFor, children,
}: {
  label?: string; desc?: React.ReactNode; link?: string; htmlFor?: string;
  children?: React.ReactNode;
}) {
  const hasContent = !!children && children !== (<div />);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '14px 16px',
        borderTop: '1px solid var(--c-divider)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && (
          <label
            htmlFor={htmlFor}
            style={{ display: 'block', fontSize: 13, color: 'var(--c-text)', fontWeight: 500, marginBottom: desc ? 4 : 0 }}
          >
            {label}
          </label>
        )}
        {desc && (
          <div style={{ fontSize: 12, color: 'var(--c-textSub)', lineHeight: 1.5 }}>
            {desc}
            {link && (
              <a style={{ color: 'var(--c-textSub)', textDecoration: 'underline', marginLeft: 4 }} href="https://docs.anthropic.com/zh-CN/docs/claude-code" target="_blank" rel="noopener noreferrer">
                {link}
              </a>
            )}
          </div>
        )}
      </div>
      {hasContent && (
        <div style={{ flex: '0 1 360px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function TextInput({ id, value, onChange, placeholder }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '7px 10px',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        color: 'var(--c-text)',
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color var(--dur-fast) var(--ease)',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--c-textSub)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--c-border)')}
    />
  );
}

function TextArea({ id, value, onChange, placeholder, rows = 3 }: any) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        padding: '8px 10px',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        color: 'var(--c-text)',
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
        resize: 'vertical',
        minHeight: 60,
        transition: 'border-color var(--dur-fast) var(--ease)',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--c-textSub)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--c-border)')}
    />
  );
}

function Select({ id, value, onChange, options, placeholder }: any) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '7px 30px 7px 10px',
          background: 'var(--c-bg)',
          border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-md)',
          color: value ? 'var(--c-text)' : 'var(--c-textMute)',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
        }}
      >
        {placeholder && !value && <option value="">{placeholder}</option>}
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        width="10" height="10" viewBox="0 0 10 10" fill="none"
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--c-textMute)' }}
      >
        <path d="m3 4 2 2 2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Segmented({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label?: string; icon?: React.ReactNode }[];
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
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              background: active ? 'var(--c-surface)' : 'transparent',
              color: active ? 'var(--c-text)' : 'var(--c-textSub)',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              fontSize: 12,
              fontWeight: active ? 500 : 400,
              cursor: 'pointer',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--dur-fast) var(--ease)',
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 32,
        height: 18,
        background: checked ? 'var(--c-accent)' : 'var(--c-bgSub)',
        border: '1px solid ' + (checked ? 'var(--c-accent)' : 'var(--c-border)'),
        borderRadius: 'var(--r-pill)',
        position: 'relative',
        cursor: 'pointer',
        padding: 0,
        transition: 'all var(--dur-base) var(--ease)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: checked ? 15 : 1,
          width: 14,
          height: 14,
          background: '#fff',
          borderRadius: '50%',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transition: 'left var(--dur-base) var(--ease)',
        }}
      />
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'C';
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #D4C8A8 0%, #B89A6E 100%)',
        color: '#3a2e1c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {initial}{name.trim().charAt(1) || ''}
    </div>
  );
}

function KeyChip({ label, onClear }: { label: string; onClear?: () => void }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 6px 4px 10px',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--r-md)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: 'var(--c-text)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {label}
      {onClear && (
        <button
          onClick={onClear}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            marginLeft: 4,
            background: 'transparent',
            border: 'none',
            borderRadius: '50%',
            color: 'var(--c-textMute)',
            cursor: 'pointer',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M2 5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M4 8l4-4M4.5 4H8v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


