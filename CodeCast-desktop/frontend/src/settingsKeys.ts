/**
 * settingsKeys.ts — 由 scripts/generate-settings-keys.mjs 自动生成
 *
 * ⚠️ 请勿手动编辑此文件！修改后端 Settings struct 后重新运行:
 *   node scripts/generate-settings-keys.mjs
 *
 * 生成时间: 2026-05-21T05:54:15.462Z
 */

export const S = {

  // ===== 工作模式 =====
  work_mode: 'work_mode',
  default_perm: 'default_perm',
  auto_review: 'auto_review',
  full_access: 'full_access',
  shell: 'shell',
  open_target: 'open_target',
  language: 'language',
  hotkey: 'hotkey',
  ctrl_enter_send: 'ctrl_enter_send',
  followup_mode: 'followup_mode',
  review_mode: 'review_mode',

  // ===== 通知 =====
  notify_complete: 'notify_complete',
  notify_permission: 'notify_permission',
  notify_issue: 'notify_issue',
  notification_turn: 'notification_turn',
  notification_permission: 'notification_permission',
  notification_question: 'notification_question',

  // ===== 外观 =====
  theme: 'theme',
  font_size: 'font_size',

  // ===== API =====
  api_key: 'api_key',
  long_context: 'long_context',

  // ===== 个性化 / 记忆 =====
  personality: 'personality',
  custom_instructions: 'custom_instructions',
  auto_memory: 'auto_memory',
  tool_memory: 'tool_memory',
  message_history_limit: 'message_history_limit',

  // ===== Git =====
  auto_commit: 'auto_commit',
  confirm_before_commit: 'confirm_before_commit',
  use_worktree: 'use_worktree',

  // ===== 浏览器 =====
  allow_browser: 'allow_browser',
  browser_approval: 'browser_approval',
  browser_history: 'browser_history',
  browser_clear_data: 'browser_clear_data',
  browser_plugin: 'browser_plugin',
  selenium_installed: 'selenium_installed',

  // ===== 计算机控制 =====
  computer_control: 'computer_control',

  // ===== 数组 / 对象类型（通过完整 API 操作） =====
  blocked_domains: 'blocked_domains',
  allowed_domains: 'allowed_domains',
  mcp_servers: 'mcp_servers',
  env_vars: 'env_vars',
  slash_commands: 'slash_commands',
  archived_sessions: 'archived_sessions',
} as const;

export type SettingKey = typeof S[keyof typeof S];

/** 所有可设置的标量 key（用于 toggle/select/input 绑定） */
export const SCALAR_KEYS: readonly SettingKey[] = [
  S.work_mode,
  S.default_perm,
  S.auto_review,
  S.full_access,
  S.shell,
  S.open_target,
  S.language,
  S.hotkey,
  S.ctrl_enter_send,
  S.followup_mode,
  S.review_mode,
  S.notify_complete,
  S.notify_permission,
  S.notify_issue,
  S.notification_turn,
  S.notification_permission,
  S.notification_question,
  S.theme,
  S.font_size,
  S.api_key,
  S.long_context,
  S.personality,
  S.custom_instructions,
  S.auto_memory,
  S.tool_memory,
  S.message_history_limit,
  S.auto_commit,
  S.confirm_before_commit,
  S.use_worktree,
  S.allow_browser,
  S.browser_approval,
  S.browser_history,
  S.browser_clear_data,
  S.browser_plugin,
  S.selenium_installed,
  S.computer_control,
] as const;
