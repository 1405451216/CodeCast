import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { Button } from '../components/primitives/Button';
import { TopBar } from '../layout/TopBar';
import { Skills, Files } from '../wails/adapter';
import { ConfirmDialog } from '../components/primitives/ConfirmDialog';
import { Breadcrumb } from '../components/primitives/Breadcrumb';
import { useToast } from '../components/primitives/Toast';
import type { Skill } from '../wails/types';
import { useI18n } from '../lib/useI18n';

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

// NAV is now built inside the component using i18n
function getNav(t: ReturnType<typeof useI18n>): NavGroup[] {
  return [
    {
      items: [
        { id: 'general', label: t.settings.general },
        { id: 'privacy', label: t.settings.privacy },
        { id: 'skills', label: t.settings.skills },
        { id: 'connectors', label: t.settings.connectors },
      ],
    },
    {
      items: [
        { id: 'codecast', label: t.settings.codecast },
        { id: 'cowork', label: t.settings.cowork },
      ],
    },
    {
      title: t.settings.desktopApp,
      items: [
        { id: 'desktop-general', label: t.settings.general },
        { id: 'extensions', label: t.settings.extensions },
        { id: 'developer', label: t.settings.developer },
        { id: 'updates', label: t.settings.updates },
      ],
    },
  ];
}

/* ====================================================================
 *  页面外壳
 * ==================================================================== */

