interface CacheEntry<T> {
  data: T;
  expiry: number;
  lastAccess: number;
  size?: number;
}

interface CacheStats {
  memorySize: number;
  memoryItemCount: number;
  indexedDBSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
}

class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private readonly MAX_MEMORY_SIZE = 50 * 1024 * 1024;
  private readonly DEFAULT_TTL = 5 * 60 * 1000;
  private hitCount = 0;
  private missCount = 0;
  private db: IDBDatabase | null = null;
  private dbReady = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    if (typeof indexedDB === 'undefined') {
      console.warn('[Cache] IndexedDB not available, using memory-only cache');
      this.initPromise = Promise.resolve();
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('CodeCastCache', 1);

      request.onerror = () => {
        console.warn('[Cache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('expiry', 'expiry', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.dbReady = true;

        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
          this.dbReady = false;
        };

        resolve();
      };
    });

    return this.initPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    await this.initDB();

    const cached = this.memoryCache.get(key);

    if (cached && Date.now() < cached.expiry) {
      this.touchKey(key, cached);
      this.hitCount++;
      return cached.data as T;
    }

    if (cached && Date.now() >= cached.expiry) {
      this.memoryCache.delete(key);
    }

    try {
      if (this.db && this.dbReady) {
        const dbData = await this.getFromIndexedDB(key);
        if (dbData) {
          this.setMemory(key, dbData.data, dbData.expiry - Date.now());
          this.hitCount++;
          return dbData.data as T;
        }
      }
    } catch (error) {
      console.warn('[Cache] IndexedDB read failed:', error);
    }

    this.missCount++;
    return null;
  }

  async set(
    key: string,
    data: any,
    ttlMs: number = this.DEFAULT_TTL
  ): Promise<void> {
    await this.initDB();

    this.setMemory(key, data, ttlMs);

    try {
      if (this.db && this.dbReady) {
        await this.setToIndexedDB(key, data, ttlMs);
      }
    } catch (error) {
      console.warn('[Cache] IndexedDB write failed:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);

    try {
      if (this.db && this.dbReady) {
        await this.deleteFromIndexedDB(key);
      }
    } catch (error) {
      console.warn('[Cache] IndexedDB delete failed:', error);
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();

    try {
      if (this.db && this.dbReady) {
        await this.clearIndexedDB();
      }
    } catch (error) {
      console.warn('[Cache] IndexedDB clear failed:', error);
    }

    this.hitCount = 0;
    this.missCount = 0;
  }

  getStats(): CacheStats {
    const totalHits = this.hitCount + this.missCount;
    return {
      memorySize: Math.round(this.getMemorySize() / 1024 / 1024 * 100) / 100,
      memoryItemCount: this.memoryCache.size,
      indexedDBSize: 0,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: totalHits > 0 ? Math.round((this.hitCount / totalHits) * 10000) / 100 : 0
    };
  }

  async cleanup(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiry <= now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    try {
      if (this.db && this.dbReady) {
        const idbCleaned = await this.cleanupIndexedDB();
        cleaned += idbCleaned;
      }
    } catch (error) {
      console.warn('[Cache] Cleanup failed:', error);
    }

    return cleaned;
  }

  private setMemory(key: string, data: any, ttlMs: number): void {
    this.evictLRUIfNeeded();

    const size = this.estimateSize(data);

    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
      lastAccess: Date.now(),
      size
    });
  }

  private touchKey(key: string, entry: CacheEntry<any>): void {
    entry.lastAccess = Date.now();
    
    this.memoryCache.delete(key);
    this.memoryCache.set(key, entry);
  }

  private evictLRUIfNeeded(): void {
    while (this.getMemorySize() > this.MAX_MEMORY_SIZE && this.memoryCache.size > 0) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
  }

  private getMemorySize(): number {
    let size = 0;
    for (const [, value] of this.memoryCache) {
      size += value.size || 0;
    }
    return size;
  }

  private estimateSize(data: any): number {
    if (data === null || data === undefined) return 0;
    if (typeof data === 'string') return data.length * 2;
    if (typeof data === 'number') return 8;
    if (typeof data === 'boolean') return 4;
    if (typeof data === 'object') {
      return JSON.stringify(data).length * 2;
    }
    return 0;
  }

  private async getFromIndexedDB(key: string): Promise<CacheEntry<any> | null> {
    return new Promise((resolve, reject) => {
      if (!this.db || !this.dbReady) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        const result = getRequest.result;
        resolve(result && result.expiry > Date.now() ? result : null);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  private async setToIndexedDB(
    key: string,
    data: any,
    ttlMs: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db || !this.dbReady) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');

      store.put({
        key,
        data,
        expiry: Date.now() + ttlMs,
        lastAccess: Date.now()
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db || !this.dbReady) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      store.delete(key);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db || !this.dbReady) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      store.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async cleanupIndexedDB(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db || !this.dbReady) {
        resolve(0);
        return;
      }

      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('expiry');
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);

      let count = 0;
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        }
      };

      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve(count);
    });
  }
}

export const cacheManager = new CacheManager();
export default CacheManager;
