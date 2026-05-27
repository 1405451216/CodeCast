import { LRUCache } from './LRUCache';
import { FuzzyMatcher, FuzzyMatchResult } from './FuzzyMatcher';
import { CodeIndexer, CodeSymbol } from './CodeIndexer';
import { AICompletionService, AICompletionSuggestion } from './AICompletionService';
import { logger } from '../logger';

export type CompletionType = 
  | 'snippet' 
  | 'symbol' 
  | 'keyword' 
  | 'import' 
  | 'ai-suggestion'
  | 'variable'
  | 'function'
  | 'class'
  | 'method'
  | 'comment';

export interface CompletionItem {
  id: string;
  label: string;
  insertText: string;
  type: CompletionType;
  detail?: string;
  documentation?: string;
  confidence: number;
  source: 'local' | 'ai' | 'indexed';
  score: number;
  icon?: string;
  range?: { start: number; end: number };
}

export interface CompletionContext {
  filePath: string;
  language: string;
  line: number;
  column: number;
  lineContent: string;
  prefix: string;
  fullText: string;
}

export interface CompletionOptions {
  maxResults?: number;
  includeSnippets?: boolean;
  includeSymbols?: boolean;
  includeAI?: boolean;
  fuzzyMatch?: boolean;
  minConfidence?: number;
  debounceMs?: number;
}

export class SmartCompletionEngine {
  private codeIndexer: CodeIndexer;
  private aiService: AICompletionService;
  private snippetCache: LRUCache<string, CompletionItem[]>;
  private symbolCache: LRUCache<string, CompletionItem[]>;
  private recentCompletions: CompletionItem[] = [];
  private maxRecentItems = 50;

  private static readonly DEFAULT_OPTIONS: Required<CompletionOptions> = {
    maxResults: 20,
    includeSnippets: true,
    includeSymbols: true,
    includeAI: true,
    fuzzyMatch: true,
    minConfidence: 0.1,
    debounceMs: 100
  };

  constructor() {
    this.codeIndexer = new CodeIndexer();
    this.aiService = new AICompletionService();
    
    this.snippetCache = new LRUCache(200);
    this.symbolCache = new LRUCache(500);

    logger.info('SmartCompletionEngine', '🚀 Smart completion engine initialized');
  }

  async getCompletions(
    context: CompletionContext,
    options?: Partial<CompletionOptions>
  ): Promise<CompletionItem[]> {
    const startTime = performance.now();
    const opts = { ...SmartCompletionEngine.DEFAULT_OPTIONS, ...options };

    logger.debug('SmartCompletionEngine', '📝 Getting completions', {
      prefix: context.prefix,
      language: context.language,
      line: context.line
    });

    const allCompletions: CompletionItem[] = [];

    if (opts.includeSnippets) {
      const snippets = await this.getSnippetCompletions(context, opts);
      allCompletions.push(...snippets);
    }

    if (opts.includeSymbols) {
      const symbols = await this.getSymbolCompletions(context, opts);
      allCompletions.push(...symbols);
    }

    if (opts.includeAI && context.prefix.length >= 2) {
      const aiSuggestions = await this.getAICompletions(context, opts);
      allCompletions.push(...aiSuggestions);
    }

    const recentCompletions = this.getRecentCompletions(context);
    allCompletions.push(...recentCompletions);

    let results = this.rankAndFilter(allCompletions, context, opts);

    results = results.slice(0, opts.maxResults);

    const endTime = performance.now();
    logger.info('SmartCompletionEngine', `✅ Generated ${results.length} completions in ${(endTime - startTime).toFixed(1)}ms`, {
      breakdown: {
        snippets: allCompletions.filter(c => c.type === 'snippet').length,
        symbols: allCompletions.filter(c => ['symbol', 'function', 'class', 'method'].includes(c.type)).length,
        ai: allCompletions.filter(c => c.source === 'ai').length
      }
    });

    return results;
  }

  async getInlineCompletion(
    context: CompletionContext
  ): Promise<string> {
    try {
      const completion = await this.aiService.getInlineCompletion(
        context.fullText,
        { line: context.line, column: context.column },
        { maxTokens: 150, temperature: 0.2 }
      );

      return completion;
    } catch (error) {
      logger.error('SmartCompletionEngine', 'Error getting inline completion', error);
      return '';
    }
  }

