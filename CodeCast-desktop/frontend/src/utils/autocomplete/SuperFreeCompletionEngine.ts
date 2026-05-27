import { FuzzyMatcher } from './FuzzyMatcher';

export interface CodeSnippet {
  id: string;
  prefix: string[];
  description: string;
  body: string;
  language: string | string[];
  category: 'function' | 'class' | 'control' | 'template' | 'utility' | 'pattern' | 'test' | 'config';
  tags: string[];
  documentation?: string;
  parameters?: SnippetParameter[];
}

interface SnippetParameter {
  name: string;
  defaultValue: string;
  prompt?: string;
}

class StorageEncryption {
  private static getDeviceKey(): string {
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ].join('|');

    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  static encrypt(data: string): string {
    try {
      const key = StorageEncryption.getDeviceKey();
      const timestamp = Date.now().toString(36);
      let encrypted = '';

      for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        encrypted += String.fromCharCode(charCode);
      }

      const base64 = btoa(encodeURIComponent(encrypted));
      return `${timestamp}:${base64}`;
    } catch {
      return btoa(encodeURIComponent(data));
    }
  }

  static decrypt(encoded: string): string {
    try {
      const parts = encoded.split(':');
      const base64 = parts.length > 1 ? parts.slice(1).join(':') : encoded;

      const decoded = decodeURIComponent(atob(base64));
      const key = StorageEncryption.getDeviceKey();
      let decrypted = '';

      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        decrypted += String.fromCharCode(charCode);
      }

      return decrypted;
    } catch {
      try {
        return decodeURIComponent(atob(encoded));
      } catch {
        return encoded;
      }
    }
  }
}

export class SuperFreeCompletionEngine {
  private snippets: Map<string, CodeSnippet[]> = new Map();
  private userSnippets: CodeSnippet[] = [];
  private usageStats: Map<string, number> = new Map();
  private contextCache: Map<string, CodeSnippet[]> = new Map();

  // Enhanced learning data structures
  private contextPreferences: Map<string, Map<string, number>> = new Map();
  private temporalStats: Map<string, Map<string, number>> = new Map();
  private recentUsageQueue: string[] = []; // Track last N usages for sequence detection

  constructor() {
    this.initializeBuiltinSnippets();
    this.loadUserSnippets();
    this.loadUsageStats();
    this.loadLearningData();
  }

  getCompletions(query: string, context?: {
    language?: string;
    filePath?: string;
    lineContent?: string;
    projectType?: string;
  }): CodeSnippet[] {
    if (!query) return this.getRecentSnippets(10);

    const results: CodeSnippet[] = [];

    // 1. Exact prefix match (highest priority)
    const exactMatches = this.getExactMatches(query);
    results.push(...exactMatches);

    // 2. Enhanced fuzzy match with usage stats
    const enhancedFuzzyResults = FuzzyMatcher.filterEnhanced(
      this.getAllSnippets(),
      query,
      snippet => snippet.prefix.join(' ') + ' ' + snippet.description + ' ' + snippet.id,
      this.usageStats
    ).map(result => result.item);

    // Deduplicate and merge
    const uniqueResults = this.deduplicate([...results, ...enhancedFuzzyResults]);

    // 3. Context-aware ranking
    if (context) {
      return this.rankByContext(uniqueResults, context);
    }

    // 4. Usage-based boosting
    return this.boostByUsage(uniqueResults).slice(0, 15);
  }

  getRecentSnippets(limit: number): CodeSnippet[] {
    const sorted = Array.from(this.usageStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.getSnippetById(id))
      .filter((s): s is CodeSnippet => s !== undefined);

    return sorted.length > 0 ? sorted : this.getAllSnippets().slice(0, limit);
  }

  getSnippetById(id: string): CodeSnippet | undefined {
    for (const snippets of this.snippets.values()) {
      const found = snippets.find(s => s.id === id);
      if (found) return found;
    }
    return this.userSnippets.find(s => s.id === id);
  }

  recordUsage(snippetId: string, context?: {
    language?: string;
    filePath?: string;
    projectType?: string;
  }): void {
    // Basic usage count
    const current = this.usageStats.get(snippetId) || 0;
    this.usageStats.set(snippetId, current + 1);

    // Context-aware learning
    if (context) {
      // Learn language preference
      if (context.language) {
        this.updateContextPreference('language', context.language, snippetId);
      }

      // Learn file path pattern
      if (context.filePath) {
        const ext = context.filePath.split('.').pop() || '';
        this.updateContextPreference('fileType', ext, snippetId);
      }

      // Learn project type preference
      if (context.projectType) {
        this.updateContextPreference('projectType', context.projectType, snippetId);
      }

      // Record time of usage for temporal patterns
      this.recordTemporalUsage(snippetId);
    }

    // Persist all learning data
    this.persistUsageStats();
    this.persistLearningData();
  }

  private updateContextPreference(contextType: string, contextValue: string, snippetId: string): void {
    const key = `${contextType}:${contextValue}`;
    
    if (!this.contextPreferences.has(key)) {
      this.contextPreferences.set(key, new Map<string, number>());
    }
    
    const prefMap = this.contextPreferences.get(key)!;
    const current = prefMap.get(snippetId) || 0;
    prefMap.set(snippetId, current + 1);
  }

  private recordTemporalUsage(snippetId: string): void {
    const now = new Date();
    const hourKey = `hour:${now.getHours()}`;
    const dayKey = `day:${now.getDay()}`;

    if (!this.temporalStats.has(hourKey)) {
      this.temporalStats.set(hourKey, new Map<string, number>());
    }
    
    const hourMap = this.temporalStats.get(hourKey)!;
    hourMap.set(snippetId, (hourMap.get(snippetId) || 0) + 1);

    if (!this.temporalStats.has(dayKey)) {
      this.temporalStats.set(dayKey, new Map<string, number>());
    }
    
    const dayMap = this.temporalStats.get(dayKey)!;
    dayMap.set(snippetId, (dayMap.get(snippetId) || 0) + 1);
  }

  getContextualRecommendations(context: {
    language?: string;
    filePath?: string;
    projectType?: string;
  }, limit: number = 5): CodeSnippet[] {
    const scores: Map<string, number> = new Map();

    // Aggregate scores from different contexts
    if (context.language) {
      this.addContextScores(scores, 'language', context.language);
    }

    if (context.filePath) {
      const ext = context.filePath.split('.').pop() || '';
      this.addContextScores(scores, 'fileType', ext);
    }

    if (context.projectType) {
      this.addContextScores(scores, 'projectType', context.projectType);
    }

    // Add temporal boost
    const now = new Date();
    const hourKey = `hour:${now.getHours()}`;
    const dayKey = `day:${now.getDay()}`;

    this.addTemporalScores(scores, hourKey, 2.0); // Higher weight for hourly patterns
    this.addTemporalScores(scores, dayKey, 1.0); // Lower weight for daily patterns

    // Sort and return top recommendations
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.getSnippetById(id))
      .filter((s): s is CodeSnippet => s !== undefined);

