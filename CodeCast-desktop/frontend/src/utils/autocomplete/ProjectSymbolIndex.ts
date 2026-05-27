import { FuzzyMatcher, FuzzyMatchResult } from './FuzzyMatcher';
import { CompletionItem, CompletionType } from '../autocomplete/SmartCompletionEngine';
import { logger } from '../../utils/logger';

export interface ProjectSymbol {
  id: string;
  name: string;
  type: SymbolType;
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'enum' | 'method' | 'property' | 'constant' | 'module' | 'import';
  filePath: string;
  line: number;
  column: number;
  signature?: string;
  documentation?: string;
  exports?: boolean;
  isDefault?: boolean;
  language: string;
  lastModified: number;
}

export type SymbolType = CompletionType | 'import' | 'module';

export interface FileSnapshot {
  path: string;
  contentHash: string;
  lastModified: number;
  symbols: ProjectSymbol[];
  imports: ImportEntry[];
}

export interface ImportEntry {
  modulePath: string;
  symbols: string[];
  isDefault?: boolean;
  isNamespace?: boolean;
  line: number;
}

export interface IndexQueryOptions {
  types?: SymbolType[];
  filePath?: string;
  language?: string;
  limit?: number;
  fuzzy?: boolean;
  includeImports?: boolean;
  exportedOnly?: boolean;
}

export interface IndexStats {
  totalFiles: number;
  totalSymbols: number;
  symbolsByType: Record<string, number>;
  languages: string[];
  indexingTimeMs: number;
  lastUpdateTime: number;
  pendingUpdates: number;
}

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];

const SYMBOL_PATTERNS: Record<string, Array<{ pattern: RegExp; type: ProjectSymbol['kind']; extractor: (match: RegExpExecArray) => Partial<ProjectSymbol> }>> = {
  typescript: [
    {
      pattern: /(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
      type: 'function',
      extractor: (m) => ({ name: m[1], signature: `function ${m[1]}(${m[2]})` })
    },
    {
      pattern: /(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])*\s*=>/g,
      type: 'function',
      extractor: (m) => ({ name: m[1], signature: `const ${m[1]} = ...` })
    },
    {
      pattern: /(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)/g,
      type: 'class',
      extractor: (m) => ({ name: m[1], signature: `class ${m[1]}` })
    },
    {
      pattern: /(?:export\s+)?(?:type|interface)\s+(\w+)/g,
      type: 'interface',
      extractor: (m) => ({ name: m[1], signature: `interface ${m[1]}` })
    },
    {
      pattern: /(?:export\s+)?enum\s+(\w+)/g,
      type: 'enum',
      extractor: (m) => ({ name: m[1], signature: `enum ${m[1]}` })
    },
    {
      pattern: /(?:export\s+)?const\s+(\w+)\s*[:=]/g,
      type: 'constant',
      extractor: (m) => ({ name: m[1] })
    },
    {
      pattern: /(\w+)\s*(?:\([^)]*\))?\s*[:{]\s*$/gm,
      type: 'method',
      extractor: (m) => ({ name: m[1] })
    }
  ],
  javascript: [
    {
      pattern: /(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
      type: 'function',
      extractor: (m) => ({ name: m[1], signature: `function ${m[1]}(${m[2]})` })
    },
    {
      pattern: /(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])*\s*=>/g,
      type: 'function',
      extractor: (m) => ({ name: m[1] })
    },
    {
      pattern: /(?:export\s+(?:default\s+)?)?class\s+(\w+)/g,
      type: 'class',
      extractor: (m) => ({ name: m[1] })
    },
    {
      pattern: /(?:export\s+)?const\s+(\w+)\s*[:=]/g,
      type: 'constant',
      extractor: (m) => ({ name: m[1] })
    }
  ],
  python: [
    {
      pattern: /^def\s+(\w+)\s*\(([^)]*)\)/gm,
      type: 'function',
      extractor: (m) => ({ name: m[1], signature: `def ${m[1]}(${m[2]})` })
    },
    {
      pattern: /^class\s+(\w+)/gm,
      type: 'class',
      extractor: (m) => ({ name: m[1] })
    },
    {
      pattern: /^(\w+)\s*=\s*(?!=)/gm,
      type: 'variable',
      extractor: (m) => ({ name: m[1] })
    },
    {
      pattern: /^@(?:staticmethod|classmethod|property)\s*\n\s*def\s+(\w+)/gm,
      type: 'method',
      extractor: (m) => ({ name: m[1] })
    }
  ],
  go: [
    {
      pattern: /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)/g,
      type: 'function',
      extractor: (m) => ({ name: m[1], signature: `func ${m[1]}(${m[2]})` })
    },
    {
      pattern: /type\s+(\w+)\s+(?:struct|interface)/g,
      type: 'class',
      extractor: (m) => ({ name: m[1] })
    },
    {
      pattern: /var\s+(\w+)/g,
      type: 'variable',
      extractor: (m) => ({ name: m[1] })
    },
    {
      pattern: /const\s+(\w+)/g,
      type: 'constant',
      extractor: (m) => ({ name: m[1] })
    }
  ]
};

