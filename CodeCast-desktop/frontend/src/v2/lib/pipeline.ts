/**
 * Send a result text to another Cast page via sessionStorage.
 * The target page reads it on mount and clears it.
 */
export function sendToPage(targetPath: string, text: string) {
  try {
    sessionStorage.setItem(`codecast-pipeline:${targetPath}`, text);
  } catch { /* ignore */ }
}

/**
 * Read and clear a piped result from another page.
 */
export function readPipedText(currentPath: string): string | null {
  try {
    const key = `codecast-pipeline:${currentPath}`;
    const val = sessionStorage.getItem(key);
    if (val) {
      sessionStorage.removeItem(key);
      return val;
    }
  } catch { /* ignore */ }
  return null;
}

/** Available pipeline targets */
export const PIPELINE_TARGETS = [
  { path: '/cast/writing', label: '写作助手' },
  { path: '/cast/translation', label: '翻译' },
  { path: '/cast/email', label: '邮件草稿' },
  { path: '/cast/knowledge', label: '知识库' },
] as const;