export function SettingsPage() {
  const t = useI18n();
  const navigate = useNavigate();
  const [active, setActive] = useState<SectionId>('general');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => navigate('/')} backLabel={t.settings.title} />
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
          {getNav(t).map((group, gi) => (
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
          <div style={{ maxWidth: 'var(--page-max-width)', margin: '0 auto' }}>
            <Breadcrumb items={[{ label: t.settings.title }]} />
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
  const t = useI18n();
  const { theme, setTheme, settings, updateKey } = useAppStore();
  const [fullName, setFullName] = useState(() => { try { return localStorage.getItem('codecast-full-name') || ''; } catch { return ''; } });
  const [callYou, setCallYou] = useState(() => { try { return localStorage.getItem('codecast-call-you') || ''; } catch { return ''; } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* 个人资料 */}
      <section>
        <SectionTitle>{t.settings.profile}</SectionTitle>
        <Card>
          <Row label={t.settings.avatar}>
            <Avatar name={fullName || 'CC'} />
          </Row>
          <Row label={t.settings.fullName} htmlFor="fullname">
            <TextInput id="fullname" value={fullName} onChange={(v) => { setFullName(v); try { localStorage.setItem('codecast-full-name', v); } catch { /* ignore */ } }} />
          </Row>
          <Row label={t.settings.callYou} htmlFor="callyou">
            <TextInput id="callyou" value={callYou} onChange={(v) => { setCallYou(v); try { localStorage.setItem('codecast-call-you', v); } catch { /* ignore */ } }} />
          </Row>
          <Row label={t.settings.workDesc} htmlFor="workdesc">
            <Select
              id="workdesc"
              value={settings?.personality ?? ''}
              onChange={(v: string) => updateKey('personality', v)}
              placeholder={t.settings.selectPlaceholder}
              options={[
                { value: 'engineering', label: t.settings.workOptions.engineering },
                { value: 'product', label: t.settings.workOptions.product },
                { value: 'research', label: t.settings.workOptions.research },
                { value: 'operations', label: t.settings.workOptions.operations },
                { value: 'marketing', label: t.settings.workOptions.marketing },
                { value: 'student', label: t.settings.workOptions.student },
                { value: 'other', label: t.settings.workOptions.other },
              ]}
            />
          </Row>
          <Row
            label={t.settings.castInstructions}
            htmlFor="castInstr"
            desc={t.settings.castInstructionsDesc}
            link={t.settings.learnMore}
          >
            <TextArea
              id="castInstr"
              value={settings?.custom_instructions ?? ''}
              onChange={(v: string) => updateKey('custom_instructions', v)}
              placeholder={t.settings.castInstructionsPlaceholder}
              rows={4}
            />
          </Row>
        </Card>
      </section>

      {/* 偏好设置 */}
      <section>
        <SectionTitle>{t.settings.preferences}</SectionTitle>
        <Card>
          <Row label={t.settings.appearance}>
            <Segmented
              value={theme}
              onChange={(v) => setTheme(v as any)}
              options={[
                { value: 'system', label: t.settings.themeSystem, icon: themeIcon('system') },
                { value: 'light', label: t.settings.themeLight, icon: themeIcon('light') },
                { value: 'dark', label: t.settings.themeDark, icon: themeIcon('dark') },
              ]}
            />
          </Row>
          <Row label={t.settings.chatFont} htmlFor="chatfont">
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
        <SectionTitle>{t.settings.notifications}</SectionTitle>
        <Card>
          <Row label={t.settings.notifyComplete} desc={t.settings.notifyCompleteDesc}>
            <Toggle checked={settings?.notify_complete === 'true'} onChange={(v) => updateKey('notify_complete', v ? 'true' : 'false')} />
          </Row>
          <Row label={t.settings.notifyPermission} desc={t.settings.notifyPermissionDesc}>
            <Toggle checked={settings?.notify_permission ?? true} onChange={(v) => updateKey('notify_permission', v)} />
          </Row>
          <Row label={t.settings.notifyIssue} desc={t.settings.notifyIssueDesc}>
            <Toggle checked={settings?.notify_issue ?? true} onChange={(v) => updateKey('notify_issue', v)} />
          </Row>
        </Card>
      </section>

      {/* 浏览器控制 */}
      <section>
        <SectionTitle>{t.settings.browserControl}</SectionTitle>
        <Card>
          <Row label={t.settings.allowBrowser} desc={t.settings.allowBrowserDesc}>
            <Toggle checked={settings?.allow_browser ?? false} onChange={(v) => updateKey('allow_browser', v)} />
          </Row>
          <Row label={t.settings.browserApproval} desc={t.settings.browserApprovalDesc}>
            <select
              value={settings?.browser_approval ?? 'always'}
              onChange={(e) => updateKey('browser_approval', e.target.value)}
              style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', background: 'var(--c-surface)', color: 'var(--c-text)' }}
            >
              <option value="always">{t.settings.browserAlways}</option>
              <option value="first">{t.settings.browserFirst}</option>
              <option value="never">{t.settings.browserNever}</option>
            </select>
          </Row>
        </Card>
      </section>

      {/* Git 设置 */}
      <section>
        <SectionTitle>{t.settings.gitSettings}</SectionTitle>
        <Card>
          <Row label={t.settings.autoCommit} desc={t.settings.autoCommitDesc}>
            <Toggle checked={settings?.auto_commit ?? false} onChange={(v) => updateKey('auto_commit', v)} />
          </Row>
          <Row label={t.settings.confirmBeforeCommit} desc={t.settings.confirmBeforeCommitDesc}>
            <Toggle checked={settings?.confirm_before_commit ?? true} onChange={(v) => updateKey('confirm_before_commit', v)} />
          </Row>
          <Row label={t.settings.useWorktree} desc={t.settings.useWorktreeDesc}>
            <Toggle checked={settings?.use_worktree ?? false} onChange={(v) => updateKey('use_worktree', v)} />
          </Row>
        </Card>
      </section>

      {/* SMTP 设置 */}
      <section>
        <SectionTitle>{t.settings.smtp}</SectionTitle>
        <Card>
          <Row label={t.settings.smtpServer} desc={t.settings.smtpServerDesc}>
            <input value={settings?.smtp_host ?? ''} onChange={(e) => updateKey('smtp_host', e.target.value)} placeholder="smtp.example.com" style={inputStyle} />
          </Row>
          <Row label={t.settings.smtpPort} desc={t.settings.smtpPortDesc}>
            <input value={settings?.smtp_port ?? ''} onChange={(e) => updateKey('smtp_port', e.target.value)} placeholder="587" style={{ ...inputStyle, width: 80 }} />
          </Row>
          <Row label={t.settings.smtpUser} desc={t.settings.smtpUserDesc}>
            <input value={settings?.smtp_user ?? ''} onChange={(e) => updateKey('smtp_user', e.target.value)} placeholder="user@example.com" style={inputStyle} />
          </Row>
          <Row label={t.settings.smtpPass} desc={t.settings.smtpPassDesc}>
            <input type="password" value={settings?.smtp_pass ?? ''} onChange={(e) => updateKey('smtp_pass', e.target.value)} placeholder="••••••" style={inputStyle} />
          </Row>
        </Card>
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--c-border)',
  borderRadius: 'var(--r-sm)',
  background: 'var(--c-bg)',
  color: 'var(--c-text)',
  fontSize: 13,
  outline: 'none',
  width: 200,
};

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
  const t = useI18n();
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
        {t.settings.privacyInfo.split('<provider />')[0]}<span style={{ fontFamily: 'var(--font-mono)' }}>(127.0.0.1:15721)</span>{t.settings.privacyInfo.split('<provider />')[1]}
      </div>

      {/* Anthropic 不会看到的内容 */}
      <Block>
        <BlockTitle>{t.settings.anthropicCannotSee}</BlockTitle>
        <ul style={{ listStyle: 'disc', paddingLeft: 20, margin: 0, fontSize: 13, color: 'var(--c-text)', lineHeight: 1.9 }}>
          {t.settings.anthropicCannotSeeItems.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </Block>

      {/* Anthropic 可能收到的内容 */}
      <Block>
        <BlockTitle>
          {t.settings.anthropicMayReceive}
          <span style={{ color: 'var(--c-textMute)', fontWeight: 400, marginLeft: 6 }}>{t.settings.anthropicMayReceiveByOrg}</span>
        </BlockTitle>
        <ul style={{ listStyle: 'disc', paddingLeft: 20, margin: 0, fontSize: 13, color: 'var(--c-text)', lineHeight: 1.9 }}>
          {t.settings.anthropicMayReceiveItems.map((item, i) => <li key={i}>{item}</li>)}
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
  const t = useI18n();
  const toast = useToast();
  const [artifacts, setArtifacts] = useState(true);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [skillSearch, setSkillSearch] = useState('');
  const filteredSkills = skillSearch.trim()
    ? skills.filter(s => s.name.toLowerCase().includes(skillSearch.toLowerCase()) || (s.description || '').toLowerCase().includes(skillSearch.toLowerCase()))
    : skills;

  const loadSkills = async () => {
    setLoading(true);
    try {
      setSkills(await Skills.list());
    } catch (e) {
      toast.show(e instanceof Error ? e.message : t.settings.loadSkillFailed, 'danger');
    }
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
    } catch (e) {
      toast.show(e instanceof Error ? e.message : t.settings.saveSkillFailed, 'danger');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await Skills.delete(confirmDeleteId);
      await loadSkills();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : t.settings.deleteSkillFailed, 'danger');
    }
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
        <SectionTitle>{t.settings.visualEffects}</SectionTitle>
        <Card>
          <Row label={t.settings.artifacts} desc={t.settings.artifactsDesc}>
            <Toggle checked={artifacts} onChange={setArtifacts} />
          </Row>
        </Card>
      </section>
      <section>
        <SectionTitle>{t.settings.skills}</SectionTitle>
        <Card>
          {skills.length > 2 && (
            <Row label="">
              <input
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                placeholder={t.settings.searchSkills}
                style={inputStyle}
              />
            </Row>
          )}
          {loading ? (
            <Row label="" desc={t.settings.loading} />
          ) : filteredSkills.length === 0 && !showForm ? (
            <Row label="" desc={skillSearch ? t.settings.noMatchSkill : t.settings.noCustomSkills}>
              {!skillSearch && (
                <Button variant="primary" onClick={() => { setShowForm(true); setEditId(null); setFormName(''); setFormDesc(''); setFormPrompt(''); }}>
                  {t.settings.newSkill}
                </Button>
              )}
            </Row>
          ) : (
            <>
              {filteredSkills.map((s) => (
                <Row
                  key={s.id}
                  label={s.name}
                  desc={s.description.length > 80 ? s.description.slice(0, 80) + '…' : s.description}
                >
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="secondary" onClick={() => startEdit(s)}>{t.settings.edit}</Button>
                    <Button variant="secondary" onClick={() => handleDelete(s.id)}>{t.settings.delete}</Button>
                  </div>
                </Row>
              ))}
              {!showForm && (
                <Row label="">
                  <Button variant="primary" onClick={() => { setShowForm(true); setEditId(null); setFormName(''); setFormDesc(''); setFormPrompt(''); }}>
                    {t.settings.newSkill}
                  </Button>
                </Row>
              )}
            </>
          )}
          {showForm && (
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--c-divider)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TextInput value={formName} onChange={setFormName} placeholder={t.settings.skillName} />
              <TextInput value={formDesc} onChange={setFormDesc} placeholder={t.settings.desc} />
              <TextArea value={formPrompt} onChange={setFormPrompt} placeholder={t.settings.prompt} rows={3} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>{t.settings.cancel}</Button>
                <Button variant="primary" onClick={handleSave}>{editId ? t.settings.save : t.settings.create}</Button>
              </div>
            </div>
          )}
        </Card>
      </section>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t.settings.deleteSkill}
        message={t.settings.deleteSkillConfirm}
        confirmLabel={t.settings.delete}
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
  const t = useI18n();
  const navigate = useNavigate();
  const { servers } = useAppStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>{t.settings.mcpConnectors}</SectionTitle>
        <Card>
          <Row
            label={t.settings.mcpServers}
            desc={servers.length > 0 ? t.settings.mcpConnected(servers.filter(s => s.connected).length, servers.length) : t.settings.mcpNotConfigured}
          >
            <Button variant="secondary" onClick={() => navigate('/cast-tools')}>{t.settings.viewTools}</Button>
          </Row>
          {servers.map((s) => (
            <Row
              key={s.id}
              label={s.name}
              desc={s.connected ? t.settings.connected : s.error || t.settings.notConnected}
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
  const t = useI18n();
  const { settings, updateKey } = useAppStore();
  const [codeLight, setCodeLight] = useState(t.settings.codeCastLight);
  const [codeDark, setCodeDark] = useState(t.settings.codeCastDark);
  const [codeFont, setCodeFont] = useState('');
  const [uiFont, setUiFont] = useState<'sans' | 'system'>('sans');
  const [transcriptSize, setTranscriptSize] = useState<'sm' | 'md' | 'lg'>('md');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* 代码外观 */}
      <section>
        <SectionTitle>{t.settings.codeAppearance}</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <CodeThemeCard
            theme={codeLight}
            onChange={setCodeLight}
            label={t.settings.codeCastLight}
            dark={false}
            sample={SAMPLE_CODE}
          />
          <CodeThemeCard
            theme={codeDark}
            onChange={setCodeDark}
            label={t.settings.codeCastDark}
            dark
            sample={SAMPLE_CODE}
          />
        </div>
        <Card>
          <Row
            label={t.settings.codeFont}
            htmlFor="codefont"
            desc={t.settings.codeFontDesc}
          >
            <TextInput
              id="codefont"
              value={codeFont}
              onChange={setCodeFont}
              placeholder={t.settings.codeFontPlaceholder}
            />
          </Row>
        </Card>
      </section>

      {/* 外观 */}
      <section>
        <SectionTitle>{t.settings.appearanceSection}</SectionTitle>
        <Card>
          <Row label={t.settings.highContrast} desc={t.settings.highContrastDesc}>
            <Toggle checked={settings?.theme === 'high-contrast'} onChange={(v) => updateKey('theme', v ? 'high-contrast' : settings?.theme === 'high-contrast' ? 'dark' : (settings?.theme ?? 'dark'))} />
          </Row>
          <Row
            label={t.settings.uiFont}
            htmlFor="uifont"
            desc={t.settings.uiFontDesc}
          >
            <Segmented
              value={uiFont}
              onChange={(v) => setUiFont(v as any)}
              options={[
                { value: 'sans', label: 'Anthropic Sans' },
                { value: 'system', label: t.settings.themeSystem },
              ]}
            />
          </Row>
          <Row label={t.settings.transcriptSize} desc={t.settings.transcriptSizeDesc}>
            <Segmented
              value={transcriptSize}
              onChange={(v) => setTranscriptSize(v as any)}
              options={[
                { value: 'sm', label: t.settings.sizeSmall },
                { value: 'md', label: t.settings.sizeMedium },
                { value: 'lg', label: t.settings.sizeLarge },
              ]}
            />
          </Row>
        </Card>
      </section>

      {/* 本地会话 */}
      <section>
        <SectionTitle>{t.settings.localSessions}</SectionTitle>
        <Card>
          <Row
            label={t.settings.allowBypass}
            desc={
              <span>
                {t.settings.allowBypassDesc}{' '}
                <a href="https://docs.codecast.dev/security/best-practices" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c-accentText)', textDecoration: 'underline' }}>{t.settings.allowBypassSecurityLink}</a>
              </span>
            }
          >
            <Toggle checked={settings?.full_access ?? false} onChange={(v) => updateKey('full_access', v)} />
          </Row>
          <Row label={t.settings.defaultRemoteControl}>
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
  const t = useI18n();
  const { settings, updateKey, stats } = useAppStore();
  const toast = useToast();
  const sizeStr = stats.sizeBytes > 0 ? `${(stats.sizeBytes / 1024).toFixed(1)} KB` : '—';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cowork 文件 */}
      <Card>
        <Row
          label={t.settings.coworkFiles}
          desc={
            <span>
              {t.settings.coworkFilesDesc}{' '}
              <a style={{ color: 'var(--c-accentText)' }}>C:\Users\Administrator\CodeCast</a>。
            </span>
          }
        >
          <Button variant="secondary" icon={<FolderIcon />} onClick={() => Files.selectFolder().then((p) => { if (p) toast.show(t.settings.workDirSelected(p)); })}>{t.settings.change}</Button>
        </Row>
        {/* 全局指令已移至"给 CodeCast 的指令"（通用设置），避免重复 */}
      </Card>

      {/* 记忆 */}
      <section>
        <SectionTitle>{t.settings.memory}</SectionTitle>
        <Card>
          <Row
            label={t.settings.useMemoryInSession}
            desc={t.settings.useMemoryDesc}
          >
            <Toggle checked={settings?.auto_memory ?? false} onChange={(v) => updateKey('auto_memory', v)} />
          </Row>
          <Row
            label={t.settings.memoryStats}
            desc={t.settings.memoryStatsDesc(stats.totalEpisodes, sizeStr)}
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
  const t = useI18n();
  const { settings, updateKey } = useAppStore();
  const shortcut = settings?.hotkey ?? 'Control+Alt+Space';
  return (
    <section>
      <SectionTitle>{t.settings.desktopGeneral}</SectionTitle>
      <Card>
        <Row label={t.settings.runOnStartup} desc={t.settings.runOnStartupDesc}>
          <Toggle checked={settings?.desktop_run_on_startup ?? false} onChange={(v) => updateKey('desktop_run_on_startup', v)} />
        </Row>
        <Row
          label={t.settings.quickInputShortcut}
          desc={t.settings.quickInputDesc}
        >
          <KeyChip label={shortcut} onClear={() => updateKey('hotkey', 'Control+Alt+Space')} />
        </Row>
        <Row label={t.settings.systemTray} desc={t.settings.systemTrayDesc}>
          <Toggle checked={settings?.desktop_system_tray ?? true} onChange={(v) => updateKey('desktop_system_tray', v)} />
        </Row>
        <Row
          label={t.settings.keepAwake}
          desc={t.settings.keepAwakeDesc}
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
  const t = useI18n();
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>{t.settings.extensionsTitle}</SectionTitle>
        <Card>
          <Row
            desc={t.settings.extensionsDesc}
          >
            <Button variant="secondary" onClick={() => navigate('/plugins')}>{t.settings.browseExtensions}</Button>
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
  const t = useI18n();
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
        <SectionTitle>{t.settings.agentCheckpoints}</SectionTitle>
        <Card>
          <Row
            label={t.settings.currentSessionCheckpoints}
            desc={currentSessionId ? t.settings.checkpointsRecorded(checkpoints.length) : t.settings.noSessionSelected}
          >
            <Button
              variant="secondary"
              onClick={() => currentSessionId && loadCheckpoints(currentSessionId, 50)}
            >
              {t.settings.refresh}
            </Button>
          </Row>
          {checkpointLoading ? (
            <Row label="" desc={t.settings.loadingDots} />
          ) : checkpoints.length === 0 ? (
            <Row label="" desc={t.settings.noRecords} />
          ) : (
            checkpoints.slice(0, 10).map((cp) => (
              <Row
                key={cp.ID}
                label={`#${cp.Turn} · ${cp.ToolName}`}
                desc={`${cp.Status} · ${cp.CreatedAt}`}
              >
                <Button variant="secondary" onClick={() => deleteCheckpoint(cp.ID)}>
                  {t.settings.deleteBtn}
                </Button>
              </Row>
            ))
          )}
        </Card>
      </section>

      {/* Security 子区 */}
      <section>
        <SectionTitle>{t.settings.security}</SectionTitle>
        <Card>
          <Row
            label={t.settings.encryptionStatus}
            desc={securityStatus ? (securityStatus.encryptionEnabled ? t.settings.encryptionEnabled : t.settings.encryptionDisabled) : t.settings.loadingDots}
          />
          {securityStatus?.lastKeyRotation && (
            <Row label={t.settings.lastKeyRotation} desc={securityStatus.lastKeyRotation} />
          )}
          <Row label={t.settings.keyRotation} desc={securityStatus?.keyRotationDue ? t.settings.keyRotationDue : t.settings.keyRotationNormal}>
            <Button variant="secondary" onClick={rotateKey}>{t.settings.rotateNow}</Button>
          </Row>
        </Card>
      </section>

      {/* Telemetry 子区 */}
      <section>
        <SectionTitle>{t.settings.telemetry}</SectionTitle>
        <Card>
          <Row label={t.settings.enableTelemetry} desc={t.settings.telemetryDesc}>
            <Toggle checked={telemetryStatus?.enabled ?? false} onChange={toggleTelemetry} />
          </Row>
          {telemetryStatus?.endpoint && (
            <Row label={t.settings.endpoint} desc={telemetryStatus.endpoint} />
          )}
          {telemetryStatus?.eventsSent !== undefined && (
            <Row label={t.settings.eventsSent} desc={String(telemetryStatus.eventsSent)} />
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>{t.settings.localMcpServers}</SectionTitle>
        <Card>
          <Row desc={t.settings.localMcpServersDesc} />
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
        <div style={{ fontSize: 13, color: 'var(--c-textSub)' }}>{t.settings.noServersAdded}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" onClick={() => navigate('/settings')}>{t.settings.editConfig}</Button>
          <Button variant="secondary" onClick={() => window.open('https://modelcontextprotocol.io/docs', '_blank')}>
            {t.settings.developerDocs} <ExternalIcon />
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
  const t = useI18n();
  const {
    currentVersion, updateInfo, updateHistory,
    checkUpdate, downloadUpdate, openReleasePage,
    refreshHistory, updaterLoading,
  } = useAppStore();

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionTitle>{t.settings.appUpdates}</SectionTitle>
        <Card>
          <Row label={t.settings.currentVersion} desc={currentVersion || t.settings.loadingDots} />
          {updateInfo && updateInfo.version !== currentVersion ? (
            <>
              <Row label={t.settings.latestVersion} desc={t.settings.latestVersionInfo(updateInfo.version, updateInfo.title)} />
              <Row label="">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" onClick={() => downloadUpdate(updateInfo.downloadURL)}>
                    {t.settings.downloadAndInstall}
                  </Button>
                  <Button variant="secondary" onClick={openReleasePage}>
                    {t.settings.viewDetails}
                  </Button>
                </div>
              </Row>
            </>
          ) : (
            <Row label={t.settings.latestVersion} desc={t.settings.alreadyLatest} />
          )}
          <Row label="">
            <Button variant="secondary" onClick={checkUpdate} disabled={updaterLoading}>
              {updaterLoading ? t.settings.checkingUpdate : t.settings.checkUpdateNow}
            </Button>
          </Row>
        </Card>
      </section>

      {updateHistory.length > 0 && (
        <section>
          <SectionTitle>{t.settings.updateHistory}</SectionTitle>
          <Card>
            {updateHistory.slice(0, 10).map((r, i) => (
              <Row
                key={i}
                label={`${r.fromVersion} → ${r.toVersion}`}
                desc={`${r.success ? t.settings.updateSuccess : t.settings.updateFailed} · ${r.notes || t.settings.noNotes}`}
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