const IMPORT_PATTERNS: Record<string, RegExp> = {
  typescript: /import\s+(?:(\w+),?\s*)?(?:\{([^}]+)\})?\s*from\s+['"]([^'"]+)['"]/g,
  javascript: /import\s+(?:(\w+),?\s*)?(?:\{([^}]+)\})?\s*from\s+['"]([^'"]+)['"]/g,
  python: /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm,
  go: /"([^"]+)"/g
};

export class ProjectSymbolIndex {
  private files: Map<string, FileSnapshot> = new Map();
  private symbolLookup: Map<string, ProjectSymbol[]> = new Map();
  private nameIndex: Map<string, Set<string>> = new Map();
  private pendingUpdates: Set<string> = new Set();
  private isIndexing = false;

  private stats: IndexStats = {
    totalFiles: 0,
    totalSymbols: 0,
    symbolsByType: {},
    languages: [],
    indexingTimeMs: 0,
    lastUpdateTime: 0,
    pendingUpdates: 0
  };

  private static computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  async indexFile(filePath: string, content: string): Promise<FileSnapshot | null> {
    if (!this.isSupportedFile(filePath)) return null;

    const startTime = performance.now();
    const language = this.detectLanguage(filePath);
    const contentHash = ProjectSymbolIndex.computeHash(content);

    const existing = this.files.get(filePath);
    if (existing && existing.contentHash === contentHash) {
      return existing;
    }

    const symbols = this.extractSymbols(content, language, filePath);
    const imports = this.extractImports(content, language);

    const snapshot: FileSnapshot = {
      path: filePath,
      contentHash,
      lastModified: Date.now(),
      symbols,
      imports
    };

    if (existing) {
      this.removeSymbolsFromFile(filePath);
    }

    this.files.set(filePath, snapshot);
    this.addSymbolsToIndex(symbols);
    this.updateStats();

    const elapsed = performance.now() - startTime;
    logger.debug('ProjectSymbolIndex', `📄 索引文件 [${elapsed.toFixed(1)}ms]: ${filePath}`, {
      symbolCount: symbols.length,
      importCount: imports.length
    });

    return snapshot;
  }

  async indexProject(files: Array<{ path: string; content: string }>): Promise<IndexStats> {
    const startTime = performance.now();
    this.isIndexing = true;

    try {
      const supportedFiles = files.filter(f => this.isSupportedFile(f.path));
      logger.info('ProjectSymbolIndex', `📁 开始索引项目: ${supportedFiles.length} 个文件`);

      const batchSize = 20;
      for (let i = 0; i < supportedFiles.length; i += batchSize) {
        const batch = supportedFiles.slice(i, i + batchSize);
        await Promise.all(batch.map(f => this.indexFile(f.path, f.content)));
      }

      this.stats.lastUpdateTime = Date.now();
      this.stats.indexingTimeMs = performance.now() - startTime;

      logger.info('ProjectSymbolIndex', `✅ 项目索引完成`, {
        totalTime: `${this.stats.indexingTimeMs.toFixed(0)}ms`,
        totalFiles: this.stats.totalFiles,
        totalSymbols: this.stats.totalSymbols
      });

      return this.getStats();
    } finally {
      this.isIndexing = false;
    }
  }

