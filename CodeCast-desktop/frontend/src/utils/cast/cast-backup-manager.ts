function generateId(prefix: string = 'bk'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const BACKUP_META_KEY = 'codecast_cast_backup_meta';
const BACKUP_PREFIX = 'codecast_cast_backup_';
const MAX_BACKUPS = 10;

interface BackupMeta {
  id: string;
  createdAt: number;
  size: number;
  version: string;
  storeKeys: string[];
  checksum: string;
}

interface BackupData {
  meta: BackupMeta;
  stores: Record<string, unknown>;
  timestamp: number;
}

interface RestoreResult {
  success: boolean;
  backupId: string;
  restoredStores: string[];
  errors: string[];
}

async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

class CastBackupManager {
  private backupHistory: BackupMeta[] = [];

  constructor() {
    this.loadMeta();
  }

  private loadMeta(): void {
    try {
      const raw = localStorage.getItem(BACKUP_META_KEY);
      if (raw) {
        this.backupHistory = JSON.parse(raw);
      }
    } catch {
      this.backupHistory = [];
    }
  }

  private saveMeta(): void {
    try {
      localStorage.setItem(BACKUP_META_KEY, JSON.stringify(this.backupHistory.slice(0, MAX_BACKUPS)));
    } catch {}
  }

  getBackups(): BackupMeta[] {
    return [...this.backupHistory].sort((a, b) => b.createdAt - a.createdAt);
  }

  getBackup(id: string): BackupMeta | undefined {
    return this.backupHistory.find(b => b.id === id);
  }

  async createBackup(options?: { label?: string; auto?: boolean }): Promise<BackupMeta> {
    const stores: Record<string, unknown> = {};
    const storeKeys: string[] = [];
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('codecast_cast_') || key.startsWith('cast_'))) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            stores[key] = JSON.parse(value);
            storeKeys.push(key);
            totalSize += new Blob([value]).size;
          }
        } catch {
          stores[key] = localStorage.getItem(key);
          storeKeys.push(key);
        }
      }
    }

    const backupData: BackupData = {
      meta: {
        id: generateId(),
        createdAt: Date.now(),
        size: totalSize,
        version: '1.0.0',
        storeKeys,
        checksum: '',
      },
      stores,
      timestamp: Date.now(),
    };

    const serialized = JSON.stringify(backupData);
    backupData.meta.checksum = await computeChecksum(serialized);

    try {
      localStorage.setItem(`${BACKUP_PREFIX}${backupData.meta.id}`, serialized);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        this.evictOldestBackup();
        try {
          localStorage.setItem(`${BACKUP_PREFIX}${backupData.meta.id}`, serialized);
        } catch {
          throw new Error('存储空间不足，无法创建备份');
        }
      }
    }

    this.backupHistory.push(backupData.meta);
    if (this.backupHistory.length > MAX_BACKUPS) {
      const removed = this.backupHistory.splice(MAX_BACKUPS);
      for (const r of removed) {
        localStorage.removeItem(`${BACKUP_PREFIX}${r.id}`);
      }
    }
    this.saveMeta();

    console.log(`[CastBackup] Created backup ${backupData.meta.id} (${storeKeys.length} stores, ${(totalSize / 1024).toFixed(1)}KB)`);

    return backupData.meta;
  }

  async restoreBackup(backupId: string): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      backupId,
      restoredStores: [],
      errors: [],
    };

    const raw = localStorage.getItem(`${BACKUP_PREFIX}${backupId}`);
    if (!raw) {
      result.errors.push('备份数据不存在');
      return result;
    }

    let backupData: BackupData;
    try {
      backupData = JSON.parse(raw);
    } catch {
      result.errors.push('备份数据格式无效');
      return result;
    }

    const verifyChecksum = await computeChecksum(JSON.stringify({ ...backupData, meta: { ...backupData.meta, checksum: '' } }));
    if (verifyChecksum !== backupData.meta.checksum) {
      result.errors.push('备份校验失败，数据可能已损坏');
      return result;
    }

    for (const [key, value] of Object.entries(backupData.stores)) {
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, serialized);
        result.restoredStores.push(key);
      } catch (e: any) {
        result.errors.push(`恢复 ${key} 失败: ${e.message}`);
      }
    }

    result.success = result.errors.length === 0 || result.restoredStores.length > 0;
    console.log(`[CastBackup] Restored backup ${backupId}: ${result.restoredStores.length} stores restored`);

    return result;
  }

  deleteBackup(backupId: string): boolean {
    const index = this.backupHistory.findIndex(b => b.id === backupId);
    if (index === -1) return false;

    this.backupHistory.splice(index, 1);
    localStorage.removeItem(`${BACKUP_PREFIX}${backupId}`);
    this.saveMeta();
    return true;
  }

  exportBackup(backupId: string): string | null {
    const raw = localStorage.getItem(`${BACKUP_PREFIX}${backupId}`);
    if (!raw) return null;
    return raw;
  }

  importBackup(json: string): { success: boolean; backupId?: string; error?: string } {
    try {
      const data = JSON.parse(json);

      if (!data.meta || !data.meta.id || !data.stores) {
        return { success: false, error: '无效的备份格式' };
      }

      const serialized = JSON.stringify(data);
      localStorage.setItem(`${BACKUP_PREFIX}${data.meta.id}`, serialized);

      this.backupHistory.push(data.meta);
      if (this.backupHistory.length > MAX_BACKUPS) {
        this.backupHistory.splice(MAX_BACKUPS);
      }
      this.saveMeta();

      return { success: true, backupId: data.meta.id };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  getStorageStats(): { totalKeys: number; castKeys: number; totalSizeKB: number; lastBackup: BackupMeta | null } {
    let totalKeys = 0;
    let castKeys = 0;
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalKeys++;
        if (key.startsWith('codecast_cast_') || key.startsWith('cast_')) {
          castKeys++;
          const val = localStorage.getItem(key);
          if (val) totalSize += new Blob([val]).size;
        }
      }
    }

    return {
      totalKeys,
      castKeys,
      totalSizeKB: Math.round(totalSize / 1024),
      lastBackup: this.backupHistory[this.backupHistory.length - 1] || null,
    };
  }

  clearAllBackups(): void {
    for (const backup of this.backupHistory) {
      localStorage.removeItem(`${BACKUP_PREFIX}${backup.id}`);
    }
    this.backupHistory = [];
    this.saveMeta();
  }

  private evictOldestBackup(): void {
    if (this.backupHistory.length === 0) return;
    const oldest = this.backupHistory.shift();
    if (oldest) {
      localStorage.removeItem(`${BACKUP_PREFIX}${oldest.id}`);
    }
  }

  scheduleAutoBackup(intervalMs: number = 3600000): () => void {
    const timer = setInterval(async () => {
      try {
        await this.createBackup({ auto: true });
      } catch (e) {
        console.warn('[CastBackup] Auto-backup failed:', e);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }
}

export const castBackupManager = new CastBackupManager();
export { CastBackupManager };
