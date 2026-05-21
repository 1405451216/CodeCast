export function escHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatContent(text: string | null | undefined): string {
  if (!text) return '';

  // 1. Extract code blocks BEFORE any escaping
  const codeBlocks: string[] = [];
  let processed = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code class="language-${lang || ''}">${escHtml(code)}</code></pre>`);
    return `\x00CODEBLOCK_${idx}\x00`;
  });

  // 2. Extract inline code
  const inlineCodes: string[] = [];
  processed = processed.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escHtml(code)}</code>`);
    return `\x00INLINE_${idx}\x00`;
  });

  // 3. Escape remaining HTML
  let result = escHtml(processed);

  // 4. Apply paragraph/line breaks
  result = result.replace(/\n\n/g, '</p><p>');
  result = result.replace(/\n/g, '<br>');

  // 5. Apply inline formatting
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 6. Restore code blocks and inline codes
  result = result.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_m, idx) => codeBlocks[parseInt(idx)]);
  result = result.replace(/\x00INLINE_(\d+)\x00/g, (_m, idx) => inlineCodes[parseInt(idx)]);

  return '<p>' + result + '</p>';
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