  query(query: string, options?: IndexQueryOptions): CompletionItem[] {
    const startTime = performance.now();

    if (!query) {
      return this.getTopSymbols(options?.limit || 15, options?.language);
    }

    let candidates: ProjectSymbol[] = [];

    if (options?.filePath) {
      const fileSnap = this.files.get(options.filePath);
      if (fileSnap) {
        candidates = [...fileSnap.symbols];
        const projectSymbols = this.getSymbolsNotInFile(options.filePath);
        candidates.push(...projectSymbols);
      } else {
        candidates = this.getAllSymbols();
      }
    } else {
      candidates = this.getAllSymbols();
    }

    if (options?.types && options.types.length > 0) {
      candidates = candidates.filter(s => options!.types!.includes(s.type as any));
    }

    if (options?.language) {
      candidates = candidates.filter(s => s.language === options!.language);
    }

    if (options?.exportedOnly) {
      candidates = candidates.filter(s => s.exports);
    }

    let matched: Array<{ symbol: ProjectSymbol; result?: FuzzyMatchResult }> = [];

    if (options?.fuzzy !== false) {
      const lowerQuery = query.toLowerCase();

      const exactMatches = candidates.filter(s =>
        s.name.toLowerCase() === lowerQuery
      );
      if (exactMatches.length > 0) {
        matched = exactMatches.map(s => ({
          symbol: s,
          result: { item: s.name, score: 100, matches: [] }
        }));
      } else {
        const prefixMatches = candidates.filter(s =>
          s.name.toLowerCase().startsWith(lowerQuery)
        );
        if (prefixMatches.length > 0) {
          matched = prefixMatches.slice(0, 30).map(s => ({
            symbol: s,
            result: { item: s.name, score: 60 + (lowerQuery.length / s.name.length) * 40, matches: [] }
          }));
        } else {
          const fuzzyResults = FuzzyMatcher.filterEnhanced(
            candidates,
            query,
            s => s.name
          );
          matched = fuzzyResults.slice(0, 20).map(({ item, result }) => ({
            symbol: item,
            result
          }));
        }
      }
    } else {
      const lowerQuery = query.toLowerCase();
      matched = candidates
        .filter(s => s.name.toLowerCase().includes(lowerQuery))
        .slice(0, options?.limit || 50)
        .map(s => ({ symbol: s }));
    }

    if (options?.includeImports && query) {
      const importMatches = this.searchImports(query, options.filePath);
      const importItems: CompletionItem[] = importMatches.map(imp => ({
        id: `imp-${imp.modulePath}-${imp.symbols[0]}`,
        label: imp.symbols[0],
        insertText: imp.symbols[0],
        type: 'import' as CompletionType,
        detail: `from ${imp.modulePath}`,
        documentation: imp.symbols.length > 1 ? `also imports: ${imp.symbols.slice(1).join(', ')}` : undefined,
        confidence: 0.85,
        source: 'indexed' as const,
        score: 16,
        icon: '📥'
      }));

      const symbolItems = this.convertToCompletionItems(matched, options?.limit || 10);
      const combined = [...symbolItems, ...importItems];
      combined.sort((a, b) => b.score - a.score);

      const elapsed = performance.now() - startTime;
      if (elapsed > 10) {
        logger.warn('ProjectSymbolIndex', `⚠️ L3 查询超时: ${elapsed.toFixed(1)}ms`);
      }

      return combined.slice(0, options?.limit || 20);
    }

    const results = this.convertToCompletionItems(matched, options?.limit || 15);

    const elapsed = performance.now() - startTime;
    if (elapsed > 10) {
      logger.warn('ProjectSymbolIndex', `⚠️ L3 查询超时: ${elapsed.toFixed(1)}ms`);
    }

    return results;
  }

  scheduleUpdate(filePath: string): void {
    this.pendingUpdates.add(filePath);
    this.stats.pendingUpdates = this.pendingUpdates.size;
  }

  async processPendingUpdates(getContent: (path: string) => Promise<string>): Promise<number> {
    if (this.pendingUpdates.size === 0) return 0;

    const paths = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();
    this.stats.pendingUpdates = 0;

    let updated = 0;
    for (const path of paths) {
      try {
        const content = await getContent(path);
        await this.indexFile(path, content);
        updated++;
      } catch (error) {
        logger.warn('ProjectSymbolIndex', `⚠️ 更新失败: ${path}`, error);
      }
    }

    return updated;
  }

  removeFile(filePath: string): void {
    this.removeSymbolsFromFile(filePath);
    this.files.delete(filePath);
    this.updateStats();
  }

  getStats(): IndexStats {
    return { ...this.stats };
  }

  clear(): void {
    this.files.clear();
    this.symbolLookup.clear();
    this.nameIndex.clear();
    this.pendingUpdates.clear();
    this.stats = {
      totalFiles: 0,
      totalSymbols: 0,
      symbolsByType: {},
      languages: [],
      indexingTimeMs: 0,
      lastUpdateTime: 0,
      pendingUpdates: 0
    };
    logger.info('ProjectSymbolIndex', '🗑️ 符号索引已清空');
  }

