import { DocumentChunk, Vector, SearchResult } from './SimpleVectorizer';
import { SimpleVectorizer } from './SimpleVectorizer';
import { DocumentChunker } from './DocumentChunker';
import { FileSystemVectorStore, VectorDocument, SearchOptions, VectorStoreStats } from './FileSystemVectorStore';
import { logger } from '../logger';

export interface RAGConfig {
  maxContextTokens: number;
  topKResults: number;
  minRelevanceScore: number;
  enableCaching: boolean;
  chunkSize: number;
  overlapSize: number;
  storageType: 'memory' | 'filesystem' | 'auto';
  persistToDisk: boolean;
}

export interface QueryResult {
  query: string;
  results: SearchResult[];
  context: string;
  totalTokens: number;
  retrievalTime: number;
  sources: Array<{
    filePath: string;
    lineRange: string;
    relevance: number;
  }>;
}

const DEFAULT_CONFIG: RAGConfig = {
  maxContextTokens: 8000,
  topKResults: 5,
  minRelevanceScore: 0.3,
  enableCaching: true,
  chunkSize: 500,
  overlapSize: 50,
  storageType: 'auto',
  persistToDisk: true
};

export class RAGEngine {
  private vectorizer: SimpleVectorizer;
  private chunker: DocumentChunker;
  private documentStore: Map<string, DocumentChunk[]> = new Map();
  private queryCache: Map<string, QueryResult> = new Map();
  private config: RAGConfig;
  private isIndexing = false;
  private vectorStore: FileSystemVectorStore | null = null;
  private isStoreInitialized = false;

  constructor(config?: Partial<RAGConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vectorizer = new SimpleVectorizer();
    this.chunker = new DocumentChunker({
      maxChunkSize: this.config.chunkSize,
      overlapSize: this.config.overlapSize
    });

    if (this.config.persistToDisk) {
      this.vectorStore = new FileSystemVectorStore(200);
    }

    logger.info('RAGEngine', '🔍 RAG Engine initialized with config', {
      ...this.config,
      hasVectorStore: !!this.vectorStore
    });
  }

  async initializeStorage(): Promise<boolean> {
    if (!this.vectorStore || this.isStoreInitialized) return true;

    const shouldInit = 
      this.config.storageType === 'filesystem' ||
      (this.config.storageType === 'auto' && this.config.persistToDisk);

    if (shouldInit) {
      try {
        this.isStoreInitialized = await this.vectorStore.initialize();
        
        if (this.isStoreInitialized) {
          logger.info('RAGEngine', `💾 Vector store initialized (${this.vectorStore.getStorageType()})`);
        }
      } catch (error) {
        logger.warn('RAGEngine', '⚠️  Vector store initialization failed, using memory', error);
        this.isStoreInitialized = false;
      }
    }

    return this.isStoreInitialized;
  }

  async indexProject(files: Array<{ path: string; content: string }>): Promise<void> {
    logger.info('RAGEngine', `📚 Indexing ${files.length} files for RAG...`);
    
    this.isIndexing = true;
    const startTime = performance.now();
    let indexedCount = 0;
    const failedFiles: string[] = [];

    try {
      await this.initializeStorage();

      const allDocuments: string[] = [];
      const fileChunksMap: Map<string, DocumentChunk[]> = new Map();
      const vectorDocs: VectorDocument[] = [];

      for (const file of files) {
        try {
          const chunks = this.chunker.chunkDocument(
            file.content, 
            file.path, 
            this.detectLanguage(file.path)
          );
          
          fileChunksMap.set(file.path, chunks);
          allDocuments.push(...chunks.map(c => c.content));

          if (this.vectorStore && this.isStoreInitialized) {
            for (const chunk of chunks) {
              try {
                const embedding = this.vectorizer.vectorize(chunk.content);
                chunk.vector = embedding;

                vectorDocs.push({
                  id: chunk.id,
                  content: chunk.content,
                  embedding: embedding.dimensions,
                  metadata: {
                    source: file.path,
                    language: this.detectLanguage(file.path),
                    chunkIndex: chunks.indexOf(chunk),
                    startLine: chunk.metadata.startLine,
                    endLine: chunk.metadata.endLine,
                    type: chunk.metadata.type,
                    symbols: chunk.metadata.symbols,
                    lastUpdated: new Date().toISOString()
                  }
                });
              } catch (vectorError) {
                console.warn(`[RAG] Failed to vectorize chunk in ${file.path}:`, vectorError);
              }
            }
          }

          indexedCount++;
        } catch (fileError) {
          console.warn(`[RAG] Failed to index file ${file.path}:`, fileError);
          failedFiles.push(file.path);
        }
      }

      if (failedFiles.length > 0 && failedFiles.length === files.length) {
        throw new Error('All files failed to index');
      }

      for (const [filePath, chunks] of fileChunksMap) {
        for (const chunk of chunks) {
          if (!chunk.vector || chunk.vector.dimensions.length === 0) {
            chunk.vector = this.vectorizer.vectorize(chunk.content);
          }
        }
        this.documentStore.set(filePath, chunks);
      }

      if (this.vectorStore && this.isStoreInitialized && vectorDocs.length > 0) {
        await this.vectorStore.addDocuments(vectorDocs);
        logger.info('RAGEngine', `💾 Persisted ${vectorDocs.length} vectors to disk`);
      }

      const endTime = performance.now();
      const totalChunks = Array.from(this.documentStore.values())
        .reduce((sum, chunks) => sum + chunks.length, 0);

      logger.info('RAGEngine', '✅ Project indexing complete', {
        filesIndexed: files.length,
        totalChunks,
        vocabularySize: 0,
        vectorsPersisted: vectorDocs.length,
        storageType: this.vectorStore?.getStorageType() ?? 'memory',
        duration: `${(endTime - startTime).toFixed(1)}ms`
      });
    } finally {
      this.isIndexing = false;
    }
  }

