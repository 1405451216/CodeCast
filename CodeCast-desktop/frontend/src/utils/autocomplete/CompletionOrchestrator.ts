import { LocalCompletionCache } from './LocalCompletionCache';
import { ProjectSymbolIndex, IndexQueryOptions } from './ProjectSymbolIndex';
import { AICompletionService, AICompletionRequest, AICompletionSuggestion } from './AICompletionService';
import { CompletionItem, CompletionContext, CompletionType } from '../autocomplete/SmartCompletionEngine';
import { logger } from '../../utils/logger';

export type CacheLevel = 'L1' | 'L2' | 'L3' | 'merged';

export interface OrchestratorResult {
  items: CompletionItem[];
  level: CacheLevel;
  latencyMs: number;
  l1Hit: boolean;
  l2Hit: boolean;
  l3Hit: boolean;
  timing: {
    l1?: number;
    l2?: number;
    l3?: number;
    merge?: number;
  };
}

export interface PerformanceMetrics {
  totalRequests: number;
  l1Hits: number;
  l2Hits: number;
  l3Hits: number;
  cacheMisses: number;
  cancellations: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  latencies: number[];
}

export interface OrchestratorOptions {
  debounceMs?: number;
  enableL1?: boolean;
  enableL2?: boolean;
  enableL3?: boolean;
  l2MinPrefixLength?: number;
  maxResults?: number;
}

const DEFAULT_OPTIONS: Required<OrchestratorOptions> = {
  debounceMs: 200,
  enableL1: true,
  enableL2: true,
  enableL3: true,
  l2MinPrefixLength: 2,
  maxResults: 20
};

export class CompletionOrchestrator {
  private l1Cache: LocalCompletionCache;
  private l3Index: ProjectSymbolIndex;
  private l2Service: AICompletionService;

  private activeRequestId = 0;
  private abortControllers: Map<number, AbortController> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private metrics: PerformanceMetrics = {
    totalRequests: 0,
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    cacheMisses: 0,
    cancellations: 0,
    avgLatencyMs: 0,
    p50LatencyMs: 0,
    p95LatencyMs: 0,
    p99LatencyMs: 0,
    latencies: []
  };

  private options: Required<OrchestratorOptions>;

  constructor(options?: OrchestratorOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.l1Cache = new LocalCompletionCache();
    this.l3Index = new ProjectSymbolIndex();
    this.l2Service = new AICompletionService();

    this.l1Cache.preloadCommonSnippets();

    logger.info('CompletionOrchestrator', '🎯 三级缓存调度器初始化完成', {
      debounceMs: this.options.debounceMs,
      l2MinPrefix: this.options.l2MinPrefixLength,
      enableL1: this.options.enableL1,
      enableL2: this.options.enableL2,
      enableL3: this.options.enableL3
    });
  }

