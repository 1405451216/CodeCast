interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 1000, ttl = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    entry.accessCount++;
    entry.timestamp = now;

    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      existing.value = value;
      existing.timestamp = Date.now();
      existing.accessCount++;
      this.cache.delete(key);
      this.cache.set(key, existing);
      return;
    }

    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  forEach(callback: (value: V, key: K) => void): void {
    this.cache.forEach((entry, key) => {
      callback(entry.value, key);
    });
  }

  get stats() {
    let totalAccess = 0;
    this.cache.forEach(entry => { totalAccess += entry.accessCount; });
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalAccess,
      hitRate: totalAccess / Math.max(this.cache.size, 1)
    };
  }

  private evictLRU(): void {
    let lruKey: K | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        lruKey = key;
      }
    }

    if (lruKey !== null) {
      this.cache.delete(lruKey);
    }
  }
}