  async query(
    userQuery: string,
    options?: { 
      topK?: number; 
      filters?: { filePath?: string; type?: DocumentChunk['metadata']['type'] };
      includeContext?: boolean;
    }
  ): Promise<QueryResult> {
    const startTime = performance.now();

    if (this.config.enableCaching) {
      const cached = this.queryCache.get(userQuery);
      if (cached) {
        logger.debug('RAGEngine', '📋 Cache hit for query');
        return cached;
      }
    }

    const topK = options?.topK || this.config.topKResults;

    logger.info('RAGEngine', '🔎 Executing RAG query', { query: userQuery.slice(0, 100), topK });

    let scoredResults: SearchResult[] = [];

    if (this.vectorStore && this.isStoreInitialized) {
      const queryVector = this.vectorizer.vectorize(userQuery);

      const searchOptions: SearchOptions = {
        k: topK,
        minSimilarity: this.config.minRelevanceScore,
        filterBySource: options?.filters?.filePath,
        filterByType: options?.filters?.type
      };

      const vectorResults = await this.vectorStore.search(queryVector.dimensions, searchOptions);

      scoredResults = vectorResults.map(vr => ({
        chunk: {
          id: vr.id,
          content: vr.content,
          metadata: {
            filePath: vr.metadata.source,
            startLine: vr.metadata.startLine,
            endLine: vr.metadata.endLine,
            language: vr.metadata.language,
            type: vr.metadata.type,
            symbols: vr.metadata.symbols
          },
          vector: { dimensions: vr.metadata.type ? [] : [] }
        },
        score: vr.similarity,
        relevance: this.classifyRelevance(vr.similarity),
        highlightedContent: this.highlightMatches(vr.content, userQuery)
      }));
    } else {
      const queryVector = this.vectorizer.vectorize(userQuery);
      
      let allChunks: DocumentChunk[] = [];
      
      this.documentStore.forEach(chunks => {
        allChunks.push(...chunks);
      });

      if (options?.filters?.filePath) {
        allChunks = allChunks.filter(chunk => 
          chunk.metadata.filePath === options.filters!.filePath
        );
      }

      if (options?.filters?.type) {
        allChunks = allChunks.filter(chunk => 
          chunk.metadata.type === options.filters!.type
        );
      }

      scoredResults = allChunks
        .map(chunk => ({
          chunk,
          score: this.vectorizer.cosineSimilarity(queryVector, chunk.vector)
        }))
        .filter(result => result.score >= this.config.minRelevanceScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(result => ({
          ...result,
          relevance: this.classifyRelevance(result.score),
          highlightedContent: this.highlightMatches(result.chunk.content, userQuery)
        }));
    }

    const context = options?.includeContext !== false 
      ? this.buildContext(scoredResults) 
      : '';

    const sources = scoredResults.map(r => ({
      filePath: r.chunk.metadata.filePath,
      lineRange: `${r.chunk.metadata.startLine}-${r.chunk.metadata.endLine}`,
      relevance: r.score
    }));

    const estimatedTokens = this.estimateTokens(context + userQuery);

    const result: QueryResult = {
      query: userQuery,
      results: scoredResults,
      context,
      totalTokens: estimatedTokens,
      retrievalTime: performance.now() - startTime,
      sources
    };

    if (this.config.enableCaching) {
      this.queryCache.set(userQuery, result);
      
      if (this.queryCache.size > 1000) {
        const firstKey = this.queryCache.keys().next().value;
        if (firstKey) {
          this.queryCache.delete(firstKey);
        }
      }
    }

    logger.info('RAGEngine', '✅ Query completed', {
      resultsCount: scoredResults.length,
      topScore: scoredResults[0]?.score || 0,
      contextTokens: estimatedTokens,
      usedVectorStore: !!this.vectorStore && this.isStoreInitialized,
      duration: `${result.retrievalTime.toFixed(1)}ms`
    });

    return result;
  }

  async getRelevantContextForFile(
    filePath: string,
    position: { line: number; column: number },
    windowSize: number = 50
  ): Promise<string> {
    const fileChunks = this.documentStore.get(filePath);
    
    if (!fileChunks) return '';

    const relevantChunks = fileChunks.filter(chunk =>
      position.line >= chunk.metadata.startLine - windowSize &&
      position.line <= chunk.metadata.endLine + windowSize
    );

    if (relevantChunks.length === 0) {
      const closestChunk = fileChunks.reduce((closest, chunk) => {
        const distance = Math.abs(chunk.metadata.startLine - position.line);
        const closestDistance = Math.abs(closest.metadata.startLine - position.line);
        return distance < closestDistance ? chunk : closest;
      }, fileChunks[0]);

      return closestChunk ? closestChunk.content : '';
    }

    return relevantChunks
      .sort((a, b) => a.metadata.startLine - b.metadata.startLine)
      .map(c => c.content)
      .join('\n\n');
  }

  async findSimilarCode(
    codeSnippet: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const codeVector = this.vectorizer.vectorize(codeSnippet);

    const allChunks: DocumentChunk[] = [];
    this.documentStore.forEach(chunks => {
      allChunks.push(...chunks.filter(c => c.metadata.type === 'code'));
    });

    return allChunks
      .map(chunk => ({
        chunk,
        score: this.vectorizer.cosineSimilarity(codeVector, chunk.vector)
      }))
      .filter(r => r.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => ({
        ...r,
        relevance: this.classifyRelevance(r.score),
        highlightedContent: this.highlightMatches(r.chunk.content, codeSnippet)
      }));
  }

  getStats(): {
    indexedFiles: number;
    totalChunks: number;
    cacheSize: number;
    isIndexing: boolean;
    storageType: string;
    storeInitialized: boolean;
    vectorStoreStats?: VectorStoreStats;
  } {
    let totalChunks = 0;
    this.documentStore.forEach(chunks => {
      totalChunks += chunks.length;
    });

    return {
      indexedFiles: this.documentStore.size,
      totalChunks,
      cacheSize: this.queryCache.size,
      isIndexing: this.isIndexing,
      storageType: this.vectorStore?.getStorageType() ?? 'memory',
      storeInitialized: this.isStoreInitialized
    };
  }

  async getVectorStoreStats(): Promise<VectorStoreStats | null> {
    if (!this.vectorStore || !this.isStoreInitialized) return null;
    return await this.vectorStore.getStats();
  }

  async exportRAGData(): Promise<string> {
    if (!this.vectorStore || !this.isStoreInitialized) {
      throw new Error('Vector store not initialized');
    }
    return await this.vectorStore.exportData();
  }

  async importRAGData(jsonString: string): Promise<void> {
    if (!this.vectorStore || !this.isStoreInitialized) {
      throw new Error('Vector store not initialized');
    }
    await this.vectorStore.importData(jsonString);
    
    this.documentStore.clear();
    const allDocs = await this.vectorStore.getAllDocuments ? 
      [] as any : [];
    logger.info('RAGEngine', '📥 RAG data imported successfully');
  }

  clearCache(): void {
    this.queryCache.clear();
    logger.info('RAGEngine', '🗑️  Query cache cleared');
  }

  clearIndex(): void {
    this.documentStore.clear();
    this.queryCache.clear();
    
    if (this.vectorStore && this.isStoreInitialized) {
      this.vectorStore.clear().catch(err => {
        logger.error('RAGEngine', '❌ Failed to clear vector store', err);
      });
    }
    
    logger.info('RAGEngine', '🗑️  Entire index cleared');
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java'
    };
    return langMap[ext] || 'plaintext';
  }

