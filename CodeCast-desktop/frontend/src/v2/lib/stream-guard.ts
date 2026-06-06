export interface StreamGuard { start: () => void; reset: () => void; dispose: () => void; }
export function createStreamGuard(opts: { timeoutMs: number; onTimeout: () => void }): StreamGuard {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => { if (timer) clearTimeout(timer); timer = setTimeout(opts.onTimeout, opts.timeoutMs); };
  return { start: arm, reset: arm, dispose() { if (timer) { clearTimeout(timer); timer = null; } } };
}
