const SCHEMA_VERSION = 2;
const SCHEMA_VERSION_KEY = 'codecast_cast_schema_version';

interface MigrationStep {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
}

const MIGRATIONS: MigrationStep[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    description: 'Add version tracking and normalize keys',
    migrate(data) {
      const normalized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (!key.startsWith('codecast_') && !key.startsWith('cast_')) continue;
        const newKey = key.replace(/^cast_/, 'codecast_cast_');
        try {
          normalized[newKey] = JSON.parse(value as string);
        } catch {
          normalized[newKey] = value;
        }
      }
      return normalized;
    },
  },
  {
    fromVersion: 1,
    toVersion: 2,
    description: 'Migrate memory items to v2 format with embeddings',
    migrate(data) {
      const memoryKey = 'codecast_cast_memories';
      if (data[memoryKey] && Array.isArray(data[memoryKey])) {
        const memories = data[memoryKey] as Array<Record<string, unknown>>;
        data[memoryKey] = memories.map(m => ({
          ...m,
          embeddings: m.embeddings || [],
          accessCount: m.accessCount || 0,
          importance: m.importance ?? 5,
          expiresAt: m.expiresAt || null,
          version: 2,
        }));
      }
      return data;
    },
  },
];

class CastDataMigrationEngine {
  private currentVersion: number = 0;
  private migrationLog: Array<{ from: number; to: number; at: number; success: boolean }> = [];

  getCurrentVersion(): number {
    if (this.currentVersion > 0) return this.currentVersion;
    try {
      const raw = localStorage.getItem(SCHEMA_VERSION_KEY);
      this.currentVersion = raw ? parseInt(raw, 10) : 0;
    } catch { this.currentVersion = 0; }
    return this.currentVersion;
  }

  getLatestVersion(): number {
    return MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1].toVersion : 0;
  }

  needsMigration(): boolean {
    return this.getCurrentVersion() < this.getLatestVersion();
  }

  getPendingMigrations(): MigrationStep[] {
    const current = this.getCurrentVersion();
    return MIGRATIONS.filter(m => m.fromVersion >= current && m.toVersion > current);
  }

  async migrate(): Promise<{ success: boolean; applied: number; errors: string[] }> {
    const current = this.getCurrentVersion();
    const pending = MIGRATIONS.filter(m => m.fromVersion >= current);
    const errors: string[] = [];
    let applied = 0;

    for (const migration of pending) {
      try {
        const snapshot = this.snapshotLocalStorage();
        const migrated = migration.migrate(snapshot);

        for (const [key, value] of Object.entries(migrated)) {
          try {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          } catch (e: any) {
            errors.push(`Write ${key}: ${e.message}`);
          }
        }

        this.currentVersion = migration.toVersion;
        localStorage.setItem(SCHEMA_VERSION_KEY, String(migration.toVersion));

        this.migrationLog.push({
          from: migration.fromVersion,
          to: migration.toVersion,
          at: Date.now(),
          success: true,
        });
        applied++;
      } catch (e: any) {
        errors.push(`${migration.description}: ${e.message}`);
        this.migrationLog.push({
          from: migration.fromVersion,
          to: migration.toVersion,
          at: Date.now(),
          success: false,
        });
      }
    }

    this.saveMigrationLog();
    return { success: errors.length === 0, applied, errors };
  }

  rollback(toVersion: number): boolean {
    if (toVersion >= this.getCurrentVersion()) return false;
    localStorage.setItem(SCHEMA_VERSION_KEY, String(toVersion));
    this.currentVersion = toVersion;
    return true;
  }

  getMigrationHistory(): ReadonlyArray<{ from: number; to: number; at: number; success: boolean }> {
    return this.migrationLog;
  }

  validateDataIntegrity(): {
    valid: boolean;
    totalKeys: number;
    corruptedKeys: string[];
    sizeBytes: number;
  } {
    let valid = true;
    let sizeBytes = 0;
    const corruptedKeys: string[] = [];
    let totalKeys = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!key.startsWith('codecast_')) continue;

      totalKeys++;
      const val = localStorage.getItem(key);
      if (val) sizeBytes += new Blob([val]).size;

      if (key.endsWith('_memories') || key.endsWith('_tasks') || key.endsWith('_logs')) {
        try {
          JSON.parse(val!);
        } catch {
          corruptedKeys.push(key);
          valid = false;
        }
      }
    }

    return { valid, totalKeys, corruptedKeys, sizeBytes };
  }

  private snapshotLocalStorage(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('codecast_')) {
        data[key] = localStorage.getItem(key)!;
      }
    }
    return data;
  }

  private saveMigrationLog(): void {
    try {
      localStorage.setItem('codecast_cast_migration_log', JSON.stringify(this.migrationLog));
    } catch {}
  }

  loadMigrationLog(): void {
    try {
      const raw = localStorage.getItem('codecast_cast_migration_log');
      if (raw) this.migrationLog = JSON.parse(raw);
    } catch {}
  }
}

export const castDataMigration = new CastDataMigrationEngine();
export { SCHEMA_VERSION, MIGRATIONS };
export type { MigrationStep };