  indexProjectFiles(files: Array<{ path: string; content: string }>): void {
    logger.info('SmartCompletionEngine', `📁 Indexing ${files.length} project files...`);
    
    this.codeIndexer.indexProject(files).then(() => {
      const stats = this.codeIndexer.getFileStats();
      logger.info('SmartCompletionEngine', '✅ Project indexing complete', stats);
    });
  }

  recordUsage(item: CompletionItem): void {
    const existingIndex = this.recentCompletions.findIndex(r => r.id === item.id);
    
    if (existingIndex !== -1) {
      this.recentCompletions.splice(existingIndex, 1);
    }

    this.recentCompletions.unshift(item);

    if (this.recentCompletions.length > this.maxRecentItems) {
      this.recentCompletions.pop();
    }

    logger.debug('SmartCompletionEngine', '📊 Recorded completion usage', {
      itemId: item.id,
      label: item.label,
      type: item.type
    });
  }

  clearCache(): void {
    this.snippetCache.clear();
    this.symbolCache.clear();
    this.aiService.clearCache();
    logger.info('SmartCompletionEngine', '🗑️  All caches cleared');
  }

  getStats(): {
    cacheStats: any;
    recentCount: number;
    indexerStats: any;
    aiStats: any;
  } {
    return {
      cacheStats: {
        snippets: this.snippetCache.stats,
        symbols: this.symbolCache.stats
      },
      recentCount: this.recentCompletions.length,
      indexerStats: this.codeIndexer.getFileStats(),
      aiStats: this.aiService.getStats()
    };
  }

  private async getSnippetCompletions(
    context: CompletionContext,
    options: Required<CompletionOptions>
  ): Promise<CompletionItem[]> {
    const cacheKey = `${context.language}:${context.prefix}`;
    
    let snippets = this.snippetCache.get(cacheKey);
    
    if (!snippets) {
      const codeSnippets = this.getCodeSnippetsForLanguage(context.language);
      
      if (!context.prefix) {
        snippets = codeSnippets.slice(0, 10).map(s => ({
          ...s,
          confidence: 0.8,
          source: 'local' as const
        }));
      } else if (options.fuzzyMatch) {
        const matches = FuzzyMatcher.filter(
          codeSnippets, 
          context.prefix, 
          s => s.label.toLowerCase()
        );
        
        snippets = matches.map(({ item, result }) => ({
          ...item,
          confidence: Math.min(1, result.score / 20),
          score: result.score,
          source: 'local' as const
        }));
      } else {
        snippets = codeSnippets
          .filter(s => s.label.toLowerCase().includes(context.prefix.toLowerCase()))
          .map(s => ({ ...s, confidence: 0.9, source: 'local' as const }));
      }

      this.snippetCache.set(cacheKey, snippets);
    }

    return snippets;
  }

  private async getSymbolCompletions(
    context: CompletionContext,
    options: Required<CompletionOptions>
  ): Promise<CompletionItem[]> {
    const cacheKey = `symbols:${context.filePath}:${context.line}:${context.prefix}`;
    
    let symbols = this.symbolCache.get(cacheKey);
    
    if (!symbols) {
      const indexedSymbols = this.codeIndexer.getCompletionsForContext(
        context.fullText,
        context.filePath,
        { line: context.line, column: context.column }
      );

      symbols = indexedSymbols.map(symbol => ({
        id: `symbol-${symbol.text}-${Date.now()}`,
        label: symbol.text,
        insertText: symbol.text,
        type: this.mapSymbolTypeToCompletionType(symbol.type),
        detail: symbol.type,
        documentation: symbol.documentation || symbol.text,
        confidence: 0.85,
        source: 'indexed' as const,
        score: 15,
        icon: this.getIconForType(symbol.type)
      }));

      if (context.prefix && options.fuzzyMatch) {
        const matches = FuzzyMatcher.filter(
          symbols,
          context.prefix,
          (s: CompletionItem) => s.label
        );
        symbols = matches.map(({ item, result }) => ({
          ...(item as CompletionItem),
          score: result.score + 10,
          confidence: Math.min(1, (item as CompletionItem).confidence + result.score / 30)
        }));
      }

      this.symbolCache.set(cacheKey, symbols);
    }

    return symbols;
  }

