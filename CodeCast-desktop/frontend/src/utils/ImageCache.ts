interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;

  constructor(maxSize: number = 20) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.accessCount++;
      entry.timestamp = Date.now();
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.value;
    }
    return undefined;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        if (typeof window !== 'undefined' && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          try {
            const oldValue = this.cache.get(oldestKey);
            if (oldValue && typeof oldValue.value === 'string' && oldValue.value.startsWith('blob:')) {
              URL.revokeObjectURL(oldValue.value);
            }
          } catch (e) {}
        }
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    if (typeof window !== 'undefined' && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      for (const [, entry] of this.cache) {
        if (typeof entry.value === 'string' && entry.value.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(entry.value);
          } catch (e) {}
        }
      }
    }
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getStats(): { size: number; maxSize: number; entries: Array<{ key: string; accessCount: number; age: number }> } {
    const now = Date.now();
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        age: now - entry.timestamp
      }))
    };
  }
}

export const imageCache = new LRUCache<string>(20);

export const generateImageKey = (src: string, width?: number, quality?: string): string => {
  return `${src}-${width || 'auto'}-${quality || 'auto'}`;
};

export const preloadImage = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const cached = imageCache.get(generateImageKey(src));
    if (cached) {
      resolve(cached);
      return;
    }

    const img = new Image();
    img.onload = () => {
      imageCache.set(generateImageKey(src), src);
      resolve(src);
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
};

export default LRUCache;