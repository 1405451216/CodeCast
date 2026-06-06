export interface StreamBuffer { push: (chunk: string) => void; onFlush: (s: string) => void; dispose: () => void; }
export function createStreamBuffer(opts: { flushSize: number; flushIntervalMs: number }): StreamBuffer {
  let pending = '';
  let timer: ReturnType<typeof setInterval> | null = null;
  const buf: StreamBuffer = {
    push(chunk: string) { pending += chunk; if (pending.length >= opts.flushSize) { buf.onFlush(pending); pending = ''; } },
    onFlush: () => {},
    dispose() { if (timer) clearInterval(timer); pending = ''; },
  };
  if (typeof setInterval !== 'undefined') {
    timer = setInterval(() => { if (pending) { buf.onFlush(pending); pending = ''; } }, opts.flushIntervalMs);
  }
  return buf;
}
export function flushBuffer(chunks: string[]): string { return chunks.join(''); }
