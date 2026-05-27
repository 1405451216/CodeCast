import { FuzzyMatcher } from './FuzzyMatcher';

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'variable' | 'constant' | 'interface' | 'type' | 'enum' | 'method' | 'property';
  file: string;
  line: number;
  column: number;
  signature?: string;
  documentation?: string;
  exports?: boolean;
  imports?: string[];
}

export interface FileIndex {
  path: string;
  lastModified: number;
  symbols: CodeSymbol[];
  imports: Array<{ from: string; symbols: string[] }>;
  exports: string[];
}

export class CodeIndexer {
  private fileIndices: Map<string, FileIndex> = new Map();
  private symbolCache: Map<string, CodeSymbol[]> = new Map();
  private isIndexing = false;

  async indexFile(filePath: string, content: string): Promise<FileIndex> {
    const language = this.detectLanguage(filePath);
    const symbols = this.extractSymbols(content, language);
    const imports = this.extractImports(content, language);
    const exports = this.extractExports(content, language);

    const fileIndex: FileIndex = {
      path: filePath,
      lastModified: Date.now(),
      symbols,
      imports,
      exports
    };

    this.fileIndices.set(filePath, fileIndex);
    this.updateSymbolCache(fileIndex);

    return fileIndex;
  }

  async indexProject(files: Array<{ path: string; content: string }>): Promise<void> {
    this.isIndexing = true;
    
    try {
      for (const file of files) {
        await this.indexFile(file.path, file.content);
      }
    } finally {
      this.isIndexing = false;
    }
  }

  findSymbols(query: string, options?: { 
    type?: CodeSymbol['type']; 
    file?: string; 
    limit?: number;
    fuzzy?: boolean;
  }): CodeSymbol[] {
    let results: CodeSymbol[] = [];

    if (options?.file) {
      const fileIndex = this.fileIndices.get(options.file);
      if (fileIndex) {
        results = fileIndex.symbols;
      }
    } else {
      this.symbolCache.forEach(symbols => {
        results.push(...symbols);
      });
    }

    if (options?.type) {
      results = results.filter(s => s.type === options.type);
    }

    if (query) {
      if (options?.fuzzy !== false) {
        const matched = FuzzyMatcher.filter(results, query, s => s.name);
        results = matched.map(m => m.item);
      } else {
        const lowerQuery = query.toLowerCase();
        results = results.filter(s => 
          s.name.toLowerCase().includes(lowerQuery)
        );
      }
    }

    return results.slice(0, options?.limit || 50);
  }

  getCompletionsForContext(
    context: string,
    filePath: string,
    position: { line: number; column: number }
  ): Array<{ text: string; type: string; documentation?: string }> {
    const completions: Array<{ text: string; type: string; documentation?: string }> = [];

    const currentLine = context.split('\n')[position.line - 1] || '';
    const textBeforeCursor = currentLine.slice(0, position.column - 1);
    
    const importMatch = textBeforeCursor.match(/import\s+[\s\{]*$/);
    if (importMatch) {
      const availableImports = this.getAvailableImports(filePath);
      completions.push(...availableImports.map(imp => ({
        text: imp.symbol,
        type: 'import',
        documentation: `from ${imp.from}`
      })));
    }

    const functionCallMatch = textBeforeCursor.match(/(\w+)\.\s*(\w*)$/);
    if (functionCallMatch) {
      const [, objectName, partialMethod] = functionCallMatch;
      const objectSymbols = this.findSymbols(objectName, { type: ['class', 'interface', 'type'] as any });
      
      for (const symbol of objectSymbols) {
        const methods = this.findSymbols(symbol.name, { type: 'method', fuzzy: false });
        if (partialMethod) {
          completions.push(...methods
            .filter(m => m.name.toLowerCase().startsWith(partialMethod.toLowerCase()))
            .map(m => ({
              text: m.name,
              type: 'method',
              documentation: m.signature
            }))
          );
        } else {
          completions.push(...methods.map(m => ({
            text: m.name,
            type: 'method',
            documentation: m.signature
          })));
        }
      }
    }

    const variableMatch = textBeforeCursor.match(/(?:const|let|var)\s+(\w*)$/);
    if (variableMatch) {
      const localVariables = this.getLocalSymbols(filePath, position.line);
      const partialVar = variableMatch[1];
      
      completions.push(...localVariables
        .filter(v => !partialVar || v.name.toLowerCase().includes(partialVar.toLowerCase()))
        .map(v => ({
          text: v.name,
          type: v.type,
          documentation: v.signature
        }))
      );
    }

    return completions;
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
      'java': 'java',
      'rb': 'ruby'
    };
    return langMap[ext] || 'plaintext';
  }

