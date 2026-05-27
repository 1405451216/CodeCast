import { logger } from '../logger';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    language: string;
    chunkIndex: number;
    startLine: number;
    endLine: number;
    type: 'code' | 'comment' | 'documentation' | 'import' | 'export';
    symbols: string[];
    lastUpdated: string;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: VectorDocument['metadata'];
}

export interface VectorStoreStats {
  totalDocuments: number;
  storageSize: number;
  lastIndexedAt: string | null;
  sources: string[];
  languages: Record<string, number>;
}

export interface SearchOptions {
  k?: number;
  minSimilarity?: number;
  filterBySource?: string;
  filterByLanguage?: string;
  filterByType?: VectorDocument['metadata']['type'];
}

interface CacheEntry {
  document: VectorDocument;
  lastAccessed: number;
}

const DEFAULT_CACHE_SIZE = 100;

export class FileSystemVectorStore {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private cacheSize: number;
  private isInitialized = false;
  private useIndexedDBFallback = false;
  private indexedDBName = 'CodeCast-RAG-Vectors';
  private indexedDBVersion = 1;

  constructor(cacheSize: number = DEFAULT_CACHE_SIZE) {
    this.cacheSize = cacheSize;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    const hasFileSystemAccess = 'showDirectoryPicker' in window;

    if (hasFileSystemAccess) {
      try {
        this.directoryHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents'
        });

        await this.ensureDirectoryStructure();

        this.isInitialized = true;
        logger.info('FileSystemVectorStore', '✅ Initialized with File System Access API');
        return true;
      } catch (error) {
        logger.warn('FileSystemVectorStore', '⚠️  File System Access not available, falling back to IndexedDB', error);
      }
    }

    return await this.initializeIndexedDBFallback();
  }

  async initializeWithHandle(handle: FileSystemDirectoryHandle): Promise<boolean> {
    this.directoryHandle = handle;
    await this.ensureDirectoryStructure();
    this.isInitialized = true;
    return true;
  }

  async addDocument(doc: VectorDocument): Promise<void> {
    this.ensureInitialized();

    this.updateCache(doc);

    if (this.useIndexedDBFallback || !this.directoryHandle) {
      await this.addToIndexedDB(doc);
    } else {
      await this.addToFileSystem(doc);
    }
  }

  async addDocuments(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      await this.addDocument(doc);
    }
  }

  async getDocument(id: string): Promise<VectorDocument | null> {
    const cached = this.getFromCache(id);
    if (cached) return cached;

    if (this.useIndexedDBFallback || !this.directoryHandle) {
      return await this.getFromIndexedDB(id);
    }

    return await this.getFromFileSystem(id);
  }

  async deleteDocument(id: string): Promise<boolean> {
    this.removeFromCache(id);

    if (this.useIndexedDBFallback || !this.directoryHandle) {
      return await this.deleteFromIndexedDB(id);
    }

    return await this.deleteFromFileSystem(id);
  }

  async search(
    queryEmbedding: number[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    this.ensureInitialized();

    const startTime = performance.now();
    
    const allDocs = await this.getAllDocuments();
    
    let results = allDocs
      .map(doc => ({
        id: doc.id,
        content: doc.content,
        similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
        metadata: doc.metadata
      }))
      .filter(result => result.similarity >= (options?.minSimilarity ?? 0.3));

    if (options?.filterBySource) {
      results = results.filter(r => r.metadata.source === options.filterBySource);
    }

    if (options?.filterByLanguage) {
      results = results.filter(r => r.metadata.language === options.filterByLanguage);
    }

    if (options?.filterByType) {
      results = results.filter(r => r.metadata.type === options.filterByType);
    }

    results.sort((a, b) => b.similarity - a.similarity);

    const topK = options?.k ?? 5;
    const finalResults = results.slice(0, topK);

    logger.debug('FileSystemVectorStore', `🔍 Search completed in ${(performance.now() - startTime).toFixed(1)}ms`, {
      totalDocs: allDocs.length,
      filteredCount: results.length,
      returnedCount: finalResults.length,
      topScore: finalResults[0]?.similarity ?? 0
    });

    return finalResults;
  }

  async getStats(): Promise<VectorStoreStats> {
    const allDocs = await this.getAllDocuments();
    const sources = new Set<string>();
    const languages: Record<string, number> = {};

    let totalSize = 0;

    for (const doc of allDocs) {
      sources.add(doc.metadata.source);
      languages[doc.metadata.language] = (languages[doc.metadata.language] || 0) + 1;
      totalSize += JSON.stringify(doc).length;
    }

    let lastIndexedAt: string | null = null;
    if (allDocs.length > 0) {
      lastIndexedAt = allDocs
        .map(d => d.metadata.lastUpdated)
        .sort()
        .pop() || null;
    }

    return {
      totalDocuments: allDocs.length,
      storageSize: totalSize,
      lastIndexedAt,
      sources: Array.from(sources),
      languages
    };
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.useIndexedDBFallback || !this.directoryHandle) {
      await this.clearIndexedDB();
    } else {
      await this.clearFileSystem();
    }

    logger.info('FileSystemVectorStore', '🗑️  Store cleared');
  }

  async exportData(): Promise<string> {
    const allDocs = await this.getAllDocuments();
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      documents: allDocs,
      stats: await this.getStats()
    }, null, 2);
  }

  async importData(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);

    if (!data.documents || !Array.isArray(data.documents)) {
      throw new Error('Invalid import data format');
    }

    await this.clear();

    for (const doc of data.documents) {
      await this.addDocument(doc);
    }

    logger.info('FileSystemVectorStore', `📥 Imported ${data.documents.length} documents`);
  }

  isUsingFileSystemAPI(): boolean {
    return !this.useIndexedDBFallback && this.directoryHandle !== null;
  }

  getStorageType(): string {
    if (this.directoryHandle && !this.useIndexedDBFallback) {
      return 'file-system';
    }
    return 'indexeddb';
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Vector store not initialized. Call initialize() first.');
    }
  }

  private updateCache(doc: VectorDocument): void {
    if (this.memoryCache.size >= this.cacheSize) {
      this.evictLRU();
    }

    this.memoryCache.set(doc.id, {
      document: doc,
      lastAccessed: Date.now()
    });
  }

  private getFromCache(id: string): VectorDocument | null {
    const entry = this.memoryCache.get(id);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.document;
    }
    return null;
  }

  private removeFromCache(id: string): void {
    this.memoryCache.delete(id);
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  private async ensureDirectoryStructure(): Promise<void> {
    if (!this.directoryHandle) return;

    try {
      await this.directoryHandle.getDirectoryHandle('vectors', { create: true });
      await this.directoryHandle.getDirectoryHandle('meta', { create: true });
      
      logger.debug('FileSystemVectorStore', '📁 Directory structure ensured');
    } catch (error) {
      logger.error('FileSystemVectorStore', '❌ Failed to create directory structure', error);
      throw error;
    }
  }

  private async addToFileSystem(doc: VectorDocument): Promise<void> {
    if (!this.directoryHandle) return;

    try {
      const vectorsDir = await this.directoryHandle.getDirectoryHandle('vectors');
      const file = await vectorsDir.getFileHandle(`${doc.id}.json`, { create: true });
      const writable = await file.createWritable();
      await writable.write(JSON.stringify(doc));
      await writable.close();
    } catch (error) {
      logger.error('FileSystemVectorStore', '❌ Failed to write to filesystem', error);
      throw error;
    }
  }

  private async getFromFileSystem(id: string): Promise<VectorDocument | null> {
    if (!this.directoryHandle) return null;

    try {
      const vectorsDir = await this.directoryHandle.getDirectoryHandle('vectors');
      const file = await vectorsDir.getFileHandle(`${id}.json`);
      const blob = await file.getFile();
      const text = await blob.text();
      const doc = JSON.parse(text);
      this.updateCache(doc);
      return doc;
    } catch (error) {
      return null;
    }
  }

  private async deleteFromFileSystem(id: string): Promise<boolean> {
    if (!this.directoryHandle) return false;

    try {
      const vectorsDir = await this.directoryHandle.getDirectoryHandle('vectors');
      await vectorsDir.removeEntry(`${id}.json`);
      return true;
    } catch (error) {
      logger.warn('FileSystemVectorStore', '⚠️  Failed to delete from filesystem', error);
      return false;
    }
  }

  private async getAllFromFileSystem(): Promise<VectorDocument[]> {
    if (!this.directoryHandle) return [];

    const docs: VectorDocument[] = [];

    try {
      const vectorsDir = await this.directoryHandle.getDirectoryHandle('vectors');
      
      for await (const entry of (vectorsDir as any).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.json')) {
          try {
            const file = await vectorsDir.getFileHandle(entry.name);
            const blob = await file.getFile();
            const text = await blob.text();
            const doc = JSON.parse(text);
            docs.push(doc);
          } catch (error) {
            logger.warn('FileSystemVectorStore', `⚠️  Failed to read ${entry.name}`, error);
          }
        }
      }
    } catch (error) {
      logger.error('FileSystemVectorStore', '❌ Failed to list files', error);
    }

    return docs;
  }

  private async clearFileSystem(): Promise<void> {
    if (!this.directoryHandle) return;

    try {
      const vectorsDir = await this.directoryHandle.getDirectoryHandle('vectors');
      
      const entries: string[] = [];
      for await (const entry of (vectorsDir as any).values()) {
        entries.push(entry.name);
      }

      for (const name of entries) {
        await vectorsDir.removeEntry(name);
      }
    } catch (error) {
      logger.error('FileSystemVectorStore', '❌ Failed to clear filesystem', error);
    }
  }

  private async initializeIndexedDBFallback(): Promise<boolean> {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.indexedDBName, this.indexedDBVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('vectors')) {
          const store = db.createObjectStore('vectors', { keyPath: 'id' });
          store.createIndex('by-source', 'metadata.source');
          store.createIndex('by-language', 'metadata.language');
        }

        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.useIndexedDBFallback = true;
        this.isInitialized = true;
        logger.info('FileSystemVectorStore', '✅ Initialized with IndexedDB fallback');
        resolve(true);
      };

      request.onerror = (event) => {
        logger.error('FileSystemVectorStore', '❌ Failed to initialize IndexedDB', event);
        resolve(false);
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.indexedDBName, this.indexedDBVersion);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async addToIndexedDB(doc: VectorDocument): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['vectors'], 'readwrite');
      const store = transaction.objectStore('vectors');
      const request = store.put(doc);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getFromIndexedDB(id: string): Promise<VectorDocument | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['vectors'], 'readonly');
      const store = transaction.objectStore('vectors');
      const request = store.get(id);

      request.onsuccess = () => {
        const doc = request.result;
        if (doc) {
          this.updateCache(doc);
        }
        resolve(doc || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromIndexedDB(id: string): Promise<boolean> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['vectors'], 'readwrite');
      const store = transaction.objectStore('vectors');
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromIndexedDB(): Promise<VectorDocument[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['vectors'], 'readonly');
      const store = transaction.objectStore('vectors');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearIndexedDB(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['vectors'], 'readwrite');
      const store = transaction.objectStore('vectors');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getAllDocuments(): Promise<VectorDocument[]> {
    const cachedIds = new Set(this.memoryCache.keys());
    const cachedDocs = Array.from(this.memoryCache.values()).map(e => e.document);

    let storedDocs: VectorDocument[];

    if (this.useIndexedDBFallback || !this.directoryHandle) {
      storedDocs = await this.getAllFromIndexedDB();
    } else {
      storedDocs = await this.getAllFromFileSystem();
    }

    const uncachedDocs = storedDocs.filter(doc => !cachedIds.has(doc.id));

    for (const doc of uncachedDocs) {
      this.updateCache(doc);
    }

    const mergedMap = new Map<string, VectorDocument>();

    for (const doc of [...cachedDocs, ...uncachedDocs]) {
      mergedMap.set(doc.id, doc);
    }

    return Array.from(mergedMap.values());
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;

    return dotProduct / (magA * magB);
  }
}
