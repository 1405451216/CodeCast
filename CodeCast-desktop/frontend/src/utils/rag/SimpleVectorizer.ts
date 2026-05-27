export interface Vector {
  dimensions: number[];
  magnitude?: number;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    filePath: string;
    startLine: number;
    endLine: number;
    language: string;
    type: 'code' | 'comment' | 'documentation' | 'import' | 'export';
    symbols: string[];
  };
  vector: Vector;
  embedding?: number[];
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  relevance: 'high' | 'medium' | 'low';
  highlightedContent?: string;
}

export class SimpleVectorizer {
  private vocabulary: Map<string, number> = new Map();
  private idfCache: Map<string, number> = new Map();
  private documentCount = 0;

  buildVocabulary(documents: string[]): void {
    this.vocabulary.clear();
    
    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      const uniqueTokens = [...new Set(tokens)];
      
      for (const token of uniqueTokens) {
        const count = this.vocabulary.get(token) || 0;
        this.vocabulary.set(token, count + 1);
      }
      
      this.documentCount++;
    }

    this.vocabulary.forEach((count, token) => {
      this.idfCache.set(token, Math.log(this.documentCount / (1 + count)) + 1);
    });
  }

  vectorize(text: string): Vector {
    const tokens = this.tokenize(text);
    const termFreq: Map<string, number> = new Map();

    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    const maxFreq = Math.max(...termFreq.values(), 1);

    const dimensions: number[] = [];
    
    for (let i = 0; i < Math.min(this.vocabulary.size, 512); i++) {
      const token = Array.from(this.vocabulary.keys())[i];
      const tf = (termFreq.get(token) || 0) / maxFreq;
      const idf = this.idfCache.get(token) || 1;
      dimensions.push(tf * idf);
    }

    return { dimensions };
  }

  cosineSimilarity(vecA: Vector, vecB: Vector): number {
    if (vecA.dimensions.length !== vecB.dimensions.length) return 0;

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < vecA.dimensions.length; i++) {
      dotProduct += vecA.dimensions[i] * vecB.dimensions[i];
      magA += vecA.dimensions[i] * vecA.dimensions[i];
      magB += vecB.dimensions[i] * vecB.dimensions[i];
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;

    return dotProduct / (magA * magB);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1 && !this.isStopWord(token));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
      'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must',
      'this', 'that', 'these', 'those', 'it', 'its', 'as', 'if',
      'then', 'than', 'so', 'no', 'not', 'only', 'same', 'also'
    ]);
    return stopWords.has(word);
  }
}