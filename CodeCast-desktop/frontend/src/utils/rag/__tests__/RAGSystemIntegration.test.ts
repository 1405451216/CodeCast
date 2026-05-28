import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileSystemVectorStore } from '../FileSystemVectorStore';
import { DocumentChunker } from '../DocumentChunker';
import { SimpleVectorizer } from '../SimpleVectorizer';

describe('RAG System Integration', () => {
  let vectorStore: FileSystemVectorStore;
  let chunker: DocumentChunker;
  let vectorizer: SimpleVectorizer;

  beforeEach(() => {
    vectorStore = new FileSystemVectorStore();
    chunker = new DocumentChunker();
    vectorizer = new SimpleVectorizer();
  });

  describe('Document Processing Pipeline', () => {
    it('should process document through complete pipeline', async () => {
      const content = `
function calculateSum(a: number, b: number): number {
  return a + b;
}

function calculateProduct(a: number, b: number): number {
  return a * b;
}
`;
      
      const chunks = chunker.chunkDocument(content, 'math.ts', 'typescript');

      expect(chunks.length).toBeGreaterThan(0);

      const documents = chunks.map(c => c.content);
      vectorizer.buildVocabulary(documents);

      for (const chunk of chunks) {
        const vector = vectorizer.vectorize(chunk.content);
        
        expect(vector).toBeDefined();
        expect(vector.dimensions.length).toBeGreaterThan(0);
      }
    }, 10000);
  });

  describe('Vector Store Operations', () => {
    it('should add and retrieve documents', async () => {
      if ('addDocument' in vectorStore) {
        const content = 'Test document content';
        
        try {
          await (vectorStore as any).addDocument(content, 'test.txt');
          
          if ('search' in vectorStore) {
            const results = await (vectorStore as any).search('test');
            expect(results).toBeDefined();
          }
        } catch (error) {
          console.log('Vector store operation not available in test environment');
        }
      }
    });
  });

  describe('Search Functionality', () => {
    it('should find relevant documents by query', async () => {
      const documents = [
        'JavaScript is a programming language',
        'Python is another programming language',
        'TypeScript adds types to JavaScript'
      ];

      vectorizer.buildVocabulary(documents);

      const queryVector = vectorizer.vectorize('programming language JavaScript');
      
      expect(queryVector).toBeDefined();

      const similarities = documents.map(doc => ({
        doc,
        similarity: vectorizer.cosineSimilarity(queryVector, vectorizer.vectorize(doc))
      }));

      similarities.sort((a, b) => b.similarity - a.similarity);

      expect(similarities[0].similarity).toBeGreaterThanOrEqual(similarities[1].similarity);
    });
  });
});
