// frontend/src/v2/lib/useFirstTool.ts
//
// Picks the first available Cast tool for a given category from the store.
// Returns `null` (not a magic fallback string) when no tool is registered,
// so callers can show a disabled "no tool available" UX instead of trying
// to invoke a tool name that doesn't exist in the backend catalog.

import { useAppStore } from '../store';
import type { ToolCatalogItem } from '../wails/types';

export interface FirstToolState {
  /** The first tool in this category, or `null` if none registered. */
  tool: ToolCatalogItem | null;
  /** `true` when the category has at least one tool. */
  available: boolean;
  /** All tools in this category (may be empty). */
  tools: ToolCatalogItem[];
  /** `true` while the catalog is being fetched. */
  loading: boolean;
  /** Trigger an on-demand catalog refresh. */
  load: () => Promise<void>;
}

export function useFirstTool(category: string): FirstToolState {
  const castToolByCategory = useAppStore((s) => s.castToolByCategory);
  const castToolLoading = useAppStore((s) => s.castToolLoading);
  const loadCastTools = useAppStore((s) => s.loadCastTools);

  const tools = castToolByCategory[category] ?? [];
  const tool = tools[0] ?? null;

  return {
    tool,
    available: tool !== null,
    tools,
    loading: castToolLoading,
    load: loadCastTools,
  };
}
