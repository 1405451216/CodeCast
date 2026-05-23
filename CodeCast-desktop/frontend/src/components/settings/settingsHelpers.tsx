import React from 'react';

// ─── Types ─────────────────────────────────────────────────────

export interface SettingsData {
  work_mode?: string;
  default_permission?: boolean;
  auto_review?: boolean;
  full_access?: boolean;
  default_target?: string;
  shell?: string;
  language?: string;
  hotkey?: string;
  ctrl_enter?: boolean;
  followup_mode?: string;
  review_mode?: string;
  notification_turn?: string;
  notification_permission?: boolean;
  notification_question?: boolean;
  theme?: string;
  font_size?: string;
  api_key?: string;
  context_1m?: boolean;
  personality?: string;
  custom_instructions?: string;
  memory_self?: boolean;
  memory_tool?: boolean;
  message_history_limit?: number;
  auto_commit?: boolean;
  confirm_before_commit?: boolean;
  worktree_enabled?: boolean;
  computer_control?: boolean;
  blocked_domains?: string[];
  allowed_domains?: string[];
  browser_plugin?: string;
  browser_clear_data?: string;
  browser_approval?: string;
  browser_history?: string;
  mcp_servers?: MCPServerItem[];
  selenium_installed?: boolean;
}

export interface MCPServerItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  command?: string;
  args?: string[];
  enabled: boolean;
}

export interface EnvVarItem {
  key: string;
  value: string;
}

export interface SlashCommandItem {
  id: string;
  name: string;
  description: string;
  fill_text: string;
}

export interface ArchivedSession {
  ID: string;
  Name: string;
  CreatedAt: string;
}

export interface TabProps {
  settings: SettingsData;
  updateAndSave: (key: string, value: any) => Promise<void>;
  isDarwin: boolean;
  modKey: string;
}

// ─── Shared render helpers ─────────────────────────────────────

export function renderToggle(
  key: string,
  checked: boolean,
  label: string,
  updateAndSave: (key: string, value: any) => Promise<void>,
  desc?: string,
) {
  return (
    <div className="settings-row">
      <div className="settings-row-left">
        <div className="settings-row-title">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <button
        className={`toggle${checked ? ' active' : ''}`}
        onClick={() => updateAndSave(key, !checked)}
      />
    </div>
  );
}

export function renderSelect(
  key: string,
  value: string,
  options: { value: string; label: string }[],
  label: string,
  updateAndSave: (key: string, value: any) => Promise<void>,
  desc?: string,
) {
  return (
    <div className="settings-row">
      <div className="settings-row-left">
        <div className="settings-row-title">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <select
        className="settings-select"
        value={value}
        onChange={(e) => updateAndSave(key, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function renderRadioGroup(
  key: string,
  value: string,
  options: { value: string; title: string; desc: string }[],
  updateAndSave: (key: string, value: any) => Promise<void>,
) {
  return (
    <div className="settings-radio-group">
      {options.map((o) => (
        <div
          key={o.value}
          className={`settings-radio-card${value === o.value ? ' selected' : ''}`}
          onClick={() => updateAndSave(key, o.value)}
        >
          <div className="settings-radio-dot" />
          <div className="settings-radio-body">
            <div className="settings-radio-title">{o.title}</div>
            <div className="settings-radio-desc">{o.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
