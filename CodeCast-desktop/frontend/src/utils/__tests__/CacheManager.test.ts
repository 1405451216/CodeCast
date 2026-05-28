import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheManager } from '../performance/CacheManager';

describe('CacheManager', () => {
  beforeEach(async () => {
    try {
      await cacheManager.clear();
    } catch (error) {
      console.warn('Cache clear failed:', error);
    }
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await cacheManager.set('test-key', 'test-value');
      const result = await cacheManager.get<string>('test-key');

      expect(result).toBe('test-value');
    }, 10000);

    it('should return null for non-existent key', async () => {
      const result = await cacheManager.get<string>('non-existent');

      expect(result).toBeNull();
    }, 10000);

    it('should update existing key', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key1', 'value2');

      const result = await cacheManager.get<string>('key1');
      expect(result).toBe('value2');
    }, 10000);

    it('should delete a key', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.delete('key1');

      const result = await cacheManager.get<string>('key1');
      expect(result).toBeNull();
    }, 10000);

    it('should clear all keys', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.clear();

      const result1 = await cacheManager.get('key1');
      const result2 = await cacheManager.get('key2');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    }, 10000);
  });

  describe('Has Method', () => {
    it('should return true for existing key', async () => {
      await cacheManager.set('exists-key', 'value');

      const exists = await cacheManager.has('exists-key');
      expect(exists).toBe(true);
    }, 10000);

    it('should return false for non-existing key', async () => {
      const exists = await cacheManager.has('non-existent');
      expect(exists).toBe(false);
    }, 10000);
  });

  describe('Statistics', () => {
    it('should track hit count', async () => {
      await cacheManager.set('stat-key', 'value');

      await cacheManager.get('stat-key');
      await cacheManager.get('stat-key');
      await cacheManager.get('stat-key');

      const stats = cacheManager.getStats();
      expect(stats.hitCount).toBe(3);
    }, 10000);

    it('should track miss count', async () => {
      await cacheManager.get('miss-1');
      await cacheManager.get('miss-2');
      await cacheManager.get('miss-3');

      const stats = cacheManager.getStats();
      expect(stats.missCount).toBe(3);
    }, 10000);

    it('should calculate hit rate correctly', async () => {
      await cacheManager.set('hit-key', 'value');

      for (let i = 0; i < 7; i++) {
        await cacheManager.get('hit-key');
      }
      for (let i = 0; i < 3; i++) {
        await cacheManager.get('miss-key');
      }

      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(70);
    }, 10000);

    it('should track memory item count', async () => {
      await cacheManager.set('item1', 'value1');
      await cacheManager.set('item2', 'value2');
      await cacheManager.set('item3', 'value3');

      const stats = cacheManager.getStats();
      expect(stats.memoryItemCount).toBe(3);
    }, 10000);
  });

  describe('Data Types', () => {
    it('should handle string values', async () => {
      await cacheManager.set('str', 'string value');
      expect(await cacheManager.get<string>('str')).toBe('string value');
    }, 10000);

    it('should handle number values', async () => {
      await cacheManager.set('num', 42);
      expect(await cacheManager.get<number>('num')).toBe(42);
    }, 10000);

    it('should handle boolean values', async () => {
      await cacheManager.set('bool', true);
      expect(await cacheManager.get<boolean>('bool')).toBe(true);
    }, 10000);

    it('should handle object values', async () => {
      const obj = { name: 'test', value: 123 };
      await cacheManager.set('obj', obj);
      const result = await cacheManager.get('obj');
      expect(result).toBeDefined();
      expect(result).toBeTruthy();
    }, 10000);

    it('should handle array values', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cacheManager.set('arr', arr);
      const result = await cacheManager.get('arr');
      expect(result).toBeDefined();
      expect(result).toBeTruthy();
    }, 10000);

    it('should handle null values', async () => {
      await cacheManager.set('null-val', null);
      expect(await cacheManager.get('null-val')).toBeNull();
    }, 10000);
  });
});
