import { LRUCache } from './LRUCache';
import { FuzzyMatcher, FuzzyMatchResult } from './FuzzyMatcher';
import { CompletionItem, CompletionType } from '../autocomplete/SmartCompletionEngine';
import { logger } from '../../utils/logger';

export interface CacheEntryMeta {
  source: 'snippet' | 'history' | 'symbol' | 'slash' | 'keyword';
  language?: string;
  fileType?: string;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
}

export interface HistoryEntry {
  text: string;
  timestamp: number;
  contextLanguage?: string;
  contextFile?: string;
}

export interface SlashCommand {
  command: string;
  description: string;
  category: string;
  params?: string[];
  example?: string;
}

const BUILTIN_SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', description: '显示帮助信息', category: 'general' },
  { command: '/clear', description: '清空对话历史', category: 'general' },
  { command: '/model', description: '切换 AI 模型', category: 'model', params: ['model_name'] },
  { command: '/temperature', description: '设置生成温度', category: 'model', params: ['0.0-1.0'] },
  { command: '/system', description: '设置系统提示词', category: 'prompt' },
  { command: '/file', description: '读取文件内容', category: 'file', params: ['path'] },
  { command: '/search', description: '搜索项目文件', category: 'file', params: ['query'] },
  { command: '/grep', description: '正则搜索代码内容', category: 'search', params: ['pattern'] },
  { command: '/run', description: '执行命令', category: 'exec', params: ['command'] },
  { command: '/test', description: '运行测试', category: 'test' },
  { command: '/build', description: '构建项目', category: 'build' },
  { command: '/commit', description: 'Git 提交', category: 'git', params: ['message'] },
  { command: '/diff', description: '查看差异', category: 'git' },
  { command: '/branch', description: '切换/创建分支', category: 'git', params: ['name'] },
  { command: '/explain', description: '解释选中代码', category: 'ai' },
  { command: '/refactor', description: '重构选中代码', category: 'ai' },
  { command: '/optimize', description: '优化选中代码', category: 'ai' },
  { command: '/docs', description: '生成文档', category: 'ai' },
  { command: '/debug', description: '调试模式', category: 'debug' },
  { command: '/verbose', description: '详细输出模式', category: 'debug' }
];