  private async getAICompletions(
    context: CompletionContext,
    options: Required<CompletionOptions>
  ): Promise<CompletionItem[]> {
    try {
      const response = await this.aiService.getSuggestions({
        context: context.fullText,
        filePath: context.filePath,
        position: { line: context.line, column: context.column },
        language: context.language,
        maxSuggestions: 3
      });

      return response.suggestions.map((suggestion, index) => ({
        id: `ai-${index}-${Date.now()}`,
        label: suggestion.displayText || suggestion.text.slice(0, 50),
        insertText: suggestion.insertText || suggestion.text,
        type: suggestion.type === 'code' ? 'snippet' : suggestion.type,
        detail: `AI (${response.model})`,
        documentation: suggestion.documentation,
        confidence: suggestion.confidence,
        source: 'ai' as const,
        score: suggestion.confidence * 20,
        icon: '🤖',
        range: suggestion.additionalEdits?.[0]?.range
      }));
    } catch (error) {
      logger.warn('SmartCompletionEngine', '⚠️  AI completions failed, using fallback', error);
      return [];
    }
  }

  private getRecentCompletions(context: CompletionContext): CompletionItem[] {
    if (!context.prefix) return [];

    const matching = this.recentCompletions
      .filter(item => 
        item.label.toLowerCase().includes(context.prefix.toLowerCase()) ||
        item.insertText.toLowerCase().includes(context.prefix.toLowerCase())
      )
      .slice(0, 5)
      .map(item => ({
        ...item,
        confidence: item.confidence + 0.1,
        score: item.score + 25,
        detail: `${item.detail || ''} (recent)`
      }));

    return matching;
  }

  private rankAndFilter(
    completions: CompletionItem[],
    context: CompletionContext,
    options: Required<CompletionOptions>
  ): CompletionItem[] {
    let ranked = [...completions];

    ranked = ranked.filter(c => c.confidence >= options.minConfidence);

    ranked.sort((a, b) => {
      if (Math.abs(b.score - a.score) < 0.1) {
        return b.confidence - a.confidence;
      }
      return b.score - a.score;
    });

    const exactMatches = ranked.filter(c => 
      c.label.toLowerCase() === context.prefix.toLowerCase()
    );
    const prefixMatches = ranked.filter(c => 
      c.label.toLowerCase().startsWith(context.prefix.toLowerCase()) &&
      !exactMatches.includes(c)
    );
    const otherMatches = ranked.filter(c => 
      !exactMatches.includes(c) && !prefixMatches.includes(c)
    );

    return [...exactMatches, ...prefixMatches, ...otherMatches];
  }