  getSymbolsForFile(filePath: string): ProjectSymbol[] {
    const snap = this.files.get(filePath);
    return snap ? [...snap.symbols] : [];
  }

  getImportCompletions(filePath: string, partialModule?: string): CompletionItem[] {
    const allImports: ImportEntry[] = [];
    this.files.forEach(snap => {
      if (snap.path !== filePath) {
        allImports.push(...snap.imports);
      }
    });

    const uniqueModules = new Map<string, ImportEntry>();
    for (const imp of allImports) {
      if (!uniqueModules.has(imp.modulePath)) {
        uniqueModules.set(imp.modulePath, imp);
      } else {
        const existing = uniqueModules.get(imp.modulePath)!;
        existing.symbols = [...new Set([...existing.symbols, ...imp.symbols])];
      }
    }

    let modules = Array.from(uniqueModules.values());
    if (partialModule) {
      const lower = partialModule.toLowerCase();
      modules = modules.filter(m =>
        m.modulePath.toLowerCase().includes(lower)
      );
    }

    return modules.slice(0, 15).map(imp => ({
      id: `mod-${imp.modulePath}`,
      label: imp.modulePath,
      insertText: imp.modulePath,
      type: 'import' as CompletionType,
      detail: `${imp.symbols.length} 个导出符号`,
      documentation: imp.symbols.slice(0, 5).join(', ') + (imp.symbols.length > 5 ? '...' : ''),
      confidence: 0.85,
      source: 'indexed' as const,
      score: 14,
      icon: '📦'
    }));
  }

  private extractSymbols(content: string, language: string, filePath: string): ProjectSymbol[] {
    const symbols: ProjectSymbol[] = [];
    const lines = content.split('\n');
    const patterns = SYMBOL_PATTERNS[language] || SYMBOL_PATTERNS.typescript;

    for (const { pattern, type, extractor } of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        const col = match.index - content.lastIndexOf('\n', match.index - 1);

        const extracted = extractor(match);
        const isExported = match[0].includes('export');
        const isDefault = match[0].includes('default');

        symbols.push({
          id: `${filePath}:${lineNum}:${extracted.name}`,
          name: extracted.name || 'unknown',
          type: type as SymbolType,
          kind: type,
          filePath,
          line: lineNum,
          column: col,
          signature: extracted.signature,
          language,
          exports: isExported,
          isDefault,
          lastModified: Date.now()
        });
      }
    }

