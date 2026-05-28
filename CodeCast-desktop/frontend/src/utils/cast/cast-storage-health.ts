interface StorageHealthReport {
  isHealthy: boolean;
  totalSpaceBytes: number;
  usedSpaceBytes: number;
  availableSpaceBytes: number;
  usagePercent: number;
  castKeysCount: number;
  totalKeysCount: number;
  corruptedKeys: string[];
  oversizedKeys: Array<{ key: string; sizeKB: number }>;
  warnings: string[];
  recommendations: string[];
}

interface StorageRepairResult {
  repaired: boolean;
  actionsTaken: string[];
  errors: string[];
  spaceFreedBytes: number;
}

const SIZE_WARNING_THRESHOLD_KB = 500;
const TOTAL_USAGE_WARNING_PERCENT = 80;

class CastStorageHealthChecker {
  async check(): Promise<StorageHealthReport> {
    const report: StorageHealthReport = {
      isHealthy: true,
      totalSpaceBytes: 0,
      usedSpaceBytes: 0,
      availableSpaceBytes: 0,
      usagePercent: 0,
      castKeysCount: 0,
      totalKeysCount: 0,
      corruptedKeys: [],
      oversizedKeys: [],
      warnings: [],
      recommendations: [],
    };

    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        report.totalSpaceBytes = estimate.quota || 0;
        report.usedSpaceBytes = estimate.usage || 0;
        report.availableSpaceBytes = Math.max(0, (estimate.quota || 0) - (estimate.usage || 0));
        report.usagePercent = (estimate.quota ?? 0) > 0 ? ((estimate.usage || 0) / (estimate.quota ?? 0)) * 100 : 0;
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        report.totalKeysCount++;
        let value: string | null = null;
        let size = 0;

        try {
          value = localStorage.getItem(key);
          size = value ? new Blob([value]).size : 0;
          report.usedSpaceBytes += size;

          if (key.startsWith('codecast_cast_') || key.startsWith('cast_')) {
            report.castKeysCount++;

            if (value) {
              JSON.parse(value);
            }

            const sizeKB = size / 1024;
            if (sizeKB > SIZE_WARNING_THRESHOLD_KB) {
              report.oversizedKeys.push({ key, sizeKB: Math.round(sizeKB * 10) / 10 });
            }
          }
        } catch {
          if (key.startsWith('codecast_cast_') || key.startsWith('cast_')) {
            report.corruptedKeys.push(key);
            report.isHealthy = false;
          }
        }
      }

      if (report.usagePercent > TOTAL_USAGE_WARNING_PERCENT) {
        report.warnings.push(`存储使用率已达 ${report.usagePercent.toFixed(1)}%`);
        report.recommendations.push('考虑清理旧数据或导出备份');
      }

      if (report.castKeysCount > 200) {
        report.warnings.push(`Cast 数据条目过多 (${report.castKeysCount} 个)`);
        report.recommendations.push('建议运行数据压缩或归档');
      }

      if (report.oversizedKeys.length > 0) {
        report.warnings.push(`${report.oversizedKeys.length} 个超大键值对`);
        report.recommendations.push(`最大的 ${report.oversizedKeys[0].key} 占用 ${report.oversizedKeys[0].sizeKB}KB`);
      }

      if (report.corruptedKeys.length > 0) {
        report.warnings.push(`${report.corruptedKeys.length} 个损坏的键值对`);
        report.recommendations.push('点击「修复」按钮尝试恢复');
      }

      if (report.warnings.length === 0) {
        report.recommendations.push('存储状态良好');
      }
    } catch (e: any) {
      report.warnings.push(`健康检查异常: ${e.message}`);
      report.isHealthy = false;
    }

    return report;
  }

  async repair(): Promise<StorageRepairResult> {
    const result: StorageRepairResult = {
      repaired: false,
      actionsTaken: [],
      errors: [],
      spaceFreedBytes: 0,
    };

    const health = await this.check();

    for (const key of health.corruptedKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        let parsed: unknown;
        try { parsed = JSON.parse(raw); } catch { continue; }

        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(item =>
            item !== null && item !== undefined && typeof item === 'object'
          );
          localStorage.setItem(key, JSON.stringify(cleaned));
          result.actionsTaken.push(`修复数组数据: ${key}`);
          result.repaired = true;
        } else if (typeof parsed === 'object' && parsed !== null) {
          const cleaned: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (v !== undefined) cleaned[k] = v;
          }
          localStorage.setItem(key, JSON.stringify(cleaned));
          result.actionsTaken.push(`修复对象数据: ${key}`);
          result.repaired = true;
        }
      } catch (e: any) {
        result.errors.push(`无法修复 ${key}: ${e.message}`);
      }
    }

    for (const { key, sizeKB } of health.oversizedKeys) {
      if (sizeKB > SIZE_WARNING_THRESHOLD_KB * 2) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;

          if (key.includes('log') || key.includes('history') || key.includes('audit')) {
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
              const trimmed = data.slice(0, 200);
              const beforeSize = raw.length;
              localStorage.setItem(key, JSON.stringify(trimmed));
              const afterSize = (localStorage.getItem(key) || '').length;
              result.spaceFreedBytes += Math.max(0, beforeSize - afterSize);
              result.actionsTaken.push(`裁剪日志/历史记录 ${key}: ${data.length} → ${trimmed.length}`);
              result.repaired = true;
            }
          }
        } catch (e: any) {
          result.errors.push(`无法优化 ${key}: ${e.message}`);
        }
      }
    }

    if (result.actionsTaken.length > 0) {
      result.repaired = true;
    }

    return result;
  }

  getStorageMap(): Array<{ key: string; sizeKB: number; type: 'cast' | 'other' }> {
    const map: Array<{ key: string; sizeKB: number; type: 'cast' | 'other' }> = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      const size = val ? new Blob([val]).size : 0;
      map.push({
        key,
        sizeKB: Math.round(size / 1024 * 10) / 10,
        type: (key.startsWith('codecast_cast_') || key.startsWith('cast_')) ? 'cast' : 'other',
      });
    }

    return map.sort((a, b) => b.sizeKB - a.sizeKB);
  }
}

export const castStorageHealthChecker = new CastStorageHealthChecker();
