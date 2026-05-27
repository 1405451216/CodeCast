import { DocumentChunk } from './SimpleVectorizer';

export interface ChunkOptions {
  maxChunkSize: number;
  overlapSize: number;
  respectCodeBoundaries: boolean;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChunkSize: 500,
  overlapSize: 50,
  respectCodeBoundaries: true
};

export class DocumentChunker {
  private options: ChunkOptions;

  constructor(options?: Partial<ChunkOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  chunkDocument(
    content: string,
    filePath: string,
    language: string
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    if (this.options.respectCodeBoundaries) {
      chunks.push(...this.chunkByCodeStructure(content, filePath, language));
    } else {
      chunks.push(...this.chunkBySize(content, filePath, language));
    }

    return chunks;
  }

  private chunkByCodeStructure(
    content: string,
    filePath: string,
    language: string
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const lines = content.split('\n');
    
    let currentChunkLines: string[] = [];
    let currentStartLine = 1;
    let currentType: DocumentChunk['metadata']['type'] = 'code';
    let currentSymbols: string[] = [];

    const codeBlockPatterns = [
      { pattern: /^(?:export\s+)?(?:async\s+)?function\s+\w+/m, type: 'code' as const },
      { pattern: /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/m, type: 'code' as const },
      { pattern: /^(?:export\s+)?class\s+\w+/m, type: 'code' as const },
      { pattern: /^(?:export\s+)?(?:type|interface|enum)\s+\w+/m, type: 'code' as const },
      { pattern: /^\s*\/\*\*[\s\S]*?\*\//m, type: 'documentation' as const },
      { pattern: /^\s*\/\/.*$/m, type: 'comment' as const },
      { pattern: /^import\s+.*from/m, type: 'import' as const },
      { pattern: /^export\s+(?!default)/m, type: 'export' as const }
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunkLines.push(line);

      let lineType: DocumentChunk['metadata']['type'] = 'code';
      
      for (const { pattern, type } of codeBlockPatterns) {
        if (pattern.test(line)) {
          lineType = type;
          
          if (type === 'code') {
            const symbolMatch = line.match(/(?:function|class|interface|type|enum)\s+(\w+)/);
            if (symbolMatch) {
              currentSymbols.push(symbolMatch[1]);
            }
          }
          break;
        }
      }

      if (lineType !== currentType || currentChunkLines.length >= this.options.maxChunkSize) {
        if (currentChunkLines.length > 0) {
          const chunkContent = currentChunkLines.join('\n');
          
          if (chunkContent.trim().length > 0) {
            chunks.push({
              id: `chunk-${filePath}-${chunks.length}-${Date.now()}`,
              content: chunkContent,
              metadata: {
                filePath,
                startLine: currentStartLine,
                endLine: i,
                language,
                type: currentType,
                symbols: [...currentSymbols]
              },
              vector: { dimensions: [] }
            });
          }
        }

        if (this.options.overlapSize > 0 && chunks.length > 0) {
          const overlapLines = currentChunkLines.slice(-this.options.overlapSize);
          currentChunkLines = [...overlapLines];
          currentStartLine = i - this.options.overlapSize + 2;
        } else {
          currentChunkLines = [];
          currentStartLine = i + 2;
        }
        
        currentType = lineType;
        if (lineType === 'code') {
          currentSymbols = [];
          const symbolMatch = line.match(/(?:function|class|interface|type|enum)\s+(\w+)/);
          if (symbolMatch) {
            currentSymbols.push(symbolMatch[1]);
          }
        }
      }
    }

    if (currentChunkLines.length > 0) {
      const chunkContent = currentChunkLines.join('\n');
      
      if (chunkContent.trim().length > 0) {
        chunks.push({
          id: `chunk-${filePath}-${chunks.length}-${Date.now()}`,
          content: chunkContent,
          metadata: {
            filePath,
            startLine: currentStartLine,
            endLine: lines.length,
            language,
            type: currentType,
            symbols: currentSymbols
          },
          vector: { dimensions: [] }
        });
      }
    }

    return chunks;
  }

  private chunkBySize(
    content: string,
    filePath: string,
    language: string
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const words = content.split(/\s+/);
    
    for (let i = 0; i < words.length; i += this.options.maxChunkSize) {
      const chunkWords = words.slice(i, i + this.options.maxChunkSize);
      const chunkContent = chunkWords.join(' ');

      if (chunkContent.trim().length > 0) {
        const startChar = content.indexOf(chunkContent);
        const startLine = content.substring(0, startChar).split('\n').length;
        const endLine = startLine + chunkContent.split('\n').length - 1;

        chunks.push({
          id: `chunk-${filePath}-${chunks.length}-${Date.now()}`,
          content: chunkContent,
          metadata: {
            filePath,
            startLine,
            endLine,
            language,
            type: 'code',
            symbols: []
          },
          vector: { dimensions: [] }
        });
      }
    }

    return chunks;
  }

  mergeChunks(chunks: DocumentChunk[], contextSize: number = 100): string {
    return chunks
      .map(chunk => chunk.content)
      .join('\n\n---\n\n');
  }

  getStats(): { totalChunks: number; avgChunkSize: number; languages: Record<string, number> } {
    return {
      totalChunks: 0,
      avgChunkSize: 0,
      languages: {}
    };
  }
}