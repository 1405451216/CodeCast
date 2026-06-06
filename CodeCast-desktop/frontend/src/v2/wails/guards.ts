// frontend/src/v2/wails/guards.ts
import type { GitStatus } from './types';

export function parseGitStatus(raw: unknown): GitStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    branch: typeof r.branch === 'string' ? r.branch : '',
    ahead:  typeof r.ahead  === 'number' ? r.ahead  : 0,
    behind: typeof r.behind === 'number' ? r.behind : 0,
    dirty:  typeof r.dirty  === 'number' ? r.dirty  : 0,
  };
}
