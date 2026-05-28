import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FuzzyMatcher } from '../FuzzyMatcher';

describe('FuzzyMatcher', () => {
  describe('Basic Matching', () => {
    it('should find exact match', () => {
      const result = FuzzyMatcher.match('test', 'test');

      expect(result).toBeDefined();
      expect(result).toBeTruthy();
    });

    it('should return null for no match', () => {
      const result = FuzzyMatcher.match('xyz', 'abc');

      expect(result).toBeNull();
    });

    it('should handle empty query', () => {
      const result = FuzzyMatcher.match('', 'test');

      expect(result).toBeNull();
    });

    it('should handle case insensitive matching', () => {
      const result = FuzzyMatcher.match('TEST', 'test');

      expect(result).toBeDefined();
      expect(result).toBeTruthy();
    });
  });

  describe('Scoring and Ranking', () => {
    it('should rank exact matches higher than fuzzy matches', () => {
      const items = ['test', 'testing', 'attest'];
      const results = items
        .map(item => ({ item, result: FuzzyMatcher.match('test', item) }))
        .filter(({ result }) => result !== null)
        .sort((a, b) => (b.result?.score || 0) - (a.result?.score || 0));

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item).toBe('test');
    });

    it('should rank shorter matches higher for same score', () => {
      const items = ['ab', 'abc', 'abcd'];
      const results = items
        .map(item => ({ item, result: FuzzyMatcher.match('ab', item) }))
        .filter(({ result }) => result !== null)
        .sort((a, b) => (b.result?.score || 0) - (a.result?.score || 0));

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item).toBe('ab');
    });
  });

  describe('Special Characters', () => {
    it('should handle special characters in query', () => {
      const items = ['file.txt', 'file.csv', 'data-file.json'];
      const results = items
        .map(item => ({ item, result: FuzzyMatcher.match('.txt', item) }))
        .filter(({ result }) => result !== null);

      expect(results.some(r => r.item === 'file.txt')).toBe(true);
    });

    it('should handle spaces in items', () => {
      const items = ['hello world', 'helloworld', 'hello_world'];
      const results = items
        .map(item => ({ item, result: FuzzyMatcher.match('hello world', item) }))
        .filter(({ result }) => result !== null);

      expect(results.some(r => r.item === 'hello world')).toBe(true);
    });
  });

  describe('Unicode Support', () => {
    it('should handle unicode characters', () => {
      const items = ['你好世界', '你好', '世界'];
      const results = items
        .map(item => ({ item, result: FuzzyMatcher.match('你好', item) }))
        .filter(({ result }) => result !== null);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Filter Functionality', () => {
    it('should filter and sort items correctly', () => {
      interface TestItem { name: string; value: number }
      const items: TestItem[] = [
        { name: 'apple', value: 1 },
        { name: 'application', value: 2 },
        { name: 'banana', value: 3 },
        { name: 'apply', value: 4 }
      ];

      const results = FuzzyMatcher.filter(items, 'app', item => item.name);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toContain('app');
    });
  });

  describe('Performance', () => {
    it('should handle large item lists efficiently', () => {
      const items = Array.from({ length: 10000 }, (_, i) => `item-${i}`);

      const startTime = performance.now();
      const results = items
        .map(item => FuzzyMatcher.match('item-5000', item))
        .filter(r => r !== null);
      const endTime = performance.now();

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(endTime - startTime).toBeLessThan(1000);
    }, 10000);
  });
});
