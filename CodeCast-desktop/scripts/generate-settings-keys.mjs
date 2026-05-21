/**
 * generate-settings-keys.mjs
 *
 * 从 Go Settings struct 的 json tag 自动生成 TypeScript 常量文件
 * 用法: node scripts/generate-settings-keys.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcPath = join(rootDir, 'main.go');
const outPath = join(rootDir, 'frontend', 'src', 'settingsKeys.ts');

const src = readFileSync(srcPath, 'utf-8');

const jsonTagRe = /`json:"([^"]+)"`/;
const keys = [];
const arrayKeys = [];
let inSettings = false;

const arrayTypePatterns = ['[]MCPServer', '[]EnvVar', '[]SlashCommand', '[]string'];

for (const line of src.split('\n')) {
  if (line.includes('type Settings struct')) {
    inSettings = true;
    continue;
  }
  if (inSettings && line.trim() === '}') break;
  if (!inSettings) continue;

  const match = line.match(jsonTagRe);
  if (!match) continue;

  const key = match[1];
  if (!key || key.includes(',')) continue;

  const isArray = arrayTypePatterns.some(p => line.includes(p));
  if (isArray) {
    arrayKeys.push(key);
  } else {
    keys.push(key);
  }
}

const categorized = {};
for (const k of keys) {
  let cat = 'other';
  if (/work_mode|default_perm|auto_review|full_access|shell|open_target|language|hotkey|ctrl_enter|followup|review_mode/.test(k)) cat = 'work';
  else if (/notify|notification/.test(k)) cat = 'notify';
  else if (/theme|font_size/.test(k)) cat = 'ui';
  else if (/api_key|long_context/.test(k)) cat = 'api';
  else if (/personality|custom_instructions|auto_memory|tool_memory|message_history/.test(k)) cat = 'memory';
  else if (/commit|worktree/.test(k)) cat = 'git';
  else if (/browser|domain|selenium|allow_browser/.test(k)) cat = 'browser';
  else if (/computer_control/.test(k)) cat = 'computer';

  (categorized[cat] ??= []).push(k);
}

const catLabels = {
  work: '工作模式',
  notify: '通知',
  ui: '外观',
  api: 'API',
  memory: '个性化 / 记忆',
  git: 'Git',
  browser: '浏览器',
  computer: '计算机控制',
};

const catOrder = ['work', 'notify', 'ui', 'api', 'memory', 'git', 'browser', 'computer'];

let output = `/**
 * settingsKeys.ts — 由 scripts/generate-settings-keys.mjs 自动生成
 *
 * ⚠️ 请勿手动编辑此文件！修改后端 Settings struct 后重新运行:
 *   node scripts/generate-settings-keys.mjs
 *
 * 生成时间: ${new Date().toISOString()}
 */

export const S = {
`;

for (const cat of catOrder) {
  const items = categorized[cat];
  if (!items?.length) continue;
  output += `\n  // ===== ${catLabels[cat]} =====\n`;
  for (const k of items) {
    output += `  ${k}: '${k}',\n`;
  }
}

if (arrayKeys.length > 0) {
  output += `\n  // ===== 数组 / 对象类型（通过完整 API 操作） =====\n`;
  for (const k of arrayKeys) {
    output += `  ${k}: '${k}',\n`;
  }
}

output += `} as const;

export type SettingKey = typeof S[keyof typeof S];

/** 所有可设置的标量 key（用于 toggle/select/input 绑定） */
export const SCALAR_KEYS: readonly SettingKey[] = [
`;
for (const k of keys) {
  output += `  S.${k},\n`;
}
output += '] as const;\n';

writeFileSync(outPath, output, 'utf-8');
console.log(`✅ 已生成 ${outPath}`);
console.log(`   标量字段: ${keys.length} 个`);
if (arrayKeys.length > 0) console.log(`   数组字段: ${arrayKeys.length} 个 (${arrayKeys.join(', ')})`);