    return symbols;
  }

  private extractImports(content: string, language: string): ImportEntry[] {
    const imports: ImportEntry[] = [];
    const pattern = IMPORT_PATTERNS[language] || IMPORT_PATTERNS.typescript;
    const lines = content.split('\n');

    if (language === 'python') {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        const fromModule = match[1];
        const symbols = match[2].split(',').map(s => s.trim());
        imports.push({
          modulePath: fromModule || '',
          symbols,
          line: lineNum
        });
      }
    } else if (language === 'go') {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (content.slice(Math.max(0, match.index - 10), match.index).includes('import')) {
          const lineNum = content.slice(0, match.index).split('\n').length;
          imports.push({
            modulePath: match[1],
            symbols: [],
            line: lineNum
          });
        }
      }
    } else {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNum = content.slice(0, match.index).split('\n').length;
        const defaultImport = match[1];
        const namedImports = match[2]
          ? match[2].split(',').map(s => s.trim().replace(/\s+as\s+.*/, ''))
          : [];
        const modulePath = match[3];

        const allSymbols: string[] = [];
        if (defaultImport) allSymbols.push(defaultImport);
        allSymbols.push(...namedImports.filter(Boolean));

        if (allSymbols.length > 0) {
          imports.push({
            modulePath,
            symbols: allSymbols,
            isDefault: !!defaultImport,
            line: lineNum
          });
        }
      }
    }

    return imports;
  }

  private addSymbolsToIndex(symbols: ProjectSymbol[]): void {
    for (const symbol of symbols) {
      if (!this.symbolLookup.has(symbol.filePath)) {
        this.symbolLookup.set(symbol.filePath, []);
      }
      this.symbolLookup.get(symbol.filePath)!.push(symbol);

      const nameKey = symbol.name.toLowerCase();
      if (!this.nameIndex.has(nameKey)) {
        this.nameIndex.set(nameKey, new Set());
      }
      this.nameIndex.get(nameKey)!.add(symbol.id);
    }
  }

  private removeSymbolsFromFile(filePath: string): void {
    const symbols = this.symbolLookup.get(filePath);
    if (symbols) {
      for (const symbol of symbols) {
        const nameKey = symbol.name.toLowerCase();
        const ids = this.nameIndex.get(nameKey);
        if (ids) {
          ids.delete(symbol.id);
          if (ids.size === 0) {
            this.nameIndex.delete(nameKey);
          }
        }
      }
    }
    this.symbolLookup.delete(filePath);
  }

  private getAllSymbols(): ProjectSymbol[] {
    const all: ProjectSymbol[] = [];
    this.symbolLookup.forEach(symbols => all.push(...symbols));
    return all;
  }

  private getSymbolsNotInFile(excludePath: string): ProjectSymbol[] {
    const all: ProjectSymbol[] = [];
    this.symbolLookup.forEach((symbols, path) => {
      if (path !== excludePath) {
        all.push(...symbols);
      }
    });
    return all;
  }

  private getTopSymbols(limit: number, language?: string): CompletionItem[] {
    let symbols = this.getAllSymbols();

    if (language) {
      symbols = symbols.filter(s => s.language === language);
    }

    const exportedFirst = symbols.sort((a, b) => {
      if (a.exports && !b.exports) return -1;
      if (!a.exports && b.exports) return 1;
      return a.name.localeCompare(b.name);
    });

    return exportedFirst.slice(0, limit).map(s => ({
      id: s.id,
      label: s.name,
      insertText: s.name,
      type: s.type as CompletionType,
      detail: `${s.kind} · ${s.filePath.split('/').pop() || s.filePath.split('\\').pop()}`,
      documentation: s.signature,
      confidence: s.exports ? 0.8 : 0.6,
      source: 'indexed' as const,
      score: s.exports ? 14 : 8,
      icon: this.getIconForKind(s.kind)
    }));
  }

  private searchImports(query: string, currentFile?: string): ImportEntry[] {
    const lowerQuery = query.toLowerCase();
    const results: ImportEntry[] = [];

    this.files.forEach((snap, path) => {
      if (path === currentFile) return;

      for (const imp of snap.imports) {
        if (
          imp.modulePath.toLowerCase().includes(lowerQuery) ||
          imp.symbols.some(s => s.toLowerCase().includes(lowerQuery))
        ) {
          results.push(imp);
        }
      }
    });

    return results.slice(0, 10);
  }

  private convertToCompletionItems(
    matched: Array<{ symbol: ProjectSymbol; result?: FuzzyMatchResult }>,
    limit: number
  ): CompletionItem[] {
    return matched.slice(0, limit).map(({ symbol, result }) => ({
      id: symbol.id,
      label: symbol.name,
      insertText: symbol.name,
      type: symbol.type as CompletionType,
      detail: `${symbol.kind} · ${symbol.filePath.split('/').pop() || symbol.filePath.split('\\').pop()}${symbol.line ? `:${symbol.line}` : ''}`,
      documentation: symbol.signature,
      confidence: Math.min(0.95, 0.6 + (result?.score || 0) * 0.004),
      source: 'indexed' as const,
      score: (result?.score || 10) + (symbol.exports ? 5 : 0),
      icon: this.getIconForKind(symbol.kind)
    }));
  }

  private getIconForKind(kind: ProjectSymbol['kind']): string {
    const icons: Record<ProjectSymbol['kind'], string> = {
      function: 'ƒ',
      class: '▣',
      variable: 'x',
      interface: '☐',
      type: 'T',
      enum: '∑',
      method: '⚙',
      property: '•',
      constant: '𝒸',
      module: '📦',
      import: '📥'
    };
    return icons[kind] || '?';
  }

  private detectLanguage(filePath: string): string {
    const ext = '.' + (filePath.split('.').pop()?.toLowerCase() || '');
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go'
    };
    return langMap[ext] || 'typescript';
  }

  private isSupportedFile(filePath: string): boolean {
    return SUPPORTED_EXTENSIONS.some(ext => filePath.endsWith(ext));
  }

  private updateStats(): void {
    const symbolsByType: Record<string, number> = {};
    const languages = new Set<string>();
    let totalSymbols = 0;

    this.symbolLookup.forEach((symbols, filePath) => {
      totalSymbols += symbols.length;
      const lang = this.detectLanguage(filePath);
      languages.add(lang);

      for (const sym of symbols) {
        symbolsByType[sym.kind] = (symbolsByType[sym.kind] || 0) + 1;
      }
    });

    this.stats = {
      ...this.stats,
      totalFiles: this.files.size,
      totalSymbols,
      symbolsByType,
      languages: Array.from(languages),
      lastUpdateTime: Date.now()
    };
  }
}