  private extractSymbols(content: string, language: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');

    const patterns: Record<string, RegExp[]> = {
      typescript: [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
        /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
        /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g,
        /(?:export\s+)?(?:type|interface)\s+(\w+)/g,
        /(?:export\s+)?enum\s+(\w+)/g,
        /(?:export\s+)?const\s+(\w+)\s*[:=]/g
      ],
      javascript: [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g,
        /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
        /(?:export\s+)?class\s+(\w+)/g,
        /(?:export\s+)?const\s+(\w+)\s*[:=]/g
      ],
      python: [
        /def\s+(\w+)\s*\(/g,
        /class\s+(\w+)/g,
        /^(\w+)\s*=\s*(?!=)/gm
      ],
      go: [
        /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/g,
        /type\s+(\w+)\s+(?:struct|interface)/g,
        /var\s+(\w+)/g,
        /const\s+(\w+)/g
      ]
    };

    const langPatterns = patterns[language] || patterns.javascript;

    for (const pattern of langPatterns) {
      let match;
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(content)) !== null) {
        const lineIndex = content.slice(0, match.index).split('\n').length - 1;
        
        let type: CodeSymbol['type'] = 'function';
        if (match[0].includes('class') || match[0].includes('struct')) type = 'class';
        else if (match[0].includes('interface') || match[0].includes('type')) type = 'interface';
        else if (match[0].includes('enum')) type = 'enum';
        else if (match[0].includes('const')) type = 'constant';

        symbols.push({
          name: match[1],
          type,
          file: '',
          line: lineIndex + 1,
          column: match.index - content.lastIndexOf('\n', match.index - 1),
          signature: match[0].trim()
        });
      }
    }

    return symbols;
  }

  private extractImports(content: string, language: string): FileIndex['imports'] {
    const imports: FileIndex['imports'] = [];
    const importPatterns: Record<string, RegExp> = {
      typescript: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      javascript: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      python: /^import\s+.*|^from\s+.+\s+import\s+.+/gm,
      go: /^\s*["](\S+)["]/gm
    };

    const pattern = importPatterns[language] || importPatterns.typescript;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      imports.push({ from: match[1], symbols: [] });
    }

    return imports;
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];
    const exportPatterns: Record<string, RegExp> = {
      typescript: /export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/g,
      javascript: /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
      python: /^__all__\s*=\s*\[([^\]]+)\]/gm
    };

    const pattern = exportPatterns[language] || exportPatterns.typescript;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private updateSymbolCache(fileIndex: FileIndex): void {
    for (const symbol of fileIndex.symbols) {
      symbol.file = fileIndex.path;
      
      if (!this.symbolCache.has(symbol.name)) {
        this.symbolCache.set(symbol.name, []);
      }
      this.symbolCache.get(symbol.name)!.push(symbol);
    }
  }

  private getAvailableImports(currentFile: string): Array<{ symbol: string; from: string }> {
    const available: Array<{ symbol: string; from: string }> = [];
    const imported = new Set<string>();

    const currentIndex = this.fileIndices.get(currentFile);
    if (currentIndex) {
      currentIndex.imports.forEach(imp => imp.symbols.forEach(s => imported.add(s)));
    }

    this.fileIndices.forEach((fileIndex, path) => {
      if (path === currentFile) return;
      
      fileIndex.exports.forEach(exp => {
        if (!imported.has(exp)) {
          available.push({
            symbol: exp,
            from: path
          });
        }
      });
    });

    return available;
  }

  private getLocalSymbols(filePath: string, currentLine: number): CodeSymbol[] {
    const fileIndex = this.fileIndices.get(filePath);
    if (!fileIndex) return [];

    return fileIndex.symbols.filter(s => s.line <= currentLine);
  }

  getFileStats(): { totalFiles: number; totalSymbols: number; indexedLanguages: string[] } {
    let totalSymbols = 0;
    const languages = new Set<string>();

    this.fileIndices.forEach(index => {
      totalSymbols += index.symbols.length;
      languages.add(this.detectLanguage(index.path));
    });

    return {
      totalFiles: this.fileIndices.size,
      totalSymbols,
      indexedLanguages: Array.from(languages)
    };
  }

  clear(): void {
    this.fileIndices.clear();
    this.symbolCache.clear();
  }
}