  async getCompletions(
    context: CompletionContext,
    options?: Partial<OrchestratorOptions>
  ): Promise<OrchestratorResult> {
    const requestId = ++this.activeRequestId;
    const startTime = performance.now();

    this.metrics.totalRequests++;

    this.cancelPreviousRequests(requestId);

    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    try {
      const timing: OrchestratorResult['timing'] = {};
      const allItems: CompletionItem[] = [];
      let l1Hit = false;
      let l2Hit = false;
      let l3Hit = false;

      if (this.options.enableL1) {
        const l1Start = performance.now();
        const l1Results = this.queryL1(context);
        timing.l1 = performance.now() - l1Start;

        if (l1Results.length >= 5) {
          allItems.push(...l1Results);
          l1Hit = true;
          this.metrics.l1Hits++;

          this.backfillL1ToCache(l1Results, context);

          if (!this.shouldFetchHigherLevels(l1Results, context)) {
            const result = this.buildResult(allItems, startTime, timing, { l1Hit, l2Hit, l3Hit });
            this.recordLatency(result.latencyMs);
            return result;
          }
        } else if (l1Results.length > 0) {
          allItems.push(...l1Results);
          l1Hit = true;
          this.metrics.l1Hits++;
        }

        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      }

      if (this.options.enableL3 && !controller.signal.aborted) {
        const l3Start = performance.now();
        const l3Results = await this.queryL3(context);
        timing.l3 = performance.now() - l3Start;

        if (l3Results.length > 0) {
          allItems.push(...l3Results);
          l3Hit = true;
          this.metrics.l3Hits++;
        }

        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      }

      if (
        this.options.enableL2 &&
        context.prefix.length >= this.options.l2MinPrefixLength &&
        !controller.signal.aborted
      ) {
        const l2Start = performance.now();
        const l2Results = await this.queryL2(context, controller.signal);
        timing.l2 = performance.now() - l2Start;

        if (l2Results.length > 0) {
          allItems.push(...l2Results);
          l2Hit = true;
          this.metrics.l2Hits++;
        }
      }

      if (allItems.length === 0) {
        this.metrics.cacheMisses++;
      }

      const mergeStart = performance.now();
      const finalItems = this.mergeAndRank(allItems, context);
      timing.merge = performance.now() - mergeStart;

      const result = this.buildResult(
        finalItems.slice(0, this.options.maxResults),
        startTime,
        timing,
        { l1Hit, l2Hit, l3Hit }
      );

      this.recordLatency(result.latencyMs);
      this.cacheResults(finalItems.slice(0, 10), context);

      return result;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.metrics.cancellations++;
        logger.debug('CompletionOrchestrator', '🚫 请求已取消', { requestId });
        return {
          items: [],
          level: 'merged',
          latencyMs: performance.now() - startTime,
          l1Hit: false,
          l2Hit: false,
          l3Hit: false,
          timing: {}
        };
      }

      logger.error('CompletionOrchestrator', '❌ 补全请求失败', error);

      const fallback = this.getFallbackResults(context);
      return this.buildResult(
        fallback,
        startTime,
        {},
        { l1Hit: false, l2Hit: false, l3Hit: false }
      );
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  getDebouncedCompletions(
    context: CompletionContext,
    callback: (result: OrchestratorResult) => void,
    options?: Partial<OrchestratorOptions>
  ): () => void {
    const key = `${context.filePath}:${context.line}:${context.column}:${context.prefix}`;

    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      try {
        const result = await this.getCompletions(context, options);
        callback(result);
      } catch (error) {
        logger.error('CompletionOrchestrator', '❌ 去抖回调异常', error);
      }
    }, options?.debounceMs || this.options.debounceMs);

    this.debounceTimers.set(key, timer);

