// frontend/src/v2/store/bootstrap.ts
//
// Single source of truth for what the App loads on startup. Each loader
// is best-effort — failures are surfaced via the slice's error state
// (e.g. errors.cost, errors.plugin) and never block the UI.
//
// New loaders can be added by appending a thunk and awaiting it from
// `bootstrap()`.

import type { AppState } from './index';

/**
 * Each entry is `(state) => Promise<unknown>`. They are awaited in order;
 * the second argument `parallel: true` would fan them out — we use
 * sequential to keep backend traffic predictable at startup.
 */
type Loader = (s: AppState) => Promise<unknown>;

/** Loaders considered critical for first paint. */
const CRITICAL: Loader[] = [
  (s) => s.loadSessions(),
  (s) => s.loadModels(),
  (s) => s.loadProjects(),
  (s) => s.loadSettings(),
  (s) => s.loadCastTools(),
  (s) => s.refreshGit(),
];

/** Loaders that can run after first paint. Today we run them all in sequence
 * because they are cheap and we want predictable test ordering. If any
 * becomes slow (e.g. cost.summary against a large log), move it here. */
const DEFERRED: Loader[] = [
  (s) => s.refreshCost(),
  (s) => s.refreshPlugins(),
  (s) => s.refreshVersion(),
  (s) => s.refreshBudget(),
  (s) => s.refreshSecurity(),
  (s) => s.refreshTelemetry(),
];

/**
 * Bootstrap the store. Called once from `<App>` on mount.
 *
 * Order matters: critical first (sessions, models, projects, settings,
 * tools, git), then everything else.
 */
export async function bootstrapStore(state: AppState): Promise<void> {
  for (const run of CRITICAL) {
    await run(state);
  }
  for (const run of DEFERRED) {
    await run(state);
  }
}
