/**
 * Shared type for the `set` function passed to each Zustand slice creator.
 *
 * This avoids circular imports (slices don't need to import AppState) while
 * still providing meaningful type-safety: callers must pass an object or an
 * updater function that returns an object — never a raw non-object value.
 */
export type SliceSet = (
  partial:
    | Record<string, unknown>
    | ((state: Record<string, unknown>) => Record<string, unknown>),
) => void;
