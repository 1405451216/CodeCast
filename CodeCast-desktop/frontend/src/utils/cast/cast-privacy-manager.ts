import type {
  OutboundAuditLog,
  OutboundCategory,
  PrivacyLevel,
  PrivacyPolicyConfig,
  PrivacyPolicyMode,
  PrivacyReport,
  OutboundDecision
} from '../../types/cast-privacy';
import { DEFAULT_PRIVACY_CONFIG } from '../../types/cast-privacy';

function generateId(prefix: string = 'priv'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function extractDomain(url: string): string {
  try {
    if (!url || url.startsWith('/')) return 'local';
    const u = new URL(url);
    return u.hostname;
  } catch {
    return 'unknown';
  }
}

function classifyUrl(url: string, method: string): OutboundCategory {
  const lower = url.toLowerCase();
  const host = extractDomain(url);

  if (host === 'local' || url.startsWith('/')) return 'custom';
  if (lower.includes('openai.com') || lower.includes('anthropic.com') ||
      lower.includes('deepseek') || lower.includes('gemini') ||
      lower.includes('ollama') || lower.includes('api.')) return 'llm_api';
  if (lower.includes('feishu.cn') || lower.includes('dingtalk.com') ||
      lower.includes('qyapi.weixin.qq.com') || lower.includes('slack.com') ||
      lower.includes('discord.com') || lower.includes('webhook')) return 'webhook';
  if (method === 'NAVIGATE' || method === 'GET_PAGE' || lower.startsWith('http://') || lower.startsWith('https://')) return 'browser';
  if (lower.includes('smtp') || lower.includes('mail') || lower.includes('email')) return 'email';

  return 'unknown';
}

function estimateDataSize(data: unknown): number {
  if (!data) return 0;
  if (typeof data === 'string') return new Blob([data]).size;
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
}

function maskSensitiveContent(data: unknown, maxPreviewLen: number = 120): string {
  const raw = typeof data === 'string' ? data : JSON.stringify(data);
  if (!raw || raw.length <= maxPreviewLen) return raw || '(empty)';
  let masked = raw.slice(0, maxPreviewLen);
  const patterns: RegExp[] = [
    new RegExp('("api[_-]?key"\\s*:\\s*)"[^"]+"', 'gi'),
    new RegExp('("token"\\s*:\\s*)"[^"]+"', 'gi'),
    new RegExp('("password"\\s*:\\s*)"[^"]+"', 'gi'),
    new RegExp('("secret"\\s*:\\s*)"[^"]+"', 'gi'),
    /(sk-[a-zA-Z0-9]{20,})/g,
    /(Bearer\s+[a-zA-Z0-9._-]+)/g
  ];
  for (const p of patterns) {
    masked = masked.replace(p, '$1***$2');
  }
  return masked + `... (${(raw.length / 1024).toFixed(1)}KB total)`;
}

type ConfirmCallback = (payload: {
  url: string;
  domain: string;
  category: OutboundCategory;
  dataSize: number;
  preview: string;
  resolve: (decision: 'allow' | 'deny' | 'allow_remember') => void;
}) => void;

class CastPrivacyManager {
  private auditLogs: OutboundAuditLog[] = [];
  private config: PrivacyPolicyConfig = { ...DEFAULT_PRIVACY_CONFIG };
  private confirmCallback: ConfirmCallback | null = null;
  private pendingConfirmations: Map<string, { resolve: (decision: 'allow' | 'deny' | 'allow_remember') => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  private domainMemory: Map<string, 'allow' | 'deny'> = new Map();
  private listeners: Set<(log: OutboundAuditLog) => void> = new Set();

  constructor() {
    this.loadConfig();
  }

  setConfirmCallback(cb: ConfirmCallback | null): void {
    this.confirmCallback = cb;
  }

  onAuditLog(listener: (log: OutboundAuditLog) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getConfig(): PrivacyPolicyConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<PrivacyPolicyConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_PRIVACY_CONFIG };
    this.saveConfig();
  }

  async auditOutbound(params: {
    url: string;
    method?: string;
    data?: unknown;
    category?: OutboundCategory;
    reason?: string;
    privacyLevel?: PrivacyLevel;
  }): Promise<{ allowed: boolean; logId: string }> {
    const url = params.url || '';
    const method = params.method || 'POST';
    const category = params.category || classifyUrl(url, method);
    const domain = extractDomain(url);
    const dataSize = estimateDataSize(params.data);
    const privacyLevel = params.privacyLevel || this.inferPrivacyLevel(category, params.data);
    const reason = params.reason || `${category} request to ${domain}`;

    const decision = await this.shouldAllowOutbound({ url, method, category, domain, privacyLevel });

    const log: OutboundAuditLog = {
      id: generateId('audit'),
      url,
      method,
      dataSize,
      timestamp: Date.now(),
      category,
      reason,
      privacyLevel,
      decision: decision.allowed ? 'allowed' : decision.decision === 'pending_confirmation' ? 'pending_confirmation' : 'denied',
      userConfirmed: decision.userConfirmed,
      domain,
      duration: undefined,
      statusCode: undefined
    };

    this.addAuditLog(log);

    return { allowed: decision.allowed, logId: log.id };
  }

  completeAudit(logId: string, result: { statusCode?: number; duration?: number }): void {
    const log = this.auditLogs.find(l => l.id === logId);
    if (log) {
      log.statusCode = result.statusCode;
      log.duration = result.duration;
      this.listeners.forEach(fn => { try { fn(log); } catch {} });
    }
  }

  private async shouldAllowOutbound(params: {
    url: string;
    method: string;
    category: OutboundCategory;
    domain: string;
    privacyLevel: PrivacyLevel;
  }): Promise<{ allowed: boolean; userConfirmed: boolean; decision: OutboundDecision }> {
    const mode = this.config.mode;

    if (mode === 'deny_all') {
      return { allowed: false, userConfirmed: false, decision: 'denied' };
    }

    if (mode === 'allow_all') {
      return { allowed: true, userConfirmed: false, decision: 'allowed' };
    }

    if (this.config.exemptDomains.some(d => params.domain === d || params.domain.endsWith('.' + d))) {
      return { allowed: true, userConfirmed: false, decision: 'allowed' };
    }

    const remembered = this.domainMemory.get(params.domain);
    if (remembered === 'allow') {
      return { allowed: true, userConfirmed: true, decision: 'allowed' };
    }
    if (remembered === 'deny') {
      return { allowed: false, userConfirmed: true, decision: 'denied' };
    }

    const matchedRule = this.config.rules.find(r =>
      r.enabled &&
      new RegExp(r.pattern, 'i').test(params.url) &&
      r.category === params.category
    );

    if (matchedRule) {
      if (matchedRule.action === 'allow') return { allowed: true, userConfirmed: false, decision: 'allowed' };
      if (matchedRule.action === 'deny') return { allowed: false, userConfirmed: false, decision: 'blocked' };
    }

    if (mode === 'prompt_all' || (mode === 'custom' && (!matchedRule || matchedRule?.action === 'prompt'))) {
      if (this.confirmCallback && this.config.showOutboundConfirmation) {
        return new Promise(resolve => {
          const confirmId = generateId('confirm');
          const timer = setTimeout(() => {
            this.pendingConfirmations.delete(confirmId);
            resolve({ allowed: false, userConfirmed: false, decision: 'denied' });
          }, 30000);

          this.pendingConfirmations.set(confirmId, {
            resolve: (decision) => {
              clearTimeout(timer);
              this.pendingConfirmations.delete(confirmId);
              if (decision === 'allow_remember') {
                this.domainMemory.set(params.domain, 'allow');
              }
              resolve({
                allowed: decision !== 'deny',
                userConfirmed: true,
                decision: decision === 'deny' ? 'denied' as OutboundDecision : 'allowed' as OutboundDecision
              });
            },
            timer
          });

          this.confirmCallback!({
            url: params.url,
            domain: params.domain,
            category: params.category,
            dataSize: 0,
            preview: '',
            resolve: (d: 'allow' | 'deny' | 'allow_remember') => {
              const entry = this.pendingConfirmations.get(confirmId);
              if (entry) entry.resolve(d);
            }
          });
        });
      }
    }

    return { allowed: true, userConfirmed: false, decision: 'allowed' };
  }

  private inferPrivacyLevel(_category: OutboundCategory, _data?: unknown): PrivacyLevel {
    return 'private';
  }

  getAuditLogs(options?: { limit?: number; category?: OutboundCategory; decision?: OutboundDecision }): OutboundAuditLog[] {
    let logs = [...this.auditLogs].sort((a, b) => b.timestamp - a.timestamp);

    if (options?.category) logs = logs.filter(l => l.category === options.category);
    if (options?.decision) logs = logs.filter(l => l.decision === options.decision);
    if (options?.limit) logs = logs.slice(0, options.limit);

    return logs;
  }

  clearAuditLogs(): void {
    this.auditLogs = [];
    this.saveLogs();
  }

  getStats(): {
    total: number;
    byCategory: Record<OutboundCategory, number>;
    byDecision: Record<OutboundDecision, number>;
    totalBytesTransferred: number;
    uniqueDomains: Set<string>;
    lastActivity: number | null;
  } {
    const stats = {
      total: this.auditLogs.length,
      byCategory: {} as Record<OutboundCategory, number>,
      byDecision: {} as Record<OutboundDecision, number>,
      totalBytesTransferred: 0,
      uniqueDomains: new Set<string>(),
      lastActivity: null as number | null
    };
    stats.byCategory.llm_api = 0;
    stats.byCategory.webhook = 0;
    stats.byCategory.browser = 0;
    stats.byCategory.email = 0;
    stats.byCategory.custom = 0;
    stats.byCategory.unknown = 0;
    stats.byDecision.allowed = 0;
    stats.byDecision.denied = 0;
    stats.byDecision.pending_confirmation = 0;
    stats.byDecision.blocked = 0;

    for (const log of this.auditLogs) {
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      stats.byDecision[log.decision] = (stats.byDecision[log.decision] || 0) + 1;
      stats.totalBytesTransferred += log.dataSize;
      stats.uniqueDomains.add(log.domain);
      if (!stats.lastActivity || log.timestamp > stats.lastActivity) {
        stats.lastActivity = log.timestamp;
      }
    }

    return { ...stats, uniqueDomains: stats.uniqueDomains };
  }

  getPrivacyReport(): PrivacyReport {
    const s = this.getStats();
    const deniedRate = s.total > 0 ? s.byDecision.denied / s.total : 0;
    const sensitiveCount = this.auditLogs.filter(l => l.privacyLevel === 'sensitive' || l.privacyLevel === 'restricted').length;

    let score = 100;
    score -= deniedRate * 10;
    if (s.total > 50) score -= Math.max(0, (s.total - 50) * 0.1);
    score -= sensitiveCount * 2;
    score -= s.uniqueDomains.size > 5 ? (s.uniqueDomains.size - 5) * 3 : 0;
    score = Math.max(0, Math.min(100, Math.round(score)));

    let grade: PrivacyReport['grade'] = 'F';
    if (score >= 95) grade = 'A+';
    else if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 55) grade = 'C';
    else if (score >= 40) grade = 'D';

    const recommendations: string[] = [];
    if (s.byDecision.denied > 0) recommendations.push(`有 ${s.byDecision.denied} 次请求被拦截，建议检查规则配置`);
    if (s.uniqueDomains.size > 5) recommendations.push(`已连接 ${s.uniqueDomains.size} 个不同域名，建议审查出站白名单`);
    if (sensitiveCount > 0) recommendations.push(`${sensitiveCount} 次敏感数据传输，建议开启数据最小化`);
    if (this.config.mode === 'allow_all') recommendations.push('当前为「允许全部」模式，建议切换到「逐次确认」以增强安全性');
    if (recommendations.length === 0) recommendations.push('安全状态良好，继续保持');

    const storageUsage: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('codecast_cast_') || key.startsWith('cast_'))) {
        const val = localStorage.getItem(key) || '';
        storageUsage[key] = new Blob([val]).size;
      }
    }

    return {
      score,
      grade,
      totalOutboundCalls: s.total,
      allowedCalls: s.byDecision.allowed,
      deniedCalls: s.byDecision.denied + s.byDecision.blocked,
      pendingCalls: s.byDecision.pending_confirmation,
      dataTransferredBytes: s.totalBytesTransferred,
      uniqueDomains: s.uniqueDomains,
      lastOutboundAt: s.lastActivity,
      storageUsage,
      recommendations,
      generatedAt: new Date().toISOString()
    };
  }

  getMaskedPreview(data: unknown): string {
    return maskSensitiveContent(data);
  }

  addExemptDomain(domain: string): void {
    if (!this.config.exemptDomains.includes(domain)) {
      this.config.exemptDomains.push(domain);
      this.saveConfig();
    }
  }

  removeExemptDomain(domain: string): void {
    this.config.exemptDomains = this.config.exemptDomains.filter(d => d !== domain);
    this.saveConfig();
  }

  forgetDomainMemory(): void {
    this.domainMemory.clear();
  }

  exportAuditLogs(): string {
    return JSON.stringify({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      config: this.config,
      logs: this.auditLogs,
      stats: this.getStats()
    }, null, 2);
  }

  private addAuditLog(log: OutboundAuditLog): void {
    this.auditLogs.push(log);
    if (this.auditLogs.length > this.config.maxAuditLogs) {
      this.auditLogs = this.auditLogs.slice(-this.config.maxAuditLogs);
    }
    this.saveLogs();
    this.listeners.forEach(fn => { try { fn(log); } catch {} });
  }

  private saveConfig(): void {
    try {
      localStorage.setItem('codecast_cast_privacy_config', JSON.stringify(this.config));
    } catch {}
  }

  private loadConfig(): void {
    try {
      const raw = localStorage.getItem('codecast_cast_privacy_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.config = { ...DEFAULT_PRIVACY_CONFIG, ...parsed };
      }
    } catch {}
  }

  private saveLogs(): void {
    try {
      const trimmed = this.auditLogs.slice(-this.config.maxAuditLogs);
      localStorage.setItem('codecast_cast_privacy_audit', JSON.stringify(trimmed));
    } catch {}
  }

  loadLogs(): void {
    try {
      const raw = localStorage.getItem('codecast_cast_privacy_audit');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.auditLogs = parsed;
        }
      }
    } catch {}
  }
}

export const castPrivacyManager = new CastPrivacyManager();
export { CastPrivacyManager };