const FILE_TYPE_KEYWORDS: Record<string, string[]> = {
  typescript: ['interface', 'type', 'enum', 'implements', 'extends', 'namespace', 'declare', 'abstract', 'readonly', 'as', 'is', 'keyof', 'infer', 'never', 'unknown'],
  javascript: ['let', 'const', 'var', 'function', 'class', 'async', 'await', 'yield', 'import', 'export', 'from', 'default', 'new', 'this', 'super', 'static', 'get', 'set'],
  python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'with', 'try', 'except', 'finally', 'raise', 'return', 'yield', 'lambda', 'import', 'from', 'as', 'global', 'nonlocal', 'pass', 'break', 'continue', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'],
  go: ['func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'case', 'default', 'range', 'if', 'else', 'for', 'switch', 'package', 'import', 'return', 'goto', 'fallthrough', 'break', 'continue']
};

export class LocalCompletionCache {
  private cache: LRUCache<string, { item: CompletionItem; meta: CacheEntryMeta }>;
  private history: HistoryEntry[] = [];
  private slashCommands: SlashCommand[];
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly MAX_HISTORY_SIZE = 50;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000;

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalQueries: 0
  };

  constructor(customSlashCommands?: SlashCommand[]) {
    this.cache = new LRUCache(this.MAX_CACHE_SIZE, this.CACHE_TTL_MS);
    this.slashCommands = [...BUILTIN_SLASH_COMMANDS, ...(customSlashCommands || [])];
    this.loadHistory();
    logger.info('LocalCompletionCache', '📦 Level-1 本地缓存初始化完成', {
      maxSize: this.MAX_CACHE_SIZE,
      historySize: this.history.length,
      slashCommands: this.slashCommands.length
    });
  }

  query(query: string, context?: {
    language?: string;
    filePath?: string;
    lineContent?: string;
  }): CompletionItem[] {
    const startTime = performance.now();
    this.stats.totalQueries++;

    const results: CompletionItem[] = [];

    const l1Results = this.queryCache(query, context);
    results.push(...l1Results);

    if (query.startsWith('/')) {
      const slashResults = this.matchSlashCommands(query);
      results.push(...slashResults);
    }

    if (!query || query.length < 2) {
      const recentHistory = this.getRecentHistory(context?.language, 8);
      results.push(...recentHistory);
    } else {
      const historyMatches = this.searchHistory(query, context?.language, 5);
      results.push(...historyMatches);
    }

    if (context?.language && !query) {
      const keywordResults = this.getKeywordsForLanguage(context.language, context.filePath);
      results.push(...keywordResults);
    }

    const deduped = this.deduplicate(results);
    const elapsed = performance.now() - startTime;

    if (deduped.length > 0) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    if (elapsed > 50) {
      logger.warn('LocalCompletionCache', `⚠️ L1 查询超时: ${elapsed.toFixed(1)}ms`, { query });
    }

    return deduped.slice(0, 20);
  }

  put(item: CompletionItem, meta?: Partial<CacheEntryMeta>): void {
    const fullMeta: CacheEntryMeta = {
      source: meta?.source || 'snippet',
      language: meta?.language,
      fileType: meta?.fileType,
      accessCount: 1,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    };

    const existing = this.cache.get(item.id);
    if (existing) {
      fullMeta.accessCount = existing.meta.accessCount + 1;
      fullMeta.createdAt = existing.meta.createdAt;
    }

    this.cache.set(item.id, { item, meta: fullMeta });
  }

  putBatch(items: CompletionItem[], meta?: Partial<CacheEntryMeta>): void {
    for (const item of items) {
      this.put(item, meta);
    }
  }

  recordHistory(text: string, context?: { language?: string; filePath?: string }): void {
    const entry: HistoryEntry = {
      text,
      timestamp: Date.now(),
      contextLanguage: context?.language,
      contextFile: context?.filePath
    };

    this.history.unshift(entry);

    if (this.history.length > this.MAX_HISTORY_SIZE) {
      this.history.pop();
    }

    this.persistHistory();
  }

  getStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    cacheSize: number;
    historySize: number;
    totalQueries: number;
    evictions: number;
  } {
    return {
      ...this.stats,
      hitRate: this.stats.totalQueries > 0
        ? this.stats.hits / this.stats.totalQueries
        : 0,
      cacheSize: this.cache.size,
      historySize: this.history.length,
      evictions: this.stats.evictions
    };
  }

  clear(): void {
    this.cache.clear();
    this.history = [];
    this.stats = { hits: 0, misses: 0, evictions: 0, totalQueries: 0 };
    try {
      localStorage.removeItem('cc_l1_history');
    } catch {}
    logger.info('LocalCompletionCache', '🗑️ L1 缓存已清空');
  }

  invalidateByLanguage(language: string): void {
    const keysToRemove: string[] = [];
    this.cache.forEach((value, key) => {
      if (value.meta.language === language) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => this.cache.delete(key));
    this.stats.evictions += keysToRemove.length;
  }

  preloadCommonSnippets(): void {
    const commonItems: CompletionItem[] = [
      { id: 'l1-console.log', label: 'console.log()', insertText: 'console.log($0);', type: 'snippet', detail: 'Console 输出', confidence: 0.99, source: 'local', score: 25, icon: '📝' },
      { id: 'l1-function', label: 'function', insertText: 'function ${1:name}(${2:params}) {\n\t$0\n}', type: 'snippet', detail: '函数声明', confidence: 0.95, source: 'local', score: 22, icon: 'ƒ' },
      { id: 'l1-const', label: 'const', insertText: 'const ${1:name} = ${2:value};', type: 'snippet', detail: '常量声明', confidence: 0.98, source: 'local', score: 24, icon: '𝒸' },
      { id: 'l1-import', label: 'import ... from', insertText: "import { ${1:module} } from '${2:package}';", type: 'snippet', detail: 'ES Module 导入', confidence: 0.96, source: 'local', score: 21, icon: '📦' },
      { id: 'l1-async', label: 'async function', insertText: 'async function ${1:name}(${2:params}) {\n\t$0\n}', type: 'snippet', detail: '异步函数', confidence: 0.93, source: 'local', score: 20, icon: 'ƒ' },
      { id: 'l1-if', label: 'if (...) { }', insertText: 'if (${1:condition}) {\n\t$0\n}', type: 'snippet', detail: '条件语句', confidence: 0.97, source: 'local', score: 23, icon: '🔀' },
      { id: 'l1-for', label: 'for (...)', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:arr}.length; ${1:i}++) {\n\t$0\n}', type: 'snippet', detail: 'For 循环', confidence: 0.94, source: 'local', score: 19, icon: '🔄' },
      { id: 'l1-class', label: 'class', insertText: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t$0\n\t}\n}', type: 'snippet', detail: '类定义', confidence: 0.90, source: 'local', score: 18, icon: '▣' },
      { id: 'l1-arrow', label: '() => {}', insertText: '(${1:params}) => {\n\treturn $0;\n};', type: 'snippet', detail: '箭头函数', confidence: 0.93, source: 'local', score: 19, icon: '→' },
      { id: 'l1-try', label: 'try-catch', insertText: 'try {\n\t$0\n} catch (error) {\n\tconsole.error(error);\n}', type: 'snippet', detail: '异常处理', confidence: 0.91, source: 'local', score: 17, icon: '⚠️' }
    ];

    this.putBatch(commonItems, { source: 'snippet' });
  }

  private queryCache(query: string, context?: {
    language?: string;
    filePath?: string;
  }): CompletionItem[] {
    if (!query) return [];

    const allEntries: Array<{ item: CompletionItem; meta: CacheEntryMeta }> = [];
    this.cache.forEach((entry) => {
      allEntries.push(entry);
    });

    let filtered = allEntries;

    if (context?.language) {
      filtered = filtered.filter(e =>
        !e.meta.language || e.meta.language === context.language
      );
    }

    if (context?.filePath) {
      const ext = context.filePath.split('.').pop()?.toLowerCase() || '';
      filtered = filtered.filter(e =>
        !e.meta.fileType || e.meta.fileType === ext
      );
    }

    if (!filtered.length) {
      filtered = allEntries;
    }

    const lowerQuery = query.toLowerCase();

    const exactMatch = filtered.find(e =>
      e.item.label.toLowerCase() === lowerQuery
    );
    if (exactMatch) {
      exactMatch.meta.accessCount++;
      exactMatch.meta.lastAccessed = Date.now();
      return [{
        ...exactMatch.item,
        confidence: Math.min(1, exactMatch.item.confidence + 0.05),
        score: exactMatch.item.score + 30,
        detail: `${exactMatch.item.detail || ''} (L1命中)`
      }];
    }

    const prefixMatches = filtered.filter(e =>
      e.item.label.toLowerCase().startsWith(lowerQuery)
    );

    if (prefixMatches.length > 0) {
      return prefixMatches
        .sort((a, b) => b.meta.accessCount - a.meta.accessCount)
        .slice(0, 10)
        .map(e => ({
          ...e.item,
          confidence: Math.min(1, e.item.confidence + 0.03),
          score: e.item.score + 15 + e.meta.accessCount * 0.5,
          detail: `${e.item.detail || ''}`
        }));
    }

    const fuzzyResults: Array<{ item: CompletionItem; result: FuzzyMatchResult }> = [];

    for (const entry of filtered) {
      const match = FuzzyMatcher.enhancedMatch(query, entry.item.label);
      if (match && match.score >= 20) {
        fuzzyResults.push({ item: entry.item, result: match });
      }
    }

    fuzzyResults.sort((a, b) => b.result.score - a.result.score);

    return fuzzyResults.slice(0, 8).map(({ item, result }) => ({
      ...item,
      score: item.score + result.score * 0.3,
      confidence: Math.min(1, item.confidence + result.score * 0.005)
    }));
  }

  private matchSlashCommands(query: string): CompletionItem[] {
    const searchQuery = query.toLowerCase().slice(1);

    return this.slashCommands
      .filter(cmd =>
        cmd.command.toLowerCase().includes(searchQuery) ||
        cmd.description.toLowerCase().includes(searchQuery)
      )
      .slice(0, 10)
      .map(cmd => ({
        id: `slash-${cmd.command}`,
        label: cmd.command,
        insertText: cmd.command + (cmd.params ? ` ${cmd.params.join(' ')}` : ''),
        type: 'keyword' as CompletionType,
        detail: cmd.description,
        documentation: cmd.example ? `示例: ${cmd.example}` : undefined,
        confidence: 0.95,
        source: 'local' as const,
        score: 28 + (cmd.command === query ? 10 : 0),
        icon: '⌨️'
      }));
  }

  private getRecentHistory(language?: string, limit: number = 8): CompletionItem[] {
    const candidates = language
      ? this.history.filter(h => !h.contextLanguage || h.contextLanguage === language)
      : this.history;

    return candidates
      .slice(0, limit)
      .map((entry, i) => ({
        id: `history-${i}-${Date.now()}`,
        label: entry.text.length > 50 ? entry.text.slice(0, 47) + '...' : entry.text,
        insertText: entry.text,
        type: 'snippet' as CompletionType,
        detail: '最近输入',
        confidence: 0.7 - i * 0.03,
        source: 'local' as const,
        score: 15 - i,
        icon: '🕐'
      }));
  }

  private searchHistory(query: string, language?: string, limit: number = 5): CompletionItem[] {
    const lowerQuery = query.toLowerCase();

    const candidates = language
      ? this.history.filter(h =>
          (!h.contextLanguage || h.contextLanguage === language) &&
          (h.text.toLowerCase().includes(lowerQuery))
        )
      : this.history.filter(h => h.text.toLowerCase().includes(lowerQuery));

    return candidates
      .slice(0, limit)
      .map((entry, i) => ({
        id: `hist-search-${i}-${Date.now()}`,
        label: entry.text.length > 50 ? entry.text.slice(0, 47) + '...' : entry.text,
        insertText: entry.text,
        type: 'snippet' as CompletionType,
        detail: '历史匹配',
        confidence: 0.75 - i * 0.02,
        source: 'local' as const,
        score: 18 - i,
        icon: '🕐'
      }));
  }

  private getKeywordsForLanguage(language: string, filePath?: string): CompletionItem[] {
    const keywords = FILE_TYPE_KEYWORDS[language] || FILE_TYPE_KEYWORDS.typescript;
    const ext = filePath?.split('.').pop()?.toLowerCase() || '';

    return keywords.map(kw => ({
      id: `kw-${language}-${kw}`,
      label: kw,
      insertText: kw,
      type: 'keyword' as CompletionType,
      detail: `${language} 关键字`,
      confidence: 0.85,
      source: 'local' as const,
      score: 12,
      icon: '🔑'
    }));
  }

  private deduplicate(items: CompletionItem[]): CompletionItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private loadHistory(): void {
    try {
      const saved = localStorage.getItem('cc_l1_history');
      if (saved) {
        this.history = JSON.parse(saved);
        if (!Array.isArray(this.history)) this.history = [];
      }
    } catch {
      this.history = [];
    }
  }

  private persistHistory(): void {
    try {
      localStorage.setItem('cc_l1_history', JSON.stringify(this.history.slice(0, this.MAX_HISTORY_SIZE)));
    } catch {
      // storage full or unavailable
    }
  }
}
