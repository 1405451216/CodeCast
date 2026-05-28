export type PrivacyLevel = 'public' | 'private' | 'sensitive' | 'restricted';

export type OutboundCategory = 'llm_api' | 'webhook' | 'browser' | 'email' | 'custom' | 'unknown';

export type OutboundDecision = 'allowed' | 'denied' | 'pending_confirmation' | 'blocked';

export type PrivacyPolicyMode = 'allow_all' | 'prompt_all' | 'deny_all' | 'custom';

export interface OutboundAuditLog {
  id: string;
  url: string;
  method: string;
  dataSize: number;
  timestamp: number;
  category: OutboundCategory;
  reason: string;
  privacyLevel: PrivacyLevel;
  decision: OutboundDecision;
  userConfirmed: boolean;
  domain: string;
  duration?: number;
  statusCode?: number;
}

export interface PrivacyRule {
  id: string;
  pattern: string;
  category: OutboundCategory;
  action: 'allow' | 'deny' | 'prompt';
  enabled: boolean;
  description: string;
  createdAt: number;
}

export interface PrivacyPolicyConfig {
  mode: PrivacyPolicyMode;
  rules: PrivacyRule[];
  exemptDomains: string[];
  auditLogRetentionDays: number;
  autoMaskSensitiveData: boolean;
  llmDataMinimization: boolean;
  showOutboundConfirmation: boolean;
  maxAuditLogs: number;
}

export interface SecurityManifest {
  readonly version: string;
  readonly principle: string;
  readonly dataResidence: string;
  readonly cloudSync: boolean;
  readonly telemetry: boolean;
  readonly thirdPartyAnalytics: boolean;
  readonly outboundPoints: ReadonlyArray<string>;
  readonly encryption: string;
  readonly storage: string;
  readonly lastAudited: string;
  readonly guarantees: ReadonlyArray<string>;
}

export interface PrivacyReport {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  totalOutboundCalls: number;
  allowedCalls: number;
  deniedCalls: number;
  pendingCalls: number;
  dataTransferredBytes: number;
  uniqueDomains: Set<string>;
  lastOutboundAt: number | null;
  storageUsage: Record<string, number>;
  recommendations: string[];
  generatedAt: string;
}

export interface OutboundConfirmPayload {
  url: string;
  method: string;
  category: OutboundCategory;
  dataSize: number;
  preview: string;
  domain: string;
  resolve: (decision: 'allow' | 'deny' | 'allow_remember') => void;
}

export const DEFAULT_PRIVACY_CONFIG: PrivacyPolicyConfig = {
  mode: 'prompt_all',
  rules: [],
  exemptDomains: ['localhost', '127.0.0.1', '::1'],
  auditLogRetentionDays: 30,
  autoMaskSensitiveData: true,
  llmDataMinimization: false,
  showOutboundConfirmation: true,
  maxAuditLogs: 1000
};

export const PRIVACY_LEVEL_LABELS: Record<PrivacyLevel, { label: string; color: string; icon: string }> = {
  public: { label: '公开', color: '#22c55e', icon: '🌐' },
  private: { label: '私有', color: '#3b82f6', icon: '🔒' },
  sensitive: { label: '敏感', color: '#f59e0b', icon: '⚠️' },
  restricted: { label: '受限', color: '#ef4444', icon: '🚫' }
};

export const OUTBOUND_CATEGORY_LABELS: Record<OutboundCategory, { label: string; icon: string; description: string }> = {
  llm_api: { label: 'LLM API', icon: '🤖', description: '大语言模型API调用' },
  webhook: { label: 'Webhook', icon: '🔗', description: '外部Webhook推送' },
  browser: { label: '浏览器', icon: '🌍', description: '浏览器自动化导航' },
  email: { label: '邮件', icon: '📧', description: '邮件发送服务' },
  custom: { label: '自定义', icon: '⚙️', description: '自定义网络请求' },
  unknown: { label: '未知', icon: '❓', description: '未分类请求' }
};