    return () => {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
    };
  }

  cancelAll(): void {
    for (const [id, controller] of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();

    for (const [key, timer] of this.debounceTimers) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    logger.debug('CompletionOrchestrator', '🛑 所有请求已取消');
  }

  indexProjectFiles(files: Array<{ path: string; content: string }>): Promise<unknown> {
    return this.l3Index.indexProject(files);
  }

  recordUsage(item: CompletionItem): void {
    this.l1Cache.recordHistory(item.insertText, {
      language: undefined,
      filePath: undefined
    });
  }

  invalidateFile(filePath: string): void {
    this.l3Index.removeFile(filePath);
    this.l1Cache.invalidateByLanguage(this.detectLanguage(filePath));
  }

  scheduleFileUpdate(filePath: string): void {
    this.l3Index.scheduleUpdate(filePath);
  }

  async processPendingUpdates(fetchContent: (path: string) => Promise<string>): Promise<number> {
    return this.l3Index.processPendingUpdates(fetchContent);
  }

  getMetrics(): PerformanceMetrics {
    const sorted = [...this.metrics.latencies].sort((a, b) => a - b);

    return {
      ...this.metrics,
      avgLatencyMs: sorted.length > 0
        ? sorted.reduce((a, b) => a + b, 0) / sorted.length
        : 0,
      p50LatencyMs: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0,
      p95LatencyMs: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0,
      p99LatencyMs: sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0
    };
  }

  getDetailedStats(): {
    orchestrator: PerformanceMetrics;
    l1Cache: ReturnType<LocalCompletionCache['getStats']>;
    l3Index: ReturnType<ProjectSymbolIndex['getStats']>;
    l2Service: ReturnType<AICompletionService['getStats']>;
  } {
    return {
      orchestrator: this.getMetrics(),
      l1Cache: this.l1Cache.getStats(),
      l3Index: this.l3Index.getStats(),
      l2Service: this.l2Service.getStats()
    };
  }

  clearAllCaches(): void {
    this.cancelAll();
    this.l1Cache.clear();
    this.l3Index.clear();
    this.l2Service.clearCache();
    this.metrics.latencies = [];
    logger.info('CompletionOrchestrator', '🗑️ 所有缓存已清空');
  }

  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      cacheMisses: 0,
      cancellations: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      latencies: []
    };
  }

  private queryL1(context: CompletionContext): CompletionItem[] {
    return this.l1Cache.query(context.prefix, {
      language: context.language,
      filePath: context.filePath,
      lineContent: context.lineContent
    });
  }

  private async queryL3(context: CompletionContext): Promise<CompletionItem[]> {
    const queryOptions: IndexQueryOptions = {
      filePath: context.filePath,
      language: context.language,
      limit: 15,
      fuzzy: true,
      includeImports: context.prefix.startsWith('from') ||
                     context.prefix.startsWith('import') ||
                     /(?:import|from)\s+\w*$/.test(context.lineContent)
    };

    return this.l3Index.query(context.prefix, queryOptions);
  }

  private async queryL2(
    context: CompletionContext,
    signal: AbortSignal
  ): Promise<CompletionItem[]> {
    try {
      const request: AICompletionRequest = {
        context: context.fullText,
        filePath: context.filePath,
        position: { line: context.line, column: context.column },
        language: context.language,
        maxSuggestions: 3
      };

      const response = await Promise.race([
        this.l2Service.getSuggestions(request),
        new Promise<never>((_, reject) => {
          const timeout = setTimeout(() => reject(new Error('L2 timeout')), 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Cancelled', 'AbortError'));
          }, { once: true });
        })
      ]);

      return response.suggestions.map((suggestion: AICompletionSuggestion, index: number) => ({
        id: `ai-l2-${index}-${Date.now()}`,
        label: suggestion.displayText || suggestion.text.slice(0, 50),
        insertText: suggestion.insertText || suggestion.text,
        type: this.mapAIType(suggestion.type),
        detail: `AI (${response.model})`,
        documentation: suggestion.documentation,
        confidence: Math.min(0.98, suggestion.confidence),
        source: 'ai' as const,
        score: suggestion.confidence * 25 + 10,
        icon: '🤖',
        range: suggestion.additionalEdits?.[0]?.range
      }));
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      logger.warn('CompletionOrchestrator', '⚠️ L2 查询失败，降级处理', error);
      return [];
    }
  }

  private shouldFetchHigherLevels(l1Results: CompletionItem[], context: CompletionContext): boolean {
    const hasHighConfidence = l1Results.some(r => r.confidence >= 0.95);
    if (hasHighConfidence && l1Results.length >= 8) return false;

    const exactMatch = l1Results.some(r =>
      r.label.toLowerCase() === context.prefix.toLowerCase()
    );
    if (exactMatch && l1Results.length >= 5) return false;

    if (context.prefix.length < 2) return false;

    return true;
  }

  private backfillL1ToCache(items: CompletionItem[], context: CompletionContext): void {
    const toCache = items.filter(i =>
      i.source === 'local' &&
      i.confidence >= 0.85
    ).slice(0, 5);

    if (toCache.length > 0) {
      this.l1Cache.putBatch(toCache, {
        source: 'snippet',
        language: context.language,
        fileType: context.filePath.split('.').pop()
      });
    }
  }

  private cacheResults(items: CompletionItem[], context: CompletionContext): void {
    const highQuality = items.filter(i => i.confidence >= 0.7);
    if (highQuality.length > 0) {
      this.l1Cache.putBatch(highQuality, {
        source: 'symbol',
        language: context.language,
        fileType: context.filePath.split('.').pop()
      });
    }
  }

  private mergeAndRank(items: CompletionItem[], context: CompletionContext): CompletionItem[] {
    if (items.length === 0) return [];

    const scored = items.map(item => {
      let score = item.score;

      if (item.label.toLowerCase() === context.prefix.toLowerCase()) {
        score += 40;
      } else if (item.label.toLowerCase().startsWith(context.prefix.toLowerCase())) {
        score += 20;
      }

      if (item.source === 'ai') {
        score *= 1.1;
      } else if (item.source === 'indexed') {
        score *= 1.05;
      }

      if (item.confidence >= 0.9) {
        score += 15;
      } else if (item.confidence >= 0.7) {
        score += 8;
      }

      if (item.type === 'snippet' && context.prefix.length <= 3) {
        score += 5;
      }

      return { ...item, score };
    });

    const deduped = this.deduplicateByLabel(scored);

    deduped.sort((a, b) => {
      if (Math.abs(b.score - a.score) < 2) {
        return b.confidence - a.confidence;
      }
      return b.score - a.score;
    });

    const exactMatches = deduped.filter(i =>
      i.label.toLowerCase() === context.prefix.toLowerCase()
    );
    const prefixMatches = deduped.filter(i =>
      i.label.toLowerCase().startsWith(context.prefix.toLowerCase()) &&
      !exactMatches.includes(i)
    );
    const others = deduped.filter(i =>
      !exactMatches.includes(i) && !prefixMatches.includes(i)
    );

    return [...exactMatches, ...prefixMatches, ...others];
  }

  private deduplicateByLabel(items: CompletionItem[]): CompletionItem[] {
    const seen = new Map<string, CompletionItem>();

    for (const item of items) {
      const key = item.label.toLowerCase();
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, item);
      } else if (item.score > existing.score || item.confidence > existing.confidence) {
        seen.set(key, item);
      }
    }

    return Array.from(seen.values());
  }

  private buildResult(
    items: CompletionItem[],
    startTime: number,
    timing: OrchestratorResult['timing'],
    hits: { l1Hit: boolean; l2Hit: boolean; l3Hit: boolean }
  ): OrchestratorResult {
    const latencyMs = performance.now() - startTime;

    let level: CacheLevel = 'merged';
    if (hits.l1Hit && !hits.l2Hit && !hits.l3Hit) level = 'L1';
    else if (hits.l2Hit && !hits.l1Hit && !hits.l3Hit) level = 'L2';
    else if (hits.l3Hit && !hits.l1Hit && !hits.l2Hit) level = 'L3';

    return { items, level, latencyMs, ...hits, timing };
  }

  private getFallbackResults(context: CompletionContext): CompletionItem[] {
    return this.l1Cache.query(context.prefix, {
      language: context.language,
      filePath: context.filePath
    }).slice(0, 10);
  }

  private cancelPreviousRequests(currentRequestId: number): void {
    for (const [id, controller] of this.abortControllers) {
      if (id !== currentRequestId) {
        controller.abort();
        this.abortControllers.delete(id);
      }
    }
  }

  private recordLatency(latencyMs: number): void {
    this.metrics.latencies.push(latencyMs);
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies = this.metrics.latencies.slice(-500);
    }
  }

  private mapAIType(type: string): CompletionType {
    const mapping: Record<string, CompletionType> = {
      'code': 'snippet',
      'comment': 'comment',
      'import': 'import',
      'function': 'function',
      'variable': 'variable',
      'snippet': 'snippet'
    };
    return mapping[type] || 'snippet';
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go'
    };
    return langMap[ext] || 'typescript';
  }
}
