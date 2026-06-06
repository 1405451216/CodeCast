import { useState } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import 'highlight.js/styles/github.css';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('jsx', typescript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);

interface Props { code: string; language?: string }
export function CodeBlock({ code, language = 'plaintext' }: Props) {
  const [copied, setCopied] = useState(false);
  let highlighted = code;
  try {
    if (language !== 'plaintext' && hljs.getLanguage(language)) {
      highlighted = hljs.highlight(code, { language }).value;
    }
  } catch { /* fallback to raw */ }
  return <div style={{ border: '1px solid var(--c-border)', borderRadius: 6, background: 'var(--c-bgSub)', margin: '8px 0', overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--c-border)', fontSize: 11, color: 'var(--c-textMute)' }}>
      <span>{language}</span>
      <div style={{ flex: 1 }} />
      <button type="button" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>{copied ? '✓ 已复制' : 'Copy'}</button>
    </div>
    <pre style={{ margin: 0, padding: 12, fontSize: 13, overflow: 'auto' }}>
      <code className={`hljs language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  </div>;
}