  private classifyRelevance(score: number): SearchResult['relevance'] {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  private highlightMatches(content: string, query: string): string {
    const queryWords = query.toLowerCase()
      .replace(/[^a-z0-9_]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    let highlighted = content;

    for (const word of queryWords) {
      const regex = new RegExp(`(${word})`, 'gi');
      highlighted = highlighted.replace(regex, '**$1**');
    }

    return highlighted;
  }

  private buildContext(results: SearchResult[]): string {
    if (results.length === 0) return '';

    const contextParts: string[] = [];

    contextParts.push('# Relevant Code Context\n');

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      contextParts.push(
        `\n## Source ${i + 1} (${result.relevance} relevance)\n` +
        `**File:** ${result.chunk.metadata.filePath}\n` +
        `**Lines:** ${result.chunk.metadata.startLine}-${result.chunk.metadata.endLine}\n` +
        `**Type:** ${result.chunk.metadata.type}\n\n` +
        '```\n' +
        result.chunk.content +
        '\n```'
      );

      if (result.chunk.metadata.symbols.length > 0) {
        contextParts.push(`\n**Symbols:** ${result.chunk.metadata.symbols.join(', ')}`);
      }
    }

    let fullContext = contextParts.join('\n');

    const tokenEstimate = this.estimateTokens(fullContext);
    
    if (tokenEstimate > this.config.maxContextTokens) {
      const ratio = this.config.maxContextTokens / tokenEstimate;
      const keepResults = Math.ceil(results.length * ratio);
      
      fullContext = this.buildContext(results.slice(0, keepResults));
      
      logger.warn('RAGEngine', `⚠️  Context truncated to fit token limit`, {
        originalTokens: tokenEstimate,
        maxTokens: this.config.maxContextTokens,
        keptResults: keepResults
      });
    }

    return fullContext;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export const ragEngine = new RAGEngine();