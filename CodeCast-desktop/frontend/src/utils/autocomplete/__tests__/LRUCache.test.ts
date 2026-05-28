import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LRUCache } from '../LRUCache';

describe('LRUCache', () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache<string, number>(3);
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update existing keys', () => {
      cache.set('a', 1);
      cache.set('a', 2);
      expect(cache.get('a')).toBe(2);
    });
  });

  describe('Capacity Management', () => {
    it('should evict least recently used item when at capacity', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.set('d', 4);

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should not evict items when under capacity', () => {
      cache.set('a', 1);
      cache.set('b', 2);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
    });
  });

  describe('LRU Behavior', () => {
    it('should move accessed item to most recent', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.get('a');

      cache.set('d', 4);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('Delete Operation', () => {
    it('should delete items', () => {
      cache.set('a', 1);
      cache.delete('a');

      expect(cache.get('a')).toBeUndefined();
    });

    it('should handle deleting non-existent items', () => {
      expect(() => cache.delete('nonexistent')).not.toThrow();
    });
  });

  describe('Clear Operation', () => {
    it('should clear all items', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('Size Tracking', () => {
    it('should track size correctly', () => {
      expect(cache.size).toBe(0);

      cache.set('a', 1);
      expect(cache.size).toBe(1);

      cache.set('b', 2);
      expect(cache.size).toBe(2);
    });
  });
});
