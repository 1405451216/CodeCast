import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatContent,
  formatFileSize,
  formatDate,
  debounce,
  throttle
} from '../../utils';

describe('Utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatContent', () => {
    it('should format markdown to HTML', () => {
      const markdown = '# Hello\n\nThis is **bold** text.';
      const html = formatContent(markdown);

      expect(html).toContain('<h1');
      expect(html).toContain('Hello');
      expect(html).toContain('<strong');
      expect(html).toContain('bold');
    });

    it('should handle empty content', () => {
      const html = formatContent('');
      expect(html).toBe('');
    });

    it('should handle null/undefined content', () => {
      const html1 = formatContent(null as any);
      const html2 = formatContent(undefined as any);
      expect(html1).toBe('');
      expect(html2).toBe('');
    });

    it('should sanitize HTML to prevent XSS', () => {
      const malicious = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
      const sanitized = formatContent(malicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror');
    });

    it('should render code blocks with syntax highlighting', () => {
      const code = '```javascript\nconst x = 1;\n```';
      const html = formatContent(code);

      expect(html).toContain('<pre');
      expect(html).toContain('<code');
      expect(html).toContain('language-javascript');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('should handle zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });
  });

  describe('formatDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle null/undefined timestamp', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });

    it('should format recent timestamps as "刚刚"', () => {
      const now = Date.now() / 1000;
      expect(formatDate(now)).toContain('刚刚');
    });

    it('should format minutes ago', () => {
      const fiveMinAgo = (Date.now() / 1000) - 300;
      expect(formatDate(fiveMinAgo)).toContain('分钟前');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = (Date.now() / 1000) - 7200;
      expect(formatDate(twoHoursAgo)).toContain('小时前');
    });

    it('should format days ago', () => {
      const threeDaysAgo = (Date.now() / 1000) - 259200;
      expect(formatDate(threeDaysAgo)).toContain('天前');
    });
  });

  describe('debounce', () => {
    vi.useFakeTimers();

    it('should delay function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous call on rapid invocation', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(300);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const fn = vi.fn((a: number, b: number) => a + b);
      const debouncedFn = debounce(fn, 100);

      debouncedFn(2, 3);
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith(2, 3);
    });
  });

  describe('throttle', () => {
    vi.useFakeTimers();

    it('should limit function calls', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should allow one call immediately', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
