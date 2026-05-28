import type { SecurityManifest } from '../../types/cast-privacy';

export const CAST_SECURITY_MANIFEST: SecurityManifest = {
  version: '1.0.0',
  principle: 'LOCAL_FIRST',
  dataResidence: 'DEVICE_ONLY',
  cloudSync: false,
  telemetry: false,
  thirdPartyAnalytics: false,
  outboundPoints: ['llm_api', 'webhook', 'browser'],
  encryption: 'AES_256_GCM',
  storage: 'LOCAL_STORAGE',
  lastAudited: '2026-05-27',
  guarantees: [
    '所有用户数据存储在用户本地设备',
    '不向任何云服务器同步用户数据',
    '不内置遥测或分析SDK',
    'LLM调用仅限用户自配的API Key',
    '插件市场完全离线运行',
    'API Key使用AES-256-GCM加密存储'
  ]
} as const;

export function getSecuritySummary(): string {
  return `CodeCast v${CAST_SECURITY_MANIFEST.version} 安全声明\n` +
    `原则: ${CAST_SECURITY_MANIFEST.principle}\n` +
    `数据驻留: ${CAST_SECURITY_MANIFEST.dataResidence}\n` +
    `云同步: ${CAST_SECURITY_MANIFEST.cloudSync ? '是' : '否（已禁用）'}\n` +
    `遥测: ${CAST_SECURITY_MANIFEST.telemetry ? '是' : '否（已禁用）'}\n` +
    `第三方分析: ${CAST_SECURITY_MANIFEST.thirdPartyAnalytics ? '是' : '否（已禁用）'}\n` +
    `加密方式: ${CAST_SECURITY_MANIFEST.encryption}\n` +
    `存储方式: ${CAST_SECURITY_MANIFEST.storage}\n` +
    `最后审计: ${CAST_SECURITY_MANIFEST.lastAudited}\n\n` +
    `安全承诺:\n${CAST_SECURITY_MANIFEST.guarantees.map((g, i) => `  ${i + 1}. ${g}`).join('\n')}`;
}