    return sorted.length > 0 ? sorted : this.getRecentSnippets(limit);
  }

  private addContextScores(scores: Map<string, number>, contextType: string, contextValue: string): void {
    const key = `${contextType}:${contextValue}`;
    const prefs = this.contextPreferences.get(key);
    
    if (prefs) {
      prefs.forEach((count, snippetId) => {
        const current = scores.get(snippetId) || 0;
        scores.set(snippetId, current + count * 1.5);
      });
    }
  }

  private addTemporalScores(scores: Map<string, number>, temporalKey: string, weight: number): void {
    const stats = this.temporalStats.get(temporalKey);
    
    if (stats) {
      stats.forEach((count, snippetId) => {
        const current = scores.get(snippetId) || 0;
        scores.set(snippetId, current + count * weight);
      });
    }
  }

  addUserSnippet(snippet: CodeSnippet): void {
    this.userSnippets.push(snippet);
    this.saveUserSnippets();
  }

  removeUserSnippet(id: string): boolean {
    const index = this.userSnippets.findIndex(s => s.id === id);
    if (index !== -1) {
      this.userSnippets.splice(index, 1);
      this.saveUserSnippets();
      return true;
    }
    return false;
  }

  // ==================== Private Methods ====================

  private initializeBuiltinSnippets(): void {
    
    // ==================== JAVASCRIPT / TYPESCRIPT ====================
    
    this.addCategory('javascript', [
      // Functions
      { id: 'js-function', prefix: ['func', 'fn', 'function'], description: 'Function declaration', body: `function \${1:name}(\${2:params}) {\n\t\${3:// implementation}\n}`, language: ['javascript', 'typescript'], category: 'function', tags: ['basic', 'common'] },
      { id: 'js-arrow-function', prefix: ['arrow', '=>', 'af'], description: 'Arrow function', body: `const \${1:name} = (\${2:params}) => {\n\t\${3:// body}\n};`, language: ['javascript', 'typescript'], category: 'function', tags: ['es6', 'modern'] },
      { id: 'js-async-function', prefix: ['async', 'async-func'], description: 'Async function with error handling', body: `async function \${1:name}(\${2:params}) {\n\ttry {\n\t\tconst result = await \${3:promise};\n\t\treturn result;\n\t} catch (error) {\n\t\tconsole.error('\${1:name} failed:', error);\n\t\tthrow error;\n\t}\n}`, language: ['javascript', 'typescript'], category: 'function', tags: ['async', 'error-handling'] },
      { id: 'js-iife', prefix: ['iife'], description: 'IIFE pattern', body: `(function() {\n\t'use strict';\n\t\${1:// code}\n})();`, language: ['javascript'], category: 'pattern', tags: ['iife', 'scope'] },
      { id: 'js-debounce', prefix: ['debounce'], description: 'Debounce function', body: `function debounce(func, wait) {\n\tlet timeout;\n\treturn function executedFunction(...args) {\n\t\tconst later = () => {\n\t\t\tclearTimeout(timeout);\n\t\t\tfunc(...args);\n\t\t};\n\t\tclearTimeout(timeout);\n\t\ttimeout = setTimeout(later, wait);\n\t};\n}`, language: ['javascript', 'typescript'], category: 'utility', tags: ['performance'] },
      { id: 'js-throttle', prefix: ['throttle'], description: 'Throttle function', body: `function throttle(func, limit) {\n\tlet inThrottle;\n\treturn function(...args) {\n\t\tif (!inThrottle) {\n\t\t\tfunc.apply(this, args);\n\t\t\tinThrottle = true;\n\t\t\tsetTimeout(() => inThrottle = false, limit);\n\t\t}\n\t};\n}`, language: ['javascript', 'typescript'], category: 'utility', tags: ['performance'] },

      // Control Flow
      { id: 'js-if-else', prefix: ['if', 'ifelse'], description: 'If-Else statement', body: `if (\${1:condition}) {\n\t\${2:true}\n} else {\n\t\${3:false}\n}`, language: ['javascript', 'typescript'], category: 'control', tags: ['basic'] },
      { id: 'js-switch', prefix: ['switch', 'case'], description: 'Switch statement', body: `switch (\${1:expr}) {\n\tcase \${2:value}:\n\t\t\${3:code}\n\t\tbreak;\n\tdefault:\n\t\t\${4:default}\n}`, language: ['javascript', 'typescript'], category: 'control', tags: [] },
      { id: 'js-for-loop', prefix: ['for', 'forloop'], description: 'For loop', body: `for (let \${1:i} = 0; \${1:i} < \${2:arr}.length; \${1:i}++) {\n\tconst \${3:item} = \${2:arr}[\${1:i}];\n\t\${4:code}\n}`, language: ['javascript', 'typescript'], category: 'control', tags: ['loop'] },
      { id: 'js-for-each', prefix: ['foreach', '.forEach'], description: 'ForEach iteration', body: `\${1:arr}.forEach((\${2:item}, \${3:index}) => {\n\t\${4:code}\n});`, language: ['javascript', 'typescript'], category: 'control', tags: ['array'] },
      { id: 'js-for-of', prefix: ['forof', 'for-of'], description: 'For...of loop', body: `for (const \${1:item} of \${2:iterable}) {\n\t\${3:code}\n}`, language: ['javascript', 'typescript'], category: 'control', tags: ['es6'] },

      // Array Methods
      { id: 'js-map', prefix: ['map', '.map'], description: 'Array.map transformation', body: `\${1:arr}.map((\${2:item}, \${3:i}) => {\n\treturn \${4:transformed};\n});`, language: ['javascript', 'typescript'], category: 'utility', tags: ['array', 'functional'] },
      { id: 'js-filter', prefix: ['filter', '.filter'], description: 'Array.filter filtering', body: `\${1:arr}.filter((\${2:item}) => {\n\treturn \${3:condition};\n});`, language: ['javascript', 'typescript'], category: 'utility', tags: ['array'] },
      { id: 'js-reduce', prefix: ['reduce', '.reduce'], description: 'Array.reduce accumulation', body: `\${1:arr}.reduce((\${2:acc}, \${3:item}) => {\n\treturn \${4:accumulator};\n}, \${5:init});`, language: ['javascript', 'typescript'], category: 'utility', tags: ['array'] },
      { id: 'js-find', prefix: ['find', '.find'], description: 'Array.find search', body: `\${1:arr}.find((\${2:item}) => \${3:condition});`, language: ['javascript', 'typescript'], category: 'utility', tags: ['array'] },
      { id: 'js-sort', prefix: ['sort', '.sort'], description: 'Array.sort custom comparator', body: `\${1:arr}.sort((\${2:a}, \${3:b}) => {\n\tif (\${2:a}.\${4:key} < \${3:b}.\${4:key}) return -1;\n\tif (\${2:a}.\${4:key} > \${3:b}.\${4:key}) return 1;\n\treturn 0;\n});`, language: ['javascript', 'typescript'], category: 'utility', tags: ['array', 'sorting'] },

      // Classes & Patterns
      { id: 'js-class', prefix: ['class', 'cls'], description: 'ES6 Class definition', body: `class \${1:ClassName} {\n\tconstructor(\${2:params}) {\n\t\tthis.\${3:prop} = \${3:prop};\n\t}\n\n\t\${4:method}() {\n\t\t\${5:impl}\n\t}\n}`, language: ['javascript', 'typescript'], category: 'class', tags: ['es6', 'oop'] },
      { id: 'js-singleton', prefix: ['singleton'], description: 'Singleton pattern', body: `class \${1:Singleton} {\n\tstatic #instance = null;\n\n\tstatic getInstance() {\n\t\tif (!\${1:Singleton}.#instance) {\n\t\t\t\${1:Singleton}.#instance = new \${1:Singleton}();\n\t\t}\n\t\treturn \${1:Singleton}.#instance;\n\t}\n}`, language: ['javascript', 'typescript'], category: 'pattern', tags: ['design-pattern'] },
      { id: 'js-observer', prefix: ['observer', 'pubsub'], description: 'EventEmitter / PubSub', body: `class EventEmitter {\n\t#listeners = {};\n\n\ton(event, callback) {\n\t\tif (!this.#listeners[event]) this.#listeners[event] = [];\n\t\tthis.#listeners[event].push(callback);\n\t\treturn () => this.off(event, callback);\n\t}\n\n\temit(event, ...args) {\n\t\t(this.#listeners[event] || []).forEach(cb => cb(...args));\n\t}\n}`, language: ['javascript', 'typescript'], category: 'pattern', tags: ['events'] },

      // Async Patterns
      { id: 'js-promise-all', prefix: ['promise-all', 'Promise.all'], description: 'Parallel promises', body: `try {\n\tconst [\${2:r1}, \${3:r2}] = await Promise.all([\n\t\t\${1:promise1},\n\t\t\${4:promise2}\n\t]);\n} catch (error) {\n\tconsole.error('Failed:', error);\n}`, language: ['javascript', 'typescript'], category: 'pattern', tags: ['promise', 'parallel'] },
      { id: 'js-retry', prefix: ['retry', 'retry-promise'], description: 'Retry with exponential backoff', body: `async function retry(fn, retries = 3, delay = 1000) {\n\tfor (let i = 0; i < retries; i++) {\n\t\ttry { return await fn(); }\n\t\tcatch (error) {\n\t\t\tif (i === retries - 1) throw error;\n\t\t\tawait new Promise(r => setTimeout(r, delay * Math.pow(2, i)));\n\t\t}\n\t}\n}`, language: ['javascript', 'typescript'], category: 'pattern', tags: ['retry', 'resilience'] },

      // Error Handling
      { id: 'js-try-catch', prefix: ['try', 'trycatch'], description: 'Try-Catch error handling', body: `try {\n\t\${1:dangerousOperation}();\n} catch (error) {\n\tconsole.error('\${2:op} failed:', error);\n} finally {\n\t\${3:cleanup}();\n}`, language: ['javascript', 'typescript'], category: 'control', tags: ['error-handling'] },
      { id: 'js-custom-error', prefix: ['custom-error'], description: 'Custom Error class', body: `class \${1:ErrorName} extends Error {\n\tconstructor(message, \${2:code}) {\n\t\tsuper(message);\n\t\tthis.name = '\${1:ErrorName}';\n\t\tthis.code = \${2:code};\n\t}\n}`, language: ['javascript', 'typescript'], category: 'class', tags: ['error'] },

      // Utilities
      { id: 'js-fetch-api', prefix: ['fetch', 'api-call'], description: 'Fetch API wrapper', body: `async function apiCall(url, options = {}) {\n\ttry {\n\t\tconst response = await fetch(url, {\n\t\t\theaders: { 'Content-Type': 'application/json', ...options.headers },\n\t\t\t...options\n\t\t});\n\t\tif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\n\t\treturn await response.json();\n\t} catch (error) {\n\t\tconsole.error('API call failed:', error);\n\t\tthrow error;\n\t}\n}`, language: ['javascript', 'typescript'], category: 'utility', tags: ['api', 'http'] },
      { id: 'js-local-storage', prefix: ['localStorage', 'storage'], description: 'LocalStorage helper', body: `const storage = {\n\tget(key, def = null) { try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : def; } catch { return def; } },\n\tset(key, value) { localStorage.setItem(key, JSON.stringify(value)); },\n\tremove(key) { localStorage.removeItem(key); }\n};`, language: ['javascript', 'typescript'], category: 'utility', tags: ['storage'] },
      { id: 'js-deep-clone', prefix: ['clone', 'deepClone'], description: 'Deep clone object', body: `function deepClone(obj) {\n\tif (obj === null || typeof obj !== 'object') return obj;\n\tif (obj instanceof Date) return new Date(obj.getTime());\n\tif (obj instanceof Array) return obj.map(item => deepClone(item));\n\tconst clone = {};\n\tfor (const key in obj) if (obj.hasOwnProperty(key)) clone[key] = deepClone(obj[key]);\n\treturn clone;\n}`, language: ['javascript', 'typescript'], category: 'utility', tags: ['clone', 'object'] },
      { id: 'js-debounce-input', prefix: ['search-input'], description: 'Debounced search input', body: `const [query, setQuery] = useState('');\nconst [results, setResults] = useState([]);\nconst debounced = useDebouncedValue(query, 300);\nuseEffect(() => {\n\tif (debounced.trim()) searchAPI(debounced).then(setResults);\n\telse setResults([]);\n}, [debounced]);`, language: ['tsx', 'jsx'], category: 'pattern', tags: ['react', 'search'] },
      { id: 'js-memoize', prefix: ['memoize', 'cache'], description: 'Memoization cache', body: `function memoize(fn) {\n\tconst cache = new Map();\n\treturn (...args) => {\n\t\tconst key = JSON.stringify(args);\n\t\tif (cache.has(key)) return cache.get(key);\n\t\tconst result = fn(...args);\n\t\tcache.set(key, result);\n\t\treturn result;\n\t};\n}`, language: ['javascript', 'typescript'], category: 'utility', tags: ['caching', 'performance'] },
      { id: 'js-group-by', prefix: ['groupBy'], description: 'Group array by key', body: `function groupBy(arr, key) {\n\treturn arr.reduce((groups, item) => {\n\t\tconst group = typeof key === 'function' ? key(item) : item[key];\n\t\t(groups[group] = groups[group] || []).push(item);\n\t\treturn groups;\n\t}, {});\n}`, language: ['javascript', 'typescript'], category: 'utility', tags: ['array'] },
      { id: 'js-sleep', prefix: ['sleep', 'delay'], description: 'Sleep/delay function', body: `function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }\n// await sleep(1000);`, language: ['javascript', 'typescript'], category: 'utility', tags: ['async'] },

      // TypeScript Specific
      { id: 'ts-interface', prefix: ['interface', 'iface'], description: 'TypeScript interface', body: `interface \${1:Name} {\n\t\${2:prop}: \${3:type};\n\t\${4:optional}?: \${5:type};\n}`, language: ['typescript'], category: 'template', tags: ['typescript'] },
      { id: 'ts-generic', prefix: ['generic', '<T>'], description: 'Generic function', body: `function \${1:fn}<T, U>(p1: T, p2: U): \${2:Ret} { \${3:impl} }`, language: ['typescript'], category: 'template', tags: ['typescript', 'generics'] },
      { id: 'ts-partial', prefix: ['Partial'], description: 'Partial type for updates', body: `function update(id: string, data: Partial<\${1:Type}>): \${1:Type} {\n\tconst existing = get(id);\n\treturn { ...existing, ...data };\n}`, language: ['typescript'], category: 'template', tags: ['typescript'] },
      { id: 'ts-record', prefix: ['Record'], description: 'Record type (dictionary)', body: `type \${1:Dict} = Record<string, \${2:Value}>;`, language: ['typescript'], category: 'template', tags: ['typescript'] },

      // Logging & Debugging
      { id: 'js-logger', prefix: ['logger', 'log'], description: 'Advanced logger', body: `const logger = {\n\tinfo: (...a) => console.log('[INFO]', new Date().toISOString(), ...a),\n\twarn: (...a) => console.warn('[WARN]', new Date().toISOString(), ...a),\n\terror: (...a) => console.error('[ERR ]', new Date().toISOString(), ...a)\n};`, language: ['javascript', 'typescript'], category: 'utility', tags: ['logging'] },
      { id: 'js-perf-timer', prefix: ['timer', 'perf'], description: 'Performance timer', body: `function measure(label, fn) {\n\tconsole.time(label);\n\tconst r = fn();\n\tconsole.timeEnd(label);\n\treturn r;\n}`, language: ['javascript', 'typescript'], category: 'utility', tags: ['performance'] }
    ]);

    // ==================== REACT ====================
    
    this.addCategory('react', [
      { id: 'react-component', prefix: ['react', 'component', 'fc'], description: 'Functional component with TS', body: `import React from 'react';\n\ninterface \${1:Comp}Props {\n\t\${2:prop}: \${3:string};\n}\n\nconst \${1:Comp}: React.FC<\${1:Comp}Props> = ({ \${2:prop} }) => (\n\t<div className="\${1:comp}">{\${2:prop}}</div>\n);\n\nexport default \${1:Comp};`, language: ['tsx', 'jsx'], category: 'template', tags: ['react', 'component'] },
      { id: 'react-state', prefix: ['useState', 'state'], description: 'useState hook', body: `const [\${1:state}, set\${1:state.charAt(0).toUpperCase() + \${1:state.slice(1)}] = useState<\${2:type}>(\${3:init});`, language: ['tsx', 'jsx'], category: 'template', tags: ['react', 'hooks'] },
      { id: 'react-effect', prefix: ['useEffect', 'effect'], description: 'useEffect with cleanup', body: `useEffect(() => {\n\t\${1:side effect}\n\treturn () => { \${2:cleanup} };\n}, [\${3:deps}]);`, language: ['tsx', 'jsx'], category: 'template', tags: ['react', 'hooks'] },
      { id: 'react-context', prefix: ['context', 'createContext'], description: 'React Context + Provider', body: `import React, { createContext, useContext, useState } from 'react';\n\nconst \${1:Ctx} = createContext<{\${2:state}: any} | undefined>(undefined);\nexport function \${1:Ctx}Provider({ children }: { children: React.ReactNode }) {\n\tconst [\${2:state}, set\${2:state}] = useState(\${3:init});\n\treturn <\${1:Ctx}.Provider value={{ \${2:state}, set\${2:state} }}>{children}</\${1:Ctx}.Provider>;\n}\nexport const use\${1:Ctx} = () => {\n\tconst ctx = useContext(\${1:Ctx});\n\tif (!ctx) throw new Error('use\${1:Ctx} must be within Provider');\n\treturn ctx;\n};`, language: ['tsx', 'jsx'], category: 'pattern', tags: ['react', 'context', 'state'] },
      { id: 'react-custom-hook', prefix: ['customHook', 'useHook'], description: 'Custom hook template', body: `function use\${1:Hook}(\${2:param}: \${3:type}) {\n\tconst [\${4:state}, set\${4:state}] = useState<\${5:ret}>(\${6:init});\n\tuseEffect(() => { \${7:async logic} }, [\${2:param}]);\n\treturn { \${4:state} };\n}`, language: ['tsx', 'jsx'], category: 'template', tags: ['react', 'hooks'] },
      { id: 'react-form', prefix: ['form', 'controlled-form'], description: 'Controlled form', body: `const [form, setForm] = useState<Record<string, string>>({});\nconst handleChange = (e: React.ChangeEvent<HTMLInputElement>) => \n\tsetForm(p => ({ ...p, [e.target.name]: e.target.value }));\nconst handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await submit(form); };`, language: ['tsx', 'jsx'], category: 'pattern', tags: ['react', 'form'] },
      { id: 'react-table', prefix: ['table', 'data-table'], description: 'Generic table component', body: `function Table<T>({ columns, data }: { columns: {key: keyof T; header: string; render?: (v: any) => React.ReactNode}[]; data: T[] }) {\n\treturn (\n\t\t<table><thead><tr>{columns.map(c => <th key={String(c.key)}>{c.header}</th>)}</tr></thead>\n\t\t<tbody>{data.map((row, i) => <tr key={i}>{columns.map(c => <td key={String(c.key)}>{c.render ? c.render(row[c.key]) : row[c.key]}</td>)}</tr>)}</tbody></table>\n\t);\n}`, language: ['tsx', 'jsx'], category: 'template', tags: ['react', 'table', 'generic'] },
      { id: 'react-modal', prefix: ['modal', 'dialog'], description: 'Modal/Dialog component', body: `function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {\n\tuseEffect(() => {\n\t\tconst h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };\n\t\tif (isOpen) document.addEventListener('keydown', h);\n\t\treturn () => document.removeEventListener('keydown', h);\n\t}, [isOpen, onClose]);\n\tif (!isOpen) return null;\n\treturn (<div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}>\n\t\t<div className="modal-header"><h2>{title}</h2><button onClick={onClose}>×</button></div>\n\t\t<div className="modal-body">{children}</div></div></div>);\n}`, language: ['tsx', 'jsx'], category: 'template', tags: ['react', 'modal'] },
      { id: 'react-infinite-scroll', prefix: ['infinite-scroll'], description: 'Infinite scroll with IntersectionObserver', body: `const [items, setItems] = useState<\${1:T}[]>([]);\nconst [page, setPage] = useState(1);\nconst loaderRef = useRef<HTMLDivElement>(null);\nuseEffect(() => {\n\tconst obs = new IntersectionObserver(async (entries) => {\n\t\tif (entries[0].isIntersecting) {\n\t\t\tconst newItems = await fetchPage(page);\n\t\t\tsetItems(prev => [...prev, ...newItems]);\n\t\t\tsetPage(p => p + 1);\n\t\t}\n\t});\n\tif (loaderRef.current) obs.observe(loaderRef.current);\n\treturn () => obs.disconnect();\n}, [page]);\n// ...render items...\n<div ref={loaderRef} />`, language: ['tsx', 'jsx'], category: 'pattern', tags: ['react', 'infinite-scroll'] },
      { id: 'react-error-boundary', prefix: ['ErrorBoundary'], description: 'Error boundary class', body: `class ErrorBoundary extends React.Component<{fallback?: React.ReactNode; children: React.ReactNode}, {hasError: boolean; error: Error | null}> {\n\tconstructor(props) { super(props); this.state = { hasError: false, error: null }; }\n\tstatic getDerivedStateFromError(error: Error) { return { hasError: true, error }; }\n\tcomponentDidCatch(error: Error, info: React.ErrorInfo) { console.error('ErrorBoundary:', error, info); }\n\trender() { return this.state.hasError ? (this.props.fallback || <div>Error</div>) : this.props.children; }\n}`, language: ['tsx', 'jsx'], category: 'pattern', tags: ['react', 'error'] },
      { id: 'react-lazy', prefix: ['lazy', 'Suspense'], description: 'Lazy loading with Suspense', body: `const \${1:Heavy} = React.lazy(() => import('./\${1:Heavy}'));\nfunction App() {\n\treturn <React.Suspense fallback={<div>Loading...</div>}><\${1:Heavy} /></React.Suspense>;\n}`, language: ['tsx', 'jsx'], category: 'pattern', tags: ['react', 'lazy-loading', 'performance'] }
    ]);

    // ==================== PYTHON ====================
    
    this.addCategory('python', [
      { id: 'py-function', prefix: ['def', 'func'], description: 'Function with docstring', body: `def \${1:func_name}(\${2:param1}: \${3:type}, \${4:param2}: \${5:type} = None) -> \${6:return_type}:\n\t"""\${7:Description}.\n\n\tArgs:\n\t\t\${2:param1}: Desc.\n\t\t\${4:param2}: Desc.\n\n\tReturns:\n\t\tDesc.\n\t"""\n\t\${8:# impl}\n\treturn \${9:result}`, language: ['python'], category: 'function', tags: ['basic', 'docstring'] },
      { id: 'py-async-func', prefix: ['async def'], description: 'Async function', body: `async def \${1:name}(\${2:params}) -> \${3:ret}:\n\t"""\${4:Desc}."""\n\ttry:\n\t\tresult = await \${5:coroutine}()\n\t\treturn result\n\texcept Exception as e:\n\t\tlogger.error(f"\${1:name} failed: {e}")\n\t\traise`, language: ['python'], category: 'function', tags: ['async'] },
      { id: 'py-class', prefix: ['class', 'cls'], description: 'Class with methods', body: `class \${1:ClassName}:\n\t"""\${2:Desc}."""\n\n\tdef __init__(self, \${3:p1}: \${4:t1}, \${5:p2}: \${6:t2} = None):\n\t\tself.\${3:p1} = \${3:p1}\n\t\tself.\${5:p2} = \${5:p2}\n\n\tdef \${7:method}(self, \${8:param}: \${9:t10}) -> \${11:ret}:\n\t\t"""Method desc."""\n\t\tpass\n\n\t@property\n\tdef computed(self) -> \${12:t13}:\n\t\treturn self._compute()\n\n\tdef __repr__(self) -> str:\n\t\treturn f"\${1:ClassName}(\${3:p1}={self.\${3:p1}!r})"`, language: ['python'], category: 'class', tags: ['oop'] },
      { id: 'py-dataclass', prefix: ['dataclass', '@dataclass'], description: 'Dataclass model', body: `from dataclasses import dataclass, field, asdict\nfrom typing import Optional\nfrom datetime import datetime\n\n@dataclass\nclass \${1:Model}:\n\t"""\${2:Desc}."""\n\tid: int\n\tname: str\n\temail: Optional[str] = None\n\tcreated_at: datetime = field(default_factory=datetime.utcnow)\n\n\tdef to_dict(self) -> dict:\n\t\treturn asdict(self)\n\n\t@classmethod\n\tdef from_dict(cls, data: dict) -> "\${1:Model}":\n\t\treturn cls(**data)`, language: ['python'], category: 'class', tags: ['dataclass', 'model'] },
      { id: 'py-context-manager', prefix: ['with', '@contextmanager'], description: 'Context manager', body: `from contextlib import contextmanager\n\n@contextmanager\ndef \${1:resource_mgr}(\${2:param}: \${3:t4}):\n\t"""Resource management."""\n\tresource = \${5:acquire}(\${2:param})\n\ttry:\n\t\tyield resource\n\tfinally:\n\t\t\${6:cleanup}(resource)`, language: ['python'], category: 'pattern', tags: ['context-manager'] },
      { id: 'py-decorator', prefix: ['decorator', '@decorator'], description: 'Decorator with args', body: `import functools\n\ndef \${1:dec}(\${2:arg}: \${3:t4} = None):\n\t"""Decorator desc."""\n\tdef decorator(func):\n\t\t@functools.wraps(func)\n\t\tdef wrapper(*args, **kwargs):\n\t\t\t\${5:before}\n\t\t\tresult = func(*args, **kwargs)\n\t\t\t\${6:after}\n\t\t\treturn result\n\t\treturn wrapper\n\treturn decorator`, language: ['python'], category: 'pattern', tags: ['decorator'] },
      { id: 'py-generator', prefix: ['generator', 'yield'], description: 'Generator (memory efficient)', body: `def \${1:batch_proc}(items: Iterable[\${2:T}], batch_size: int = \${3:1000}) -> Iterator[List[\${2:T}]]:\n\t"""Process in batches."""\n\tbatch: List[\${2:T}] = []\n\tfor item in items:\n\t\tbatch.append(item)\n\t\tif len(batch) >= batch_size:\n\t\t\tyield batch\n\t\t\tbatch = []\n\tif batch:\n\t\tyield batch`, language: ['python'], category: 'pattern', tags: ['generator', 'memory'] },
      { id: 'py-logging', prefix: ['logging', 'logger'], description: 'Logging config', body: `import logging\nimport sys\n\nlogging.basicConfig(\n\tlevel=logging.INFO,\n\tformat='%(asctime)s - %(name)s - %(levelname)s - %(message)s',\n\thandlers=[logging.StreamHandler(sys.stdout), logging.FileHandler('app.log')]\n)\nlogger = logging.getLogger(__name__)`, language: ['python'], category: 'config', tags: ['logging'] },
      { id: 'py-fastapi', prefix: ['fastapi', '@app.get'], description: 'FastAPI endpoint', body: `from fastapi import APIRouter, HTTPException, Query, Path\nfrom pydantic import BaseModel\n\nrouter = APIRouter(prefix="/\${1:resource}", tags=["\${1:resource}s"])\n\nclass \${2:Create}(BaseModel):\n\tname: str\n\tdesc: Optional[str] = None\n\n@router.post("/", status_code=201)\nasync def create(body: \${2:Create}):\n\treturn await service.create(body.dict())\n\n@router.get("/{id}")\nasync def get(id: int = Path(..., ge=1)):\n\tobj = await service.get_by_id(id)\n\tif not obj: raise HTTPException(404, "Not found")\n\treturn obj`, language: ['python'], category: 'template', tags: ['fastapi', 'api', 'rest'] },
      { id: 'py-unittest', prefix: ['unittest', 'test-case'], description: 'Unit test with fixtures', body: `import unittest\nfrom unittest.mock import Mock, patch\n\nclass Test\${1:Class}(unittest.TestCase):\n\tdef setUp(self):\n\t\tself.\${2:inst} = \${1:Class}(\${3:params})\n\n\tdef test_\${4:method}_success(self):\n\t\tresult = self.\${2:inst}.\${4:method}(\${5:input})\n\t\tself.assertEqual(result, \${6:expected})\n\n\tdef test_\${4:method}_error(self):\n\t\twith self.assertRaises(\${7:Exc}):\n\t\t\tself.\${2:inst}.\${4:method}(\${8:bad_input})\n\n\t@patch("\${9:module.dep}")\n\tdef test_\${4:method}_mocked(self, mock_dep):\n\t\tmock_dep.return_value = \${10:val}\n\t\tresult = self.\${2:inst.\${4:method}()\n\t\tmock_dep.assert_called_once_with(\${11:args})\n\nif __name__ == '__main__':\n\tunittest.main()`, language: ['python'], category: 'test', tags: ['testing', 'unittest'] },
      { id: 'py-file-io', prefix: ['file-read', 'open'], description: 'Safe file I/O', body: `from pathlib import Path\n\ndef read_file(path: Union[str, Path], encoding='utf-8') -> str:\n\tp = Path(path)\n\tif not p.exists(): raise FileNotFoundError(str(p))\n\treturn p.read_text(encoding=encoding)\n\ndef write_file(path: Union[str, Path], content: str, encoding='utf-8') -> None:\n\tp = Path(path)\n\tp.parent.mkdir(parents=True, exist_ok=True)\n\tp.write_text(content, encoding=encoding)`, language: ['python'], category: 'utility', tags: ['file-io'] },
      { id: 'py-cache', prefix: ['lru_cache', '@lru_cache'], description: 'LRU cache decorator', body: `from functools import lru_cache\n\n@lru_cache(maxsize=\${1:128})\ndef \${2:expensive}(\${3:param}: \${4:t5}) -> \${6:ret}:\n\t"""Cached computation."""\n\treturn \${7:compute}(\${3:param})`, language: ['python'], category: 'utility', tags: ['caching', 'performance'] },
      { id: 'py-retry', prefix: ['retry', '@retry'], description: 'Retry decorator', body: `import time\nimport functools\nfrom typing import Type, Tuple\n\ndef retry(max_retries=\${1:3}, delay=\${2:1.0}, exceptions: Tuple[Type[Exception], ...] = (Exception,), backoff=True):\n\tdef decorator(func):\n\t\t@functools.wraps(func)\n\t\tdef wrapper(*args, **kwargs):\n\t\t\tlast_exc = None\n\t\t\td = delay\n\t\t\tfor attempt in range(max_retries):\n\t\t\t\ttry: return func(*args, **kwargs)\n\t\t\t\texcept exceptions as e:\n\t\t\t\t\tlast_exc = e\n\t\t\t\t\tif attempt < max_retries - 1:\n\t\t\t\t\t\ttime.sleep(d)\n\t\t\t\t\t\tif backoff: d *= 2\n\t\t\traise last_exc\n\t\treturn wrapper\n\treturn decorator`, language: ['python'], category: 'pattern', tags: ['retry', 'resilience'] }
    ]);

    // ==================== GO ====================
    
    this.addCategory('go', [
      { id: 'go-main', prefix: ['main', 'package main'], description: 'Main package', body: `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}`, language: ['go'], category: 'template', tags: ['basic'] },
      { id: 'go-func', prefix: ['func'], description: 'Function with error return', body: `func \${1:FuncName}(\${2:p1} \${3:t1}, \${4:p2} \${5:t2}) (\${6:ret}, error) {\n\t\${7:impl}\n\treturn \${8:result}, nil\n}`, language: ['go'], category: 'function', tags: ['basic'] },
      { id: 'go-interface', prefix: ['interface'], description: 'Interface definition', body: `type \${1:Interface} interface {\n\t\${2:Method}(\${3:params}) \${4:ret}\n\t\${5:Other}() error\n}`, language: ['go'], category: 'template', tags: ['interface'] },
      { id: 'go-struct', prefix: ['struct'], description: 'Struct with JSON tags', body: `type \${1:Struct} struct {\n\tID        int       \`json:"id"\`\n\tName      string    \`json:"name"\`\n\tCreatedAt time.Time \`json:"created_at"\`\n}\n\nfunc New\${1:Struct}(name string) *\${1:Struct} {\n\treturn &\${1:Struct}{Name: name, CreatedAt: time.Now()}\n}\n\nfunc (s *\${1:Struct}) Validate() error {\n\tif s.Name == "" { return errors.New("name required") }\n\treturn nil\n}`, language: ['go'], category: 'class', tags: ['struct', 'json'] },
      { id: 'go-http-handler', prefix: ['http.HandlerFunc', 'handler'], description: 'HTTP handler', body: `func (h *Handler) \${1:Handle}(w http.ResponseWriter, r *http.Request) {\n\tvar req \${2:ReqStruct}\n\tif err := json.NewDecoder(r.Body).Decode(&req); err != nil {\n\t\thttp.Error(w, "bad request", 400)\n\t\treturn\n\t}\n\tresult, err := h.svc.\${3:Do}(r.Context(), req)\n\tif err != nil {\n\t\tif errors.Is(err, ErrNotFound) {\n\t\t\thttp.Error(w, "not found", 404)\n\t\t\treturn\n\t\t}\n\t\thttp.Error(w, "internal", 500)\n\t\treturn\n\t}\n\tw.Header().Set("Content-Type", "application/json")\n\tjson.NewEncoder(w).Encode(result)\n}`, language: ['go'], category: 'template', tags: ['http', 'handler'] },
      { id: 'go-worker-pool', prefix: ['worker-pool'], description: 'Worker pool pattern', body: `func ProcessWithPool(items []\${1:Item}, workers int) ([]\${2:Result}, error) {\n\tjobs := make(chan \${1:Item}, len(items))\n\tresults := make(chan \${2:Result}, len(items))\n\terrCh := make(chan error, 1)\n\n\tvar wg sync.WaitGroup\n\tfor w := 0; w < workers; w++ {\n\t\twg.Add(1)\n\t\tgo func(id int) {\n\t\t\tdefer wg.Done()\n\t\t\tfor item := range jobs {\n\t\t\t\tresult, err := process(item)\n\t\t\t\tif err != nil { errCh <- err; return }\n\t\t\t\tresults <- result\n\t\t\t}\n\t\t}(w)\n\t}\n\n\tgo func() {\n\t\tfor _, item := range items { jobs <- item }\n\t\tclose(jobs)\n\t}()\n\n\tgo func() { wg.Wait(); close(results); close(errCh) }()\n\n\tvar all []\${2:Result}\n\tfor r := range results { all = append(all, r) }\n\tif err := <-errCh; err != nil { return nil, err }\n\treturn all, nil\n}`, language: ['go'], category: 'pattern', tags: ['concurrency', 'goroutine'] },
      { id: 'go-context-timeout', prefix: ['context.WithTimeout', 'timeout'], description: 'Context with timeout', body: `func \${1:OpWithTimeout}(ctx context.Context, req \${2:Req}) (*\${3:Resp}, error) {\n\tctx, cancel := context.WithTimeout(ctx, \${4:30}*time.Second)\n\tdefer cancel()\n\n\tch := make(chan *\${3:Resp}, 1)\n\terrCh := make(chan error, 1)\n\n\tgo func() {\n\t\tresult, err := slowOp(ctx, req)\n\t\tif err != nil { errCh <- err; return }\n\t\tch <- result\n\t}()\n\n\tselect {\n\tcase r := <-ch: return r, nil\n\tcase err := <-errCh: return nil, err\n\tcase <-ctx.Done(): return nil, fmt.Errorf("timeout: %w", ctx.Err())\n\t}\n}`, language: ['go'], category: 'pattern', tags: ['context', 'timeout'] },
      { id: 'go-test-table-driven', prefix: ['test', 'table-driven'], description: 'Table-driven test', body: `func Test\${1:Func}(t *testing.T) {\n\ttests := []struct{\n\t\tname     string\n\t\tinput    \${2:InputType}\n\t\texpected \${3:ExpectedType}\n\t\twantErr  bool\n\t}{\n\t\t{"normal", \${4:in1}, \${5:exp1}, false},\n\t\t{"edge", \${6:in2}, \${7:exp2}, false},\n\t\t{"error", \${8:in3}, \${9:exp3}, true},\n\t}\n\n\tfor _, tt := range tests {\n\t\tt.Run(tt.name, func(t *testing.T) {\n\t\t\tgot, err := \${1:Func}(tt.input)\n\t\t\tif (err != nil) != tt.wantErr {\n\t\t\t\tt.Errorf("unexpected error: %v", err)\n\t\t\t}\n\t\t\tif got != tt.expected {\n\t\t\t\tt.Errorf("got %v, want %v", got, tt.expected)\n\t\t\t}\n\t\t})\n\t}\n}`, language: ['go'], category: 'test', tags: ['testing'] },
      { id: 'go-middleware-chain', prefix: ['middleware', 'chain'], description: 'HTTP middleware chain', body: `type Middleware func(http.Handler) http.Handler\n\nfunc Chain(middlewares ...Middleware) Middleware {\n\treturn func(final http.Handler) http.Handler {\n\t\tfor i := len(middlewares) - 1; i >= 0; i-- {\n\t\t\tfinal = middlewares[i](final)\n\t\t}\n\t\treturn final\n\t}\n}\n\nfunc Logger(log *slog.Logger) Middleware {\n\treturn func(next http.Handler) http.Handler {\n\t\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\t\tstart := time.Now()\n\t\t\tnext.ServeHTTP(w, r)\n\t\t\tlog.Info("request completed",\n\t\t\t\t"method", r.Method,\n\t\t\t\t"path", r.URL.Path,\n\t\t\t\t"duration", time.Since(start),\n\t\t\t)\n\t\t})\n\t}\n}`, language: ['go'], category: 'pattern', tags: ['middleware', 'http'] },
      { id: 'go-recover-panic', prefix: ['recover', 'panic-handler'], description: 'Panic recovery middleware', body: `func Recoverer(next http.Handler) http.Handler {\n\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\tdefer func() {\n\t\t\tif rv := recover(); rv != nil {\n\t\t\t\tlog.Printf("panic recovered: %v\\n%v", rv, debug.Stack())\n\t\t\t\thttp.Error(w, "internal server error", 500)\n\t\t\t}\n\t\t}()\n\t\tnext.ServeHTTP(w, r)\n\t})\n}`, language: ['go'], category: 'pattern', tags: ['panic', 'recovery'] }
    ]);

    // ==================== HTML/CSS ====================
    
    this.addCategory('html-css', [
      { id: 'html5-template', prefix: ['html', 'html5'], description: 'HTML5 boilerplate', body: `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>\${1:Document}</title>\n\t<link rel="stylesheet" href="\${2:styles.css}">\n</head>\n<body>\n\t<header>\n\t\t<nav><!-- nav --></nav>\n\t</header>\n\t<main>\n\t\t<section><!-- content --></section>\n\t</main>\n\t<footer><!-- footer --></footer>\n\t<script src="\${3:app.js}" defer></script>\n</body>\n</html>`, language: ['html'], category: 'template', tags: ['html5', 'boilerplate'] },
      { id: 'css-reset', prefix: ['reset', 'css-reset'], description: 'CSS reset/normalize', body: `*, *::before, *::after {\n\tbox-sizing: border-box;\n\tmargin: 0;\n\tpadding: 0;\n}\n\nhtml {\n\tscroll-behavior: smooth;\n\t-webkit-text-size-adjust: 100%;\n}\n\nbody {\n\tfont-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n\tline-height: 1.6;\n\tcolor: #1a1a1a;\n\tbackground: #fff;\n}\n\nimg, picture, video, canvas, svg {\n\tdisplay: block;\n\tmax-width: 100%;\n}\n\ninput, button, textarea, select {\n\tfont: inherit;\n}`, language: ['css'], category: 'config', tags: ['css', 'reset'] },
      { id: 'css-flex-center', prefix: ['flex', 'flexbox'], description: 'Flex centering', body: `.container {\n\tdisplay: flex;\n\tjustify-content: center;\n\talign-items: center;\n\tgap: 1rem;\n\tmin-height: 100vh;\n}`, language: ['css'], category: 'utility', tags: ['flexbox', 'layout'] },
      { id: 'css-grid-responsive', prefix: ['grid', 'grid-layout'], description: 'Responsive CSS Grid', body: `.grid-container {\n\tdisplay: grid;\n\tgrid-template-columns: repeat(auto-fit, minmax(300px, 1fr));\n\tgap: 1.5rem;\n\tpadding: 1rem;\n}\n\n@media (max-width: 768px) {\n\t.grid-container {\n\t\tgrid-template-columns: 1fr;\n\t}\n}`, language: ['css'], category: 'utility', tags: ['grid', 'responsive'] },
      { id: 'css-dark-mode', prefix: ['dark-mode', 'theme'], description: 'Dark mode support', body: `:root {\n\t--bg-primary: #ffffff;\n\t--text-primary: #1a1a1a;\n\t--accent-color: #3b82f6;\n}\n\n@media (prefers-color-scheme: dark) {\n\t:root {\n\t\t--bg-primary: #1a1a1a;\n\t\t--text-primary: #f5f5f5;\n\t\t--accent-color: #60a5fa;\n\t}\n}\n\n[data-theme="dark"] {\n\t--bg-primary: #1a1a1a;\n\t--text-primary: #f5f5f5;\n}\n\nbody {\n\tbackground: var(--bg-primary);\n\tcolor: var(--text-primary);\n}`, language: ['css'], category: 'pattern', tags: ['dark-mode', 'theme', 'variables'] },
      { id: 'css-animation', prefix: ['animation', '@keyframes'], description: 'CSS animation template', body: `@keyframes \${1:fadeInUp} {\n\tfrom {\n\t\topacity: 0;\n\t\ttransform: translateY(20px);\n\t}\n\tto {\n\t\topacity: 1;\n\t\ttransform: translateY(0);\n\t}\n}\n\n.animate-\${1:fadeInUp} {\n\tanimation: \${1:fadeInUp} \${2:0.6}s ease-out forwards;\n}\n\n@media (prefers-reduced-motion: reduce) {\n\t.animate-\${1:fadeInUp} {\n\t\tanimation: none;\n\t\topacity: 1;\n\t}\n}`, language: ['css'], category: 'utility', tags: ['animation', 'accessibility'] },
      { id: 'css-responsive-typography', prefix: ['typography', 'fluid-type'], description: 'Fluid typography', body: `html {\n\tfont-size: clamp(1rem, 0.95rem + 0.25vw, 1.25rem);\n}\n\nh1 {\n\tfont-size: clamp(2rem, 1.8rem + 1vw, 3rem);\n\tline-height: 1.2;\n}\n\nh2 {\n\tfont-size: clamp(1.5rem, 1.4rem + 0.5vw, 2rem);\n\tline-height: 1.3;\n}\n\np {\n\tmax-width: 70ch; /* Optimal reading length */\n\tline-height: 1.7;\n}`, language: ['css'], category: 'utility', tags: ['typography', 'responsive', 'fluid'] }
    ]);

    // ==================== JAVA ====================

    this.addCategory('java', [
      { id: 'java-class', prefix: ['class', 'public class'], description: 'Java class with constructor', body: `public class \${1:ClassName} {
    private \${2:type} \${3:field};

    public \${1:ClassName}(\${2:type} \${3:field}) {
        this.\${3:field} = \${3:field};
    }

    public \${2:type} get\${3:Field}() { return this.\${3:field}; }
    public void set\${3:Field}(\${2:type} \${3:field}) { this.\${3:field} = \${3:field}; }

    @Override
    public String toString() {
        return "\${1:ClassName}{\${3:field}=" + \${3:field} + "}";
    }
}`, language: ['java'], category: 'class', tags: ['basic', 'oop'] },
      { id: 'java-interface', prefix: ['interface'], description: 'Java interface', body: `public interface \${1:Service} {
    \${3:ReturnType} \${4:method}(\${5:param});
    
    default void log(String msg) {
        System.out.println("[\${1:Service}] " + msg);
    }
}`, language: ['java'], category: 'template', tags: ['interface'] },
      { id: 'java-spring-controller', prefix: ['@RestController'], description: 'Spring REST controller', body: `@RestController
@RequestMapping("/api/\${1:resources}")
@RequiredArgsConstructor
public class \${1:Resource}Controller {

    private final \${1:Resource}Service service;

    @PostMapping
    public ResponseEntity<\${1:Resource}> create(@RequestBody @Valid \${1:Resource}CreateDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(dto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<\${1:Resource}> getById(@PathVariable Long id) {
        return service.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public Page<\${1:Resource}> list(@PageableDefault Pageable pageable) {
        return service.findAll(pageable);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}`, language: ['java'], category: 'template', tags: ['spring', 'rest'] },
      { id: 'java-stream-api', prefix: ['stream', '.stream()'], description: 'Stream API operations', body: `List<\${1:Result}> results = \${2:list}.stream()
    .filter(item -> item.getStatus() == Status.ACTIVE)
    .sorted(Comparator.comparing(\${1:Result}::getName))
    .map(mapper::toDto)
    .collect(Collectors.toList());

Map<String, List<\${1:Result}>> grouped = \${2:list}.stream()
    .collect(Collectors.groupingBy(item -> item.getCategory()));`, language: ['java'], category: 'utility', tags: ['stream', 'functional'] },
      { id: 'java-junit5-test', prefix: ['@Test', 'junit5'], description: 'JUnit 5 test', body: `@ExtendWith(MockitoExtension.class)
class \${1:Service}Test {

    @Mock
    private \${2:Repository} repository;

    @InjectMocks
    private \${1:Service} service;

    @Test
    void shouldCreate_WhenValidInput() {
        // Given
        \${3:DTO} dto = new \${3:DTO}();
        when(repository.save(any())).thenReturn(new \${3:Entity}());

        // When
        var result = service.create(dto);

        // Then
        assertThat(result).isNotNull();
        verify(repository, times(1)).save(any());
    }
}`, language: ['java'], category: 'test', tags: ['junit5', 'mockito'] },
      { id: 'java-builder-pattern', prefix: ['builder', 'Builder'], description: 'Builder pattern', body: `public class \${1:User} {
    private final String name;
    private final String email;
    private final int age;

    private \${1:User}(Builder b) { this.name = b.name; this.email = b.email; this.age = b.age; }
    
    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String name, email;
        private int age = 0;

        public Builder name(String n) { this.name = n; return this; }
        public Builder email(String e) { this.email = e; return this; }
        public Builder age(int a) { this.age = a; return this; }

        public \${1:User} build() {
            if (name == null || email == null) throw new IllegalStateException("required");
            return new \${1:User}(this);
        }
    }
}`, language: ['java'], category: 'pattern', tags: ['builder'] }
    ]);

    // ==================== RUST ====================

    this.addCategory('rust', [
      { id: 'rust-struct', prefix: ['struct'], description: 'Rust struct with impl', body: `#[derive(Debug, Clone)]
pub struct \${1:StructName} {
    pub \${2:id}: u64,
    pub \${3:name}: String,
}

impl \${1:StructName} {
    pub fn new(\${3:name}: String) -> Self {
        Self { \${2:id}: 0, \${3:name} }
    }

    pub fn with_id(mut self, \${2:id}: u64) -> Self {
        self.\${2:id} = \${2:id};
        self
    }
}`, language: ['rust'], category: 'class', tags: ['struct'] },
      { id: 'rust-error-handling', prefix: ['Result', 'error'], description: 'Custom error type', body: `use thiserror::Error;

#[derive(Error, Debug)]
pub enum \${1:AppError} {
    #[error("{0}")]
    NotFound(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("IO error")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, \${1:AppError}>;`, language: ['rust'], category: 'pattern', tags: ['error'] },
      { id: 'rust-async-function', prefix: ['async fn'], description: 'Async function', body: `use tokio::time::{timeout, Duration};

pub async fn fetch_\${1:resource}(id: u64) -> Result<\${1:Resource}> {
    let result = timeout(Duration::from_secs(\${2:30}), async {
        db::fetch_by_id(id).await
    }).await.map_err(|_| \${1:AppError}::Internal("timeout".into()))??;

    Ok(result)
}`, language: ['rust'], category: 'function', tags: ['async', 'tokio'] },
      { id: 'rust-trait', prefix: ['trait'], description: 'Trait definition', body: `pub trait \${1:Repository}<T> {
    async fn find_by_id(&self, id: u64) -> Result<Option<T>>;
    async fn save(&self, entity: &T) -> Result<T>;
}

pub struct InMemoryRepository<T: Clone> {
    items: std::sync::Arc<tokio::sync::RwLock<Vec<T>>>,
}`, language: ['rust'], category: 'template', tags: ['trait'] }
    ]);

    // ==================== SQL ====================

    this.addCategory('sql', [
      { id: 'sql-select-basic', prefix: ['select', 'SELECT'], description: 'Basic SELECT', body: `SELECT 
    \${1:column1}, \${2:column2}, COUNT(*) as total
FROM \${3:table}
WHERE \${4:condition} = '\${5:value}'
GROUP BY \${1:column1}
ORDER BY total DESC
LIMIT 100;`, language: ['sql'], category: 'template', tags: ['select'] },
      { id: 'sql-join-inner', prefix: ['join', 'INNER JOIN'], description: 'JOIN query', body: `SELECT t1.id, t1.name, t2.category
FROM \${1:users} t1
INNER JOIN \${2:categories} t2 ON t1.cat_id = t2.id
WHERE t1.status = 'active'
ORDER BY t1.created_at DESC;`, language: ['sql'], category: 'template', tags: ['join'] },
      { id: 'sql-insert-upsert', prefix: ['insert', 'INSERT INTO'], description: 'INSERT/UPSERT', body: `INSERT INTO \${1:table} (\${2:col1}, \${3:col2})
VALUES ('\${4:v1}', '\${5:v2}')
ON CONFLICT (\${6:unique_col}) DO UPDATE SET
    \${3:col2} = EXCLUDED.\${3:col2}
RETURNING *;`, language: ['sql'], category: 'template', tags: ['insert', 'upsert'] },
      { id: 'sql-window-function', prefix: ['window', 'OVER ()'], description: 'Window functions', body: `SELECT user_id, amount,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC) as rn,
    SUM(amount) OVER (PARTITION BY user_id ORDER BY date ROWS UNBOUNDED PRECEDING) as running_total
FROM orders
QUALIFY rn <= 10;`, language: ['sql'], category: 'utility', tags: ['window'] },
      { id: 'sql-create-table', prefix: ['CREATE TABLE'], description: 'Create table', body: `CREATE TABLE IF NOT EXISTS \${1:users} (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_\${1:users}_email ON \${1:users}(email);`, language: ['sql'], category: 'config', tags: ['ddl'] }
    ]);

    // ==================== SHELL / BASH ====================

    this.addCategory('shell', [
      { id: 'bash-script-header', prefix: ['#!/bin/bash', 'script'], description: 'Bash script header', body: `#!/usr/bin/env bash
set -euo pipefail

RED='\\033[0;31m'
GREEN='\\033[0;32m'
NC='\\033[0m'

log_info() { echo -e "\${GREEN}[INFO]\${NC} $*"; }
log_error() { echo -e "\${RED}[ERROR]\${NC} $*" >&2; }

cleanup() { log_info "Cleaning up..."; }
trap cleanup EXIT

main() {
    log_info "Starting..."
    \${1:# code here}
}

main "$@"`, language: ['bash', 'shell'], category: 'template', tags: ['header'] },
      { id: 'bash-parse-args', prefix: ['getopts', 'arguments'], description: 'Parse arguments', body: `while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file) FILE="$2"; shift 2 ;;
        -v|--verbose) VERBOSE=true; shift ;;
        -h|--help|*) usage ;;
    esac
done`, language: ['bash', 'shell'], category: 'utility', tags: ['arguments'] },
      { id: 'bash-curl-api', prefix: ['curl', 'api-call'], description: 'HTTP API call', body: `response=$(curl -s -w "\\n%{http_code}" \\
    -H "Authorization: Bearer $TOKEN" \\
    "${URL}/endpoint")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [[ "$http_code" =~ ^2 ]]; then echo "$body"; fi`, language: ['bash', 'shell'], category: 'utility', tags: ['curl', 'http'] },
      { id: 'bash-docker-commands', prefix: ['docker', 'container'], description: 'Docker commands', body: `docker build -t myapp:v1 .
docker run -d --name app -p 8080:80 myapp:v1
docker logs -f app
docker stop app && docker rm app`, language: ['bash', 'shell'], category: 'utility', tags: ['docker'] }
    ]);

    // ==================== DOCKER ====================

    this.addCategory('docker', [
      { id: 'dockerfile-node', prefix: ['Dockerfile', 'node'], description: 'Node.js Dockerfile', body: `FROM node:\${1:18}-alpine AS builder
WORKDIR /app
COPY package*.json . && npm ci
COPY . . && npm run build

FROM node:\${1:18}-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
EXPOSE \${2:3000}
CMD ["node", "dist/index.js"]`, language: ['dockerfile'], category: 'config', tags: ['node'] },
      { id: 'docker-compose', prefix: ['docker-compose.yml'], description: 'Compose setup', body: `services:
  app:
    build: .
    ports:
      - "\${1:8000}:\${1:8000}"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/db
    depends_on:
      - db
  
  db:
    image: postgres:\${2:15}-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:`, language: ['yaml'], category: 'config', tags: ['compose'] }
    ]);

    // ==================== TESTING FRAMEWORKS ====================

    this.addCategory('testing', [
      { id: 'jest-describe', prefix: ['describe', 'jest'], description: 'Jest test suite', body: `describe('\${1:Component}', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should work correctly', () => {
    const result = func(input);
    expect(result).toBe(expected);
  });

  it('should handle errors', () => {
    expect(() => func(invalid)).toThrow();
  });
});`, language: ['typescript', 'javascript'], category: 'test', tags: ['jest'] },
      { id: 'react-testing-library', prefix: ['render', '@testing-library'], description: 'React testing', body: `import { render, screen } from '@testing-library/react';

describe('\${1:MyComponent}', () => {
  it('renders correctly', () => {
    render(<\${1:MyComponent} title="\${2:Hello}" />);
    expect(screen.getByText('\${2:Hello}')).toBeInTheDocument();
  });

  it('handles click', () => {
    const mockFn = jest.fn();
    render(<\${1:MyComponent} onClick={mockFn} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockFn).toHaveBeenCalled();
  });
});`, language: ['tsx', 'jsx'], category: 'test', tags: ['react', 'testing-library'] }
    ]);

    // ==================== ALGORITHM PATTERNS ====================

    this.addCategory('algorithms', [
      { id: 'algo-binary-search', prefix: ['binary-search'], description: 'Binary search', body: `function binarySearch(arr: \${1:T}[], target: \${1:T}): number {
  let left = 0, right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    else if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }

  return -1;
}`, language: ['typescript', 'javascript'], category: 'pattern', tags: ['algorithm', 'search'] },
      { id: 'algo-quicksort', prefix: ['quicksort'], description: 'QuickSort', body: `function quickSort<\${1:T}>(arr: \${1:T}[]): \${1:T}[] {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const middle = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);

  return [...quickSort(left), ...middle, ...quickSort(right)];
}`, language: ['typescript', 'javascript'], category: 'pattern', tags: ['algorithm', 'sorting'] },
      { id: 'algo-dfs-bfs', prefix: ['dfs', 'bfs', 'graph'], description: 'Graph traversal', body: `function dfs(graph: Map<number, number[]>, start: number): number[] {
  const visited = new Set<number>();
  const result: number[] = [];

  function traverse(node: number) {
    visited.add(node);
    result.push(node);
    for (const neighbor of graph.get(node) || []) {
      if (!visited.has(neighbor)) traverse(neighbor);
    }
  }

  traverse(start);
  return result;
}

function bfs(graph: Map<number, number[]>, start: number): number[] {
  const queue = [start];
  const visited = new Set([start]);
  const result: number[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of graph.get(current) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return result;
}`, language: ['typescript', 'javascript'], category: 'pattern', tags: ['algorithm', 'graph'] },
      { id: 'algo-debounce-enhanced', prefix: ['debounce-improved'], description: 'Enhanced debounce', body: `function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const { leading = false, trailing = true } = options;

  return (...args: Parameters<T>) => {
    if (timer !== undefined) clearTimeout(timer);
    if (leading && !timer) func(...args);
    timer = setTimeout(() => {
      if (trailing) func(...args);
      timer = undefined;
    }, wait);
  };
}`, language: ['typescript', 'javascript'], category: 'utility', tags: ['performance', 'debounce'] }
    ]);
  }

  // ==================== Helper Methods ====================

  private addCategory(category: string, snippets: CodeSnippet[]): void {
    this.snippets.set(category, snippets);
  }

  private getAllSnippets(): CodeSnippet[] {
    const all: CodeSnippet[] = [];
    for (const snippets of this.snippets.values()) {
      all.push(...snippets);
    }
    all.push(...this.userSnippets);
    return all;
  }

  private getExactMatches(query: string): CodeSnippet[] {
    const lowerQuery = query.toLowerCase();
    const matches: CodeSnippet[] = [];
    
    for (const snippets of this.snippets.values()) {
      for (const snippet of snippets) {
        if (snippet.prefix.some(p => p.toLowerCase().includes(lowerQuery))) {
          matches.push(snippet);
        }
      }
    }
    
    // Also check user snippets
    for (const snippet of this.userSnippets) {
      if (snippet.prefix.some(p => p.toLowerCase().includes(lowerQuery))) {
        matches.push(snippet);
      }
    }
    
    return matches;
  }

  private deduplicate(snippets: CodeSnippet[]): CodeSnippet[] {
    const seen = new Set<string>();
    return snippets.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }

  private rankByContext(snippets: CodeSnippet[], context: {
    language?: string;
    filePath?: string;
    lineContent?: string;
    projectType?: string;
  }): CodeSnippet[] {
    let ranked = [...snippets];

    // 1. Boost by language match (highest weight)
    if (context.language) {
      const langLower = context.language.toLowerCase();
      ranked = ranked.map(s => ({
        snippet: s,
        score: this.calculateLanguageScore(s, langLower) * 10
      })).sort((a, b) => b.score - a.score)
        .map(item => item.snippet);
    }

    // 2. Boost by file path patterns
    if (context.filePath) {
      ranked = this.boostByFilePath(ranked, context.filePath);
    }

    // 3. Boost by line content analysis (code context)
    if (context.lineContent) {
      ranked = this.boostByLineContext(ranked, context.lineContent);
    }

    // 4. Boost by project type detection
    if (context.projectType) {
      ranked = this.boostByProjectType(ranked, context.projectType);
    }

    // 5. Boost by time of day (adaptive recommendations)
    ranked = this.boostByTimeOfDay(ranked);

    // 6. Final boost by usage frequency
    return this.boostByUsage(ranked);
  }

  private boostByLineContext(snippets: CodeSnippet[], lineContent: string): CodeSnippet[] {
    const lowerLine = lineContent.toLowerCase();
    
    return snippets.map(s => ({
      snippet: s,
      bonus: this.calculateLineContextBonus(s, lowerLine)
    })).sort((a, b) => b.bonus - a.bonus)
      .map(item => item.snippet);
  }

  private calculateLineContextBonus(snippet: CodeSnippet, lineContent: string): number {
    let bonus = 0;

    // Check for import statements
    if (lineContent.includes('import ') || lineContent.includes('require(')) {
      if (snippet.category === 'utility' || snippet.tags.includes('import')) bonus += 8;
    }

    // Check for function definition patterns
    if (lineContent.includes('function') || lineContent.includes('def ') || lineContent.includes('func ')) {
      if (snippet.category === 'function' || snippet.category === 'pattern') bonus += 7;
    }

    // Check for async/await patterns
    if (lineContent.includes('async') || lineContent.includes('await')) {
      if (snippet.tags.includes('async')) bonus += 9;
    }

    // Check for React patterns
    if (lineContent.includes('useState') || lineContent.includes('useEffect') || 
        lineContent.includes('return (') || lineContent.includes('<')) {
      if (snippet.language.toString().includes('react') || snippet.language.toString().includes('jsx')) bonus += 8;
    }

    // Check for error handling patterns
    if (lineContent.includes('catch') || lineContent.includes('error') || lineContent.includes('try')) {
      if (snippet.category === 'control' && snippet.tags.includes('error-handling')) bonus += 7;
    }

    // Check for test patterns
    if (lineContent.includes('describe(') || lineContent.includes('it(') || 
        lineContent.includes('test(') || lineContent.includes('@Test')) {
      if (snippet.category === 'test') bonus += 10;
    }

    // Check for database/SQL patterns
    if (lineContent.includes('SELECT') || lineContent.includes('INSERT') ||
        lineContent.includes('db.') || lineContent.includes('query')) {
      if (snippet.category === 'template' && snippet.tags.includes('sql')) bonus += 6;
    }

    return bonus;
  }

  private boostByProjectType(snippets: CodeSnippet[], projectType: string): CodeSnippet[] {
    const typeLower = projectType.toLowerCase();
    
    return snippets.map(s => ({
      snippet: s,
      bonus: this.calculateProjectTypeBonus(s, typeLower)
    })).sort((a, b) => b.bonus - a.bonus)
      .map(item => item.snippet);
  }

  private calculateProjectTypeBonus(snippet: CodeSnippet, projectType: string): number {
    let bonus = 0;

    switch (projectType) {
      case 'react':
      case 'next':
      case 'vue':
        if (snippet.language.toString().includes('react') || 
            snippet.language.toString().includes('jsx') ||
            snippet.language.toString().includes('tsx')) bonus += 12;
        break;
      
      case 'node':
      case 'express':
      case 'nestjs':
        if (snippet.language.toString().includes('javascript') ||
            snippet.language.toString().includes('typescript')) bonus += 10;
        if (snippet.tags.includes('api') || snippet.tags.includes('http')) bonus += 5;
        break;
      
      case 'python':
      case 'django':
      case 'flask':
      case 'fastapi':
        if (snippet.language.toString().includes('python')) bonus += 11;
        if (projectType === 'fastapi' && snippet.id.startsWith('py-fastapi')) bonus += 15;
        break;
      
      case 'go':
        if (snippet.language.toString().includes('go')) bonus += 12;
        break;
      
      case 'java':
      case 'spring':
        if (snippet.language.toString().includes('java')) bonus += 11;
        if (projectType === 'spring' && snippet.id.startsWith('java-spring')) bonus += 14;
        break;
      
      case 'rust':
        if (snippet.language.toString().includes('rust')) bonus += 13;
        break;
      
      default:
        break;
    }

    return bonus;
  }

  private boostByTimeOfDay(snippets: CodeSnippet[]): CodeSnippet[] {
    const hour = new Date().getHours();
    
    return snippets.map(s => ({
      snippet: s,
      timeBonus: this.calculateTimeBonus(s, hour)
    })).sort((a, b) => b.timeBonus - a.timeBonus)
      .map(item => item.snippet);
  }

  private calculateTimeBonus(snippet: CodeSnippet, hour: number): number {
    let bonus = 0;

    // Morning (6-12): Focus on new features and development
    if (hour >= 6 && hour < 12) {
      if (snippet.category === 'function' || snippet.category === 'class') bonus += 3;
      if (snippet.category === 'template') bonus += 2;
    }
    
    // Afternoon (12-18): Focus on testing and debugging
    else if (hour >= 12 && hour < 18) {
      if (snippet.category === 'test') bonus += 4;
      if (snippet.tags.includes('debugging') || snippet.tags.includes('logging')) bonus += 2;
    }
    
    // Evening (18-24): Focus on refactoring and optimization
    else if (hour >= 18 && hour < 24) {
      if (snippet.category === 'pattern') bonus += 3;
      if (snippet.tags.includes('performance') || snippet.tags.includes('optimization')) bonus += 4;
    }
    
    // Night (0-6): Documentation and configuration
    else {
      if (snippet.category === 'config') bonus += 3;
      if (snippet.tags.includes('docstring') || snippet.tags.includes('documentation')) bonus += 2;
    }

    return bonus;
  }

  private calculateLanguageScore(snippet: CodeSnippet, currentLanguage: string): number {
    const languages = Array.isArray(snippet.language) 
      ? snippet.language 
      : [snippet.language];
    
    if (languages.includes(currentLanguage)) return 10;
    if (languages.some(l => l.includes(currentLanguage))) return 5;
    return 0;
  }

  private boostByFilePath(snippets: CodeSnippet[], filePath: string): CodeSnippet[] {
    // Extract file extension and name patterns
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
    
    return snippets.map(s => ({
      snippet: s,
      bonus: this.calculateFileBonus(s, ext, fileName)
    })).sort((a, b) => b.bonus - a.bonus)
      .map(item => item.snippet);
  }

  private calculateFileBonus(snippet: CodeSnippet, ext: string, fileName: string): number {
    let bonus = 0;
    
    // Check if snippet is relevant to file type
    if (snippet.tags.includes(ext)) bonus += 5;
    if (snippet.tags.includes(`file:${fileName}`)) bonus += 10;
    
    // Check file naming conventions
    if (fileName.includes('test') && snippet.category === 'test') bonus += 8;
    if (fileName.includes('spec') && snippet.category === 'test') bonus += 8;
    if ((fileName.includes('model') || fileName.includes('entity')) && 
        (snippet.category === 'class' || snippet.tags.includes('model'))) bonus += 7;
    
    return bonus;
  }

  private boostByUsage(snippets: CodeSnippet[]): CodeSnippet[] {
    return snippets.map(s => ({
      snippet: s,
      usageScore: (this.usageStats.get(s.id) || 0) * 0.1
    })).sort((a, b) => b.usageScore - a.usageScore)
      .map(item => item.snippet);
  }

  // ==================== Persistence Methods ====================

  private loadUserSnippets(): void {
    try {
      const saved = localStorage.getItem('codecast_user_snippets');
      if (saved) {
        const decrypted = StorageEncryption.decrypt(saved);
        this.userSnippets = JSON.parse(decrypted);
      }
    } catch (e) {
      console.warn('Failed to load user snippets:', e);
    }
  }

  private saveUserSnippets(): void {
    try {
      const encrypted = StorageEncryption.encrypt(JSON.stringify(this.userSnippets));
      localStorage.setItem('codecast_user_snippets', encrypted);
    } catch (e) {
      console.warn('Failed to save user snippets:', e);
    }
  }

  private loadUsageStats(): void {
    try {
      const saved = localStorage.getItem('codecast_snippet_usage');
      if (saved) {
        const decrypted = StorageEncryption.decrypt(saved);
        const parsed = JSON.parse(decrypted);
        Object.entries(parsed).forEach(([key, value]) => {
          this.usageStats.set(key, value as number);
        });
      }
    } catch (e) {
      console.warn('Failed to load usage stats:', e);
    }
  }

  private persistUsageStats(): void {
    try {
      const statsObj: Record<string, number> = {};
      this.usageStats.forEach((value, key) => {
        statsObj[key] = value;
      });
      const encrypted = StorageEncryption.encrypt(JSON.stringify(statsObj));
      localStorage.setItem('codecast_snippet_usage', encrypted);
    } catch (e) {
      console.warn('Failed to persist usage stats:', e);
    }
  }

  private loadLearningData(): void {
    try {
      const savedPrefs = localStorage.getItem('codecast_context_prefs');
      if (savedPrefs) {
        const decryptedPrefs = StorageEncryption.decrypt(savedPrefs);
        const parsed = JSON.parse(decryptedPrefs);
        Object.entries(parsed).forEach(([key, value]) => {
          const innerMap = new Map<string, number>();
          Object.entries(value as Record<string, number>).forEach(([k, v]) => {
            innerMap.set(k, v);
          });
          this.contextPreferences.set(key, innerMap);
        });
      }

      const savedTemporal = localStorage.getItem('codecast_temporal_stats');
      if (savedTemporal) {
        const decryptedTemporal = StorageEncryption.decrypt(savedTemporal);
        const parsed = JSON.parse(decryptedTemporal);
        Object.entries(parsed).forEach(([key, value]) => {
          const innerMap = new Map<string, number>();
          Object.entries(value as Record<string, number>).forEach(([k, v]) => {
            innerMap.set(k, v);
          });
          this.temporalStats.set(key, innerMap);
        });
      }

      const savedQueue = localStorage.getItem('codecast_recent_queue');
      if (savedQueue) {
        const decryptedQueue = StorageEncryption.decrypt(savedQueue);
        this.recentUsageQueue = JSON.parse(decryptedQueue);
      }
    } catch (e) {
      console.warn('Failed to load learning data:', e);
    }
  }

  private persistLearningData(): void {
    try {
      const prefsObj: Record<string, Record<string, number>> = {};
      this.contextPreferences.forEach((innerMap, key) => {
        prefsObj[key] = {};
        innerMap.forEach((value, k) => {
          prefsObj[key][k] = value;
        });
      });
      const encryptedPrefs = StorageEncryption.encrypt(JSON.stringify(prefsObj));
      localStorage.setItem('codecast_context_prefs', encryptedPrefs);

      const temporalObj: Record<string, Record<string, number>> = {};
      this.temporalStats.forEach((innerMap, key) => {
        temporalObj[key] = {};
        innerMap.forEach((value, k) => {
          temporalObj[key][k] = value;
        });
      });
      const encryptedTemporal = StorageEncryption.encrypt(JSON.stringify(temporalObj));
      localStorage.setItem('codecast_temporal_stats', encryptedTemporal);

      const encryptedQueue = StorageEncryption.encrypt(JSON.stringify(this.recentUsageQueue));
      localStorage.setItem('codecast_recent_queue', encryptedQueue);
    } catch (e) {
      console.warn('Failed to persist learning data:', e);
    }
  }

  // ==================== Public Statistics ====================

  getStatistics(): {
    totalSnippets: number;
    userSnippets: number;
    totalUsage: number;
    topUsed: Array<{ id: string; count: number; description: string }>;
  } {
    const sortedUsage = Array.from(this.usageStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topUsed = sortedUsage.map(([id, count]) => ({
      id,
      count,
      description: this.getSnippetById(id)?.description || 'Unknown'
    }));

    return {
      totalSnippets: this.getAllSnippets().length,
      userSnippets: this.userSnippets.length,
      totalUsage: Array.from(this.usageStats.values()).reduce((sum, val) => sum + val, 0),
      topUsed
    };
  }

  exportSnippets(): string {
    return JSON.stringify({
      userSnippets: this.userSnippets,
      usageStats: Object.fromEntries(this.usageStats),
      version: '1.0'
    }, null, 2);
  }

  importSnippets(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      
      if (data.userSnippets && Array.isArray(data.userSnippets)) {
        this.userSnippets = data.userSnippets;
        this.saveUserSnippets();
      }
      
      if (data.usageStats && typeof data.usageStats === 'object') {
        Object.entries(data.usageStats).forEach(([key, value]) => {
          this.usageStats.set(key, value as number);
        });
        this.persistUsageStats();
      }
      
      return true;
    } catch (e) {
      console.error('Failed to import snippets:', e);
      return false;
    }
  }
}

