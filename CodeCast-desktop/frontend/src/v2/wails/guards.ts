// frontend/src/v2/wails/guards.ts
import type { GitStatus } from './types';

/**
 * 安全解析 Go GetGitStatus() 返回的 map[string]interface{} 为 GitStatus。
 * Go 返回结构：{ enabled: bool, branch: string, dirty: bool, ahead: int, behind: int }
 */
export function parseGitStatus(raw: unknown): GitStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    branch:  typeof r.branch  === 'string'  ? r.branch  : '',
    dirty:   typeof r.dirty   === 'boolean' ? r.dirty   : false,
    ahead:   typeof r.ahead   === 'number'  ? r.ahead   : 0,
    behind:  typeof r.behind  === 'number'  ? r.behind  : 0,
  };
}
