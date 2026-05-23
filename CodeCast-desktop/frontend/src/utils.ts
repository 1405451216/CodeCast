import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,       // Convert \n to <br>
  gfm: true,         // GitHub Flavored Markdown
});

/**
 * Convert markdown content to safe HTML.
 * Security model: marked converts markdown → HTML, then DOMPurify sanitizes
 * to remove any XSS vectors. This is the industry-standard approach.
 */
export function formatContent(content: string): string {
  if (!content) return '';

  // marked.parse can return string | Promise<string> in v12+
  // Use marked.parse synchronously
  const rawHtml = marked.parse(content, { async: false }) as string;

  // Sanitize with DOMPurify - allow safe HTML only
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'hr', 'del', 'sup', 'sub', 'span', 'div',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
    // Force links to open in new tab
    ADD_ATTR: ['target'],
  });

  return cleanHtml;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  const d = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';

  return d.toLocaleDateString('zh-CN');
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(fn: T, limit = 100) {
  let inThrottle = false;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