  private getCodeSnippetsForLanguage(language: string): CompletionItem[] {
    const snippets: Record<string, CompletionItem[]> = {
      typescript: [
        { id: 'ts-func', label: 'function', insertText: 'function ${1:name}(${2:params}) {\n\t$0\n}', type: 'snippet', detail: 'Function declaration', confidence: 0.95, source: 'local', score: 20, icon: 'ƒ' },
        { id: 'ts-async', label: 'async function', insertText: 'async function ${1:name}(${2:params}) {\n\tconst result = await $0\n\treturn result\n}', type: 'snippet', detail: 'Async function', confidence: 0.93, source: 'local', score: 19, icon: 'ƒ' },
        { id: 'ts-const', label: 'const', insertText: 'const ${1:name} = ${2:value}', type: 'snippet', detail: 'Constant declaration', confidence: 0.97, source: 'local', score: 22, icon: '𝒸' },
        { id: 'ts-interface', label: 'interface', insertText: 'interface ${1:Name} {\n\t${2:property}: ${3:type}\n}', type: 'snippet', detail: 'Interface definition', confidence: 0.91, source: 'local', score: 18, icon: '☐' },
        { id: 'ts-type', label: 'type', insertText: 'type ${1:Name} = ${2:type}', type: 'snippet', detail: 'Type alias', confidence: 0.90, source: 'local', score: 17, icon: 'T' },
        { id: 'ts-import', label: 'import', insertText: "import { ${1:module} } from '${2:package}'", type: 'snippet', detail: 'ES Module import', confidence: 0.96, source: 'local', score: 21, icon: '📦' },
        { id: 'ts-console', label: 'console.log', insertText: 'console.log($0)', type: 'snippet', detail: 'Console output', confidence: 0.98, source: 'local', score: 23, icon: '📝' },
        { id: 'ts-react', label: 'React Component', insertText: "const ${1:Component}: React.FC<${2:Props}> = ({ ${3:prop} }) => {\n\treturn (\n\t\t<div>\n\t\t\t$0\n\t\t</div>\n\t)\n}\n\nexport default ${1:Component}", type: 'snippet', detail: 'React functional component', confidence: 0.92, source: 'local', score: 19, icon: '⚛️' },
        { id: 'ts-useEffect', label: 'useEffect', insertText: 'useEffect(() => {\n\t$0\n\treturn () => {\n\t\t// cleanup\n\t}\n}, [${1:dependencies}])', type: 'snippet', detail: 'React useEffect hook', confidence: 0.94, source: 'local', score: 20, icon: '⚛️' },
        { id: 'ts-useState', label: 'useState', insertText: 'const [${1:state}, set${1:capitalize}] = useState<${2:type}>(${3:initialValue})', type: 'snippet', detail: 'React useState hook', confidence: 0.95, source: 'local', score: 21, icon: '⚛️' },
        { id: 'ts-try', label: 'try-catch', insertText: 'try {\n\t$0\n} catch (error) {\n\tconsole.error(error)\n}', type: 'snippet', detail: 'Error handling', confidence: 0.89, source: 'local', score: 16, icon: '⚠️' },
        { id: 'ts-class', label: 'class', insertText: 'class ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t$0\n\t}\n\n\t${3:method}() {}\n}', type: 'snippet', detail: 'Class definition', confidence: 0.88, source: 'local', score: 17, icon: '▣' },
        { id: 'ts-arrow', label: 'arrow function', insertText: '(${1:params}) => {\n\treturn $0\n}', type: 'snippet', detail: 'Arrow function', confidence: 0.93, source: 'local', score: 18, icon: '→' },
        { id: 'ts-forEach', label: '.forEach()', insertText: '.forEach((${1:item}) => {\n\t$0\n})', type: 'snippet', detail: 'Array forEach', confidence: 0.91, source: 'local', score: 18, icon: '🔄' },
        { id: 'ts-map', label: '.map()', insertText: '.map((${1:item}) => {\n\treturn $0\n})', type: 'snippet', detail: 'Array map', confidence: 0.92, source: 'local', score: 19, icon: '🗺️' },
        { id: 'ts-filter', label: '.filter()', insertText: '.filter((${1:item}) => {\n\treturn $0\n})', type: 'snippet', detail: 'Array filter', confidence: 0.90, source: 'local', score: 17, icon: '🔍' }
      ],
      python: [
        { id: 'py-def', label: 'def', insertText: 'def ${1:function_name}(${2:*args}, **kwargs):\n\t"""${3:docstring}"""\n\t$0', type: 'snippet', detail: 'Function definition', confidence: 0.96, source: 'local', score: 21, icon: 'ƒ' },
        { id: 'py-class', label: 'class', insertText: 'class ${1:ClassName}:\n\t"""${2:docstring}"""\n\tdef __init__(self, ${3:param}):\n\t\tself.${4:attr} = ${3:param}\n\t$0', type: 'snippet', detail: 'Class definition', confidence: 0.93, source: 'local', score: 19, icon: '▣' },
        { id: 'py-if', label: 'if', insertText: 'if ${1:condition}:\n\t$0', type: 'snippet', detail: 'If statement', confidence: 0.97, source: 'local', score: 22, icon: '🔀' },
        { id: 'py-for', label: 'for', insertText: 'for ${1:item} in ${2:iterable}:\n\t$0', type: 'snippet', detail: 'For loop', confidence: 0.95, source: 'local', score: 20, icon: '🔄' },
        { id: 'py-import', label: 'import', insertText: 'import ${1:module}', type: 'snippet', detail: 'Import module', confidence: 0.98, source: 'local', score: 23, icon: '📦' },
        { id: 'py-print', label: 'print', insertText: 'print($0)', type: 'snippet', detail: 'Print statement', confidence: 0.99, source: 'local', score: 24, icon: '📝' },
        { id: 'py-async', label: 'async def', insertText: 'async def ${1:function_name}(${2:*args}, **kwargs):\n\tresult = await ${3:coroutine()}\n\t$0\n\treturn result', type: 'snippet', detail: 'Async function', confidence: 0.90, source: 'local', score: 17, icon: 'ƒ' },
        { id: 'py-with', label: 'with', insertText: 'with ${1:context_manager} as ${2:variable}:\n\t$0', type: 'snippet', detail: 'Context manager', confidence: 0.91, source: 'local', score: 18, icon: '📂' },
        { id: 'py-lambda', label: 'lambda', insertText: 'lambda ${1:x}: ${2:expression}', type: 'snippet', detail: 'Lambda expression', confidence: 0.89, source: 'local', score: 16, icon: 'λ' },
        { id: 'py-try', label: 'try-except', insertText: 'try:\n\t$0\nexcept ${1:Exception} as ${2:e}:\n\tprint(f"Error: {e}")', type: 'snippet', detail: 'Exception handling', confidence: 0.88, source: 'local', score: 16, icon: '⚠️' }
      ],
      go: [
        { id: 'go-func', label: 'func', insertText: 'func ${1:functionName}(${2:param} ${3:type}) ${4:returnType} {\n\t$0\n}', type: 'snippet', detail: 'Function definition', confidence: 0.96, source: 'local', score: 21, icon: 'ƒ' },
        { id: 'go-if', label: 'if', insertText: 'if ${1:condition} {\n\t$0\n}', type: 'snippet', detail: 'If statement', confidence: 0.97, source: 'local', score: 22, icon: '🔀' },
        { id: 'go-for', label: 'for', insertText: 'for ${1:i} := 0; ${1:i} < ${2:count}; ${1:i}++ {\n\t$0\n}', type: 'snippet', detail: 'For loop', confidence: 0.94, source: 'local', score: 19, icon: '🔄' },
        { id: 'go-struct', label: 'struct', insertText: 'type ${1:StructName} struct {\n\t${2:Field} ${3:Type}\t\`json:"${2:field}"\`\n}', type: 'snippet', detail: 'Struct definition', confidence: 0.92, source: 'local', score: 18, icon: '▣' },
        { id: 'go-interface', label: 'interface', insertText: 'type ${1:InterfaceName} interface {\n\t${2:MethodName}(${3:params}) ${4:returnType}\n}', type: 'snippet', detail: 'Interface definition', confidence: 0.90, source: 'local', score: 17, icon: '☐' },
        { id: 'go-goroutine', label: 'go func', insertText: 'go func() {\n\t$0\n}()', type: 'snippet', detail: 'Goroutine', confidence: 0.89, source: 'local', score: 16, icon: '🏃' },
        { id: 'go-error', label: 'err check', insertText: '${1:result}, err := ${2:functionCall}()\nif err != nil {\n\treturn fmt.Errorf("${3:operation failed}: %w", err)\n}', type: 'snippet', detail: 'Error handling pattern', confidence: 0.93, source: 'local', score: 19, icon: '⚠️' },
        { id: 'go-defer', label: 'defer', insertText: 'defer ${1:resource}.Close()\n${2:// use resource}', type: 'snippet', detail: 'Defer cleanup', confidence: 0.91, source: 'local', score: 18, icon: '📌' }
      ],
      javascript: [
        { id: 'js-func', label: 'function', insertText: 'function ${1:name}(${2:params}) {\n\t$0\n}', type: 'snippet', detail: 'Function', confidence: 0.96, source: 'local', score: 21, icon: 'ƒ' },
        { id: 'js-const', label: 'const', insertText: 'const ${1:name} = ${2:value};', type: 'snippet', detail: 'Constant', confidence: 0.98, source: 'local', score: 23, icon: '𝒸' },
        { id: 'js-console', label: 'console.log', insertText: 'console.log($0);', type: 'snippet', detail: 'Console log', confidence: 0.99, source: 'local', score: 24, icon: '📝' },
        { id: 'js-await', label: 'async/await', insertText: 'async function ${1:name}() {\n\tconst result = await $0;\n\treturn result;\n}', type: 'snippet', detail: 'Async function', confidence: 0.93, source: 'local', score: 19, icon: 'ƒ' },
        { id: 'js-fetch', label: 'fetch', insertText: 'const response = await fetch(\'${1:url}\');\nconst data = await response.json();', type: 'snippet', detail: 'Fetch API', confidence: 0.91, source: 'local', score: 18, icon: '🌐' }
      ]
    };

    return snippets[language] || snippets.typescript || [];
  }

  private mapSymbolTypeToCompletionType(type: string): CompletionType {
    const mapping: Record<string, CompletionType> = {
      'function': 'function',
      'class': 'class',
      'variable': 'variable',
      'constant': 'variable',
      'interface': 'symbol',
      'type': 'symbol',
      'enum': 'symbol',
      'method': 'method',
      'property': 'variable'
    };
    return mapping[type] || 'symbol';
  }

  private getIconForType(type: string): string {
    const icons: Record<string, string> = {
      'function': 'ƒ',
      'class': '▣',
      'variable': 'x',
      'constant': '𝒸',
      'interface': '☐',
      'type': 'T',
      'enum': '∑',
      'method': 'm',
      'property': '•'
    };
    return icons[type] || '?';
  }
}

export const smartCompletionEngine = new SmartCompletionEngine();