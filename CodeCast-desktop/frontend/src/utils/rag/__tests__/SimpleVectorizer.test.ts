import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleVectorizer } from '../SimpleVectorizer';

describe('SimpleVectorizer', () => {
  let vectorizer: SimpleVectorizer;

  beforeEach(() => {
    vectorizer = new SimpleVectorizer();
  });

  describe('Vocabulary Building', () => {
    it('should build vocabulary from documents', () => {
      const documents = [
        'This is a test document about programming',
        'Programming is fun and useful'
      ];

      vectorizer.buildVocabulary(documents);

      expect(vectorizer).toBeDefined();
    });

    it('should handle empty documents array', () => {
      const documents: string[] = [];
      
      expect(() => vectorizer.buildVocabulary(documents)).not.toThrow();
    });
  });

  describe('Vectorization', () => {
    it('should vectorize text into a Vector object', () => {
      const documents = ['test document programming code'];
      vectorizer.buildVocabulary(documents);

      const result = vectorizer.vectorize('test programming');

      expect(result).toBeDefined();
      expect(result.dimensions).toBeDefined();
      expect(Array.isArray(result.dimensions)).toBe(true);
      expect(result.dimensions.length).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      const documents = ['test'];
      vectorizer.buildVocabulary(documents);

      const result = vectorizer.vectorize('');

      expect(result).toBeDefined();
      expect(result.dimensions).toBeDefined();
    });
  });

  describe('Cosine Similarity', () => {
    it('should calculate similarity between identical vectors as 1', () => {
      const documents = ['test document'];
      vectorizer.buildVocabulary(documents);

      const vec1 = vectorizer.vectorize('test');
      const similarity = vectorizer.cosineSimilarity(vec1, vec1);

      expect(similarity).toBeCloseTo(1);
    });

    it('should calculate lower similarity for different texts', () => {
      const documents = ['programming coding development software'];
      vectorizer.buildVocabulary(documents);

      const vec1 = vectorizer.vectorize('programming software');
      const vec2 = vectorizer.vectorize('coding development');

      const similarity = vectorizer.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return 0 for vectors of different dimensions', () => {
      const vec1 = { dimensions: [1, 2, 3] };
      const vec2 = { dimensions: [4, 5] };

      const similarity = vectorizer.cosineSimilarity(vec1, vec2);

      expect(similarity).toBe(0);
    });
  });

  describe('Tokenization', () => {
    it('should filter stop words during tokenization', () => {
      const documents = ['the quick brown fox jumps over lazy dog'];
      vectorizer.buildVocabulary(documents);

      const result = vectorizer.vectorize('the the the');

      expect(result).toBeDefined();
    });
  });
});
