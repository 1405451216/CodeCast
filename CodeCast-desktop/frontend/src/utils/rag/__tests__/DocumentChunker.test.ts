import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentChunker } from '../DocumentChunker';

describe('DocumentChunker', () => {
  let chunker: DocumentChunker;

  beforeEach(() => {
    chunker = new DocumentChunker();
  });

  describe('Basic Chunking', () => {
    it('should split text into chunks', () => {
      const text = 'This is a test document for chunking. It should be split into multiple parts based on the configuration.';
      const chunks = chunker.chunkDocument(text, 'test.txt', 'plaintext');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.content.length > 0)).toBe(true);
    });

    it('should handle empty text', () => {
      const chunks = chunker.chunkDocument('', 'empty.txt', 'plaintext');

      expect(chunks).toHaveLength(0);
    });

    it('should handle text shorter than chunk size', () => {
      const text = 'Short text';
      const chunks = chunker.chunkDocument(text, 'short.txt', 'plaintext');

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Chunk Size Configuration', () => {
    it('should respect custom chunk size', () => {
      const customChunker = new DocumentChunker({ maxChunkSize: 100, overlapSize: 20 });
      const longText = 'a'.repeat(300);
      const chunks = customChunker.chunkDocument(longText, 'long.txt', 'plaintext');

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Metadata', () => {
    it('should include metadata in chunks', () => {
      const text = 'Test document content';
      const chunks = chunker.chunkDocument(text, 'test.md', 'markdown');

      chunks.forEach((chunk) => {
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.filePath).toBe('test.md');
        expect(chunk.metadata.language).toBe('markdown');
      });
    });

    it('should track line numbers', () => {
      const text = `Line one.
Line two.
Line three.`;
      const chunks = chunker.chunkDocument(text, 'lines.txt', 'plaintext');

      if (chunks.length > 0) {
        chunks.forEach((chunk) => {
          expect(chunk.metadata.startLine).toBeDefined();
          expect(chunk.metadata.endLine).toBeDefined();
          expect(typeof chunk.metadata.startLine).toBe('number');
          expect(typeof chunk.metadata.endLine).toBe('number');
        });
      }
    });
  });

  describe('Code Structure Detection', () => {
    it('should detect function definitions in code', () => {
      const code = `
function testFunction() {
  console.log('hello');
}

export function anotherFunction() {
  return true;
}
`;
      const chunks = chunker.chunkDocument(code, 'code.ts', 'typescript');

      expect(chunks.length).toBeGreaterThan(0);

      const hasCodeChunk = chunks.some(c => c.metadata.type === 'code');
      expect(hasCodeChunk).toBe(true);
    });

    it('should detect class definitions', () => {
      const code = `
class TestClass {
  private name: string;
  
  constructor() {
    this.name = 'test';
  }
}
`;
      const chunks = chunker.chunkDocument(code, 'class.ts', 'typescript');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should detect comments and documentation', () => {
      const code = `
/**
 * This is documentation
 * for a function
 */
// This is a comment
const x = 1;
`;
      const chunks = chunker.chunkDocument(code, 'docs.ts', 'typescript');

      expect(chunks.length).toBeGreaterThan(0);

      const hasDocOrComment = chunks.some(
        c => c.metadata.type === 'documentation' || c.metadata.type === 'comment'
      );
      expect(hasDocOrComment).toBe(true);
    });
  });

  describe('Special Cases', () => {
    it('should handle whitespace-only text', () => {
      const text = '   \n\n   \t\t   ';
      const chunks = chunker.chunkDocument(text, 'whitespace.txt', 'plaintext');

      expect(chunks.length).toBeLessThanOrEqual(1);
    });

    it('should preserve original content integrity', () => {
      const text = 'Important document that must not lose any information';
      const chunks = chunker.chunkDocument(text, 'important.txt', 'plaintext');

      if (chunks.length > 0) {
        const reconstructed = chunks.map(c => c.content).join('');
        expect(reconstructed.replace(/\s/g, '')).toContain(text.replace(/\s/g, ''));
      }
    });
  });
});
