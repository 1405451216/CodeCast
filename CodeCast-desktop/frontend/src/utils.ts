import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const customRenderer = new marked.Renderer();

customRenderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  const copyId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? `copy-${crypto.randomUUID().slice(0, 8)}`
    : `copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return `<div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-lang">${language}</span>
      <button class="copy-code-btn" data-copy-id="${copyId}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        复制
      </button>
    </div>
    <pre><code id="${copyId}" class="hljs language-${language}">${highlighted}</code></pre>
  </div>`;
};

marked.use({ renderer: customRenderer });

declare global {
  interface Window {
    copyCode: (btn: HTMLElement) => void;
  }
}

// Global side effect at module load: by design for Wails, which requires
// window.copyCode to be accessible from dynamically rendered HTML buttons.
window.copyCode = function (btn: HTMLElement) {
  const copyId = btn.getAttribute('data-copy-id');
  const codeEl = document.getElementById(copyId || '');
  if (codeEl) {
    navigator.clipboard.writeText(codeEl.textContent || '').then(() => {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg> 已复制`;
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('copied');
      }, 2000);
    });
  }
};

// Event delegation for copy-code-btn clicks (no inline onclick needed)
document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  const btn = target.closest('.copy-code-btn') as HTMLElement | null;
  if (btn) {
    window.copyCode(btn);
  }
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
    // Block javascript: and data: URI schemes to prevent XSS
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
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