// ==================== Template Processor ====================

export interface TemplateParameter {
  index: number;
  name: string;
  defaultValue: string;
  isRequired: boolean;
  placeholder: string;
}

export interface ProcessedTemplate {
  text: string;
  parameters: TemplateParameter[];
  cursorPositions: number[];
}

export class TemplateProcessor {
  static readonly PLACEHOLDER_REGEX = /\$\{(\d+)(?::([^}]*))?\}/g;

  static processTemplate(templateBody: string, context?: {
    fileName?: string;
    className?: string;
    functionName?: string;
    customVars?: Record<string, string>;
  }): ProcessedTemplate {
    const parameters: TemplateParameter[] = [];
    const cursorPositions: number[] = [];
    let paramIndex = 0;

    const processedText = templateBody.replace(this.PLACEHOLDER_REGEX, (match, numStr, placeholder) => {
      const index = parseInt(numStr, 10);
      const [name, ...defaultParts] = (placeholder || `param${index}`).split(',');
      const defaultValue = defaultParts.join(',').trim() || '';
      
      const param: TemplateParameter = {
        index,
        name: name.trim(),
        defaultValue,
        isRequired: !defaultValue,
        placeholder: name.trim()
      };

      // Smart defaults based on context
      if (!defaultValue && context) {
        if (param.name.toLowerCase().includes('name') && context.className) {
          param.defaultValue = context.className;
        } else if (param.name.toLowerCase().includes('func') && context.functionName) {
          param.defaultValue = context.functionName;
        } else if (param.name.toLowerCase().includes('file') && context.fileName) {
          param.defaultValue = context.fileName;
        } else if (context.customVars && context.customVars[param.name]) {
          param.defaultValue = context.customVars[param.name];
        }
      }

      parameters.push(param);
      cursorPositions.push(paramIndex);
      paramIndex += param.defaultValue.length || 1;

      return param.defaultValue || ' ';
    });

    return { text: processedText, parameters, cursorPositions };
  }

  static extractParameters(templateBody: string): TemplateParameter[] {
    const parameters: TemplateParameter[] = [];
    
    this.PLACEHOLDER_REGEX.lastIndex = 0; // Reset regex state
    
    let match;
    while ((match = this.PLACEHOLDER_REGEX.exec(templateBody)) !== null) {
      const [, numStr, placeholder] = match;
      const index = parseInt(numStr, 10);
      const [name, ...defaultParts] = (placeholder || `param${index}`).split(',');
      
      parameters.push({
        index,
        name: name.trim(),
        defaultValue: defaultParts.join(',').trim() || '',
        isRequired: !defaultParts.length,
        placeholder: name.trim()
      });
    }

    return parameters;
  }

  static validateParameters(
    templateBody: string, 
    providedValues?: Record<string, string>
  ): { isValid: boolean; missingParams: TemplateParameter[] } {
    const allParams = this.extractParameters(templateBody);
    const missingParams = allParams.filter(p => 
      p.isRequired && 
      (!providedValues || !providedValues[p.name])
    );

    return {
      isValid: missingParams.length === 0,
      missingParams
    };
  }

  static generateParameterHints(snippet: CodeSnippet): Array<{
    name: string;
    type: string;
    description: string;
    suggestions: string[];
  }> {
    const hints: Array<{
      name: string;
      type: string;
      description: string;
      suggestions: string[];
    }> = [];

    const params = this.extractParameters(snippet.body);

    for (const param of params) {
      const hint = this.inferParameterHint(param, snippet);
      hints.push(hint);
    }

    return hints;
  }

  private static inferParameterHint(
    param: TemplateParameter, 
    snippet: CodeSnippet
  ): { name: string; type: string; description: string; suggestions: string[] } {
    const lowerName = param.name.toLowerCase();
    const suggestions: string[] = [];
    let type = 'string';
    let description = param.placeholder;

    // Infer type and suggestions from parameter name
    if (lowerName.includes('name')) {
      type = 'string';
      suggestions.push('MyComponent', 'UserService', 'getData');
      description = 'Descriptive name';
    } else if (lowerName.includes('type') || lowerName.includes('t')) {
      type = 'type';
      suggestions.push('string', 'number', 'boolean', 'any', 'void');
      description = 'Data type';
    } else if (lowerName.includes('id')) {
      type = 'number | string';
      suggestions.push('1', 'uuid', 'userId');
      description = 'Unique identifier';
    } else if (lowerName.includes('url') || lowerName.includes('path')) {
      type = 'string';
      suggestions.push('/api/endpoint', './relative/path');
      description = 'URL or file path';
    } else if (lowerName.includes('class') || lowerName.includes('component')) {
      type = 'ClassName';
      suggestions.push('MyClass', 'UserComponent');
      description = 'Class or component name';
    } else if (lowerName.includes('func') || lowerName.includes('method')) {
      type = 'functionName';
      suggestions.push('handleClick', 'fetchData', 'validateInput');
      description = 'Function or method name';
    } else if (lowerName.includes('param') || lowerName.includes('arg')) {
      type = 'any';
      suggestions.push('data', 'options', 'config');
      description = 'Function parameter';
    } else if (lowerName.includes('desc') || lowerName.includes('comment')) {
      type = 'string';
      suggestions.push('Description of what this does');
      description = 'Documentation or comment';
    }

    // Add language-specific suggestions
    if (Array.isArray(snippet.language)) {
      const lang = snippet.language[0].toLowerCase();
      
      if (lang === 'python' && lowerName === 'self') {
        suggestions.splice(0, suggestions.length, 'self');
      }
      
      if ((lang === 'typescript' || lang === 'javascript') && 
          (lowerName.includes('prop') || lowerName.includes('state'))) {
        suggestions.push('useState', 'useRef', 'useCallback');
      }
    }

    return {
      name: param.placeholder,
      type,
      description,
      suggestions
    };
  }
}

// Singleton instance
export const superFreeCompletionEngine = new SuperFreeCompletionEngine();