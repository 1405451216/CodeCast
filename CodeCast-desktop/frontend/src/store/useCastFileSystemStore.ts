import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { FileSystemEntry } from '../utils/cast/cast-fs-api';
import { castFS } from '../utils/cast/cast-fs-api';

interface RecentFileItem {
  path: string;
  name: string;
  accessedAt: number;
  size: number;
}

interface ClipboardData {
  files: string[];
  operation: 'copy' | 'cut' | null;
}

interface CastFileSystemState {
  currentPath: string;
  history: string[];
  historyIndex: number;
  selectedFiles: Set<string>;
  clipboard: ClipboardData | null;
  recentFiles: RecentFileItem[];
  bookmarks: string[];
  currentEntries: FileSystemEntry[];
  isLoading: boolean;
  error: string | null;

  navigateTo: (path: string) => Promise<FileSystemEntry[]>;
  goBack: () => string | null;
  goForward: () => string | null;
  goToParent: () => Promise<string>;

  selectFile: (path: string, multi?: boolean) => void;
  deselectFile: (path: string) => void;
  clearSelection: () => void;
  selectAll: (files: string[]) => void;

  copyFiles: (paths: string[]) => void;
  cutFiles: (paths: string[]) => void;
  paste: (targetPath: string) => Promise<void>;

  addBookmark: (path: string) => void;
  removeBookmark: (path: string) => void;

  addRecentFile: (file: { path: string; name: string; size: number }) => void;
  clearRecentFiles: () => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  loadFromStorage: () => void;
  saveToStorage: () => void;
}

const RECENT_STORAGE_KEY = 'cast_fs_recent';
const BOOKMARKS_STORAGE_KEY = 'cast_fs_bookmarks';
const MAX_RECENT_FILES = 20;

function normalizePath(p: string): string {
  return p.replace(/[/\\]+$/, '').replace(/\\/g, '/');
}

export const useCastFileSystemStore = create<CastFileSystemState>()(
  devtools(
    (set, get) => ({
      currentPath: '.',
      history: ['.'],
      historyIndex: 0,
      selectedFiles: new Set(),
      clipboard: null,
      recentFiles: [],
      bookmarks: [],
      currentEntries: [],
      isLoading: false,
      error: null,

      navigateTo: async (path: string) => {
        const normalizedPath = normalizePath(path);
        set({ isLoading: true, error: null });

        try {
          const entries = await castFS.listDirectory(normalizedPath);
          const { history, historyIndex } = get();
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(normalizedPath);

          set({
            currentPath: normalizedPath,
            currentEntries: entries,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            selectedFiles: new Set(),
            isLoading: false
          });

          return entries;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          set({ error: msg, isLoading: false });
          return [];
        }
      },

      goBack: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return null;
        const newIndex = historyIndex - 1;
        const targetPath = history[newIndex];
        set({ historyIndex: newIndex, currentPath: targetPath });
        get().navigateTo(targetPath);
        return targetPath;
      },

      goForward: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return null;
        const newIndex = historyIndex + 1;
        const targetPath = history[newIndex];
        set({ historyIndex: newIndex, currentPath: targetPath });
        get().navigateTo(targetPath);
        return targetPath;
      },

      goToParent: async () => {
        const { currentPath } = get();
        const parts = currentPath.replace(/\\/g, '/').split('/').filter(Boolean);
        parts.pop();
        const parentPath = parts.length > 0 ? '/' + parts.join('/') : '.';
        await get().navigateTo(parentPath);
        return parentPath;
      },

      selectFile: (path: string, multi?: boolean) => {
        if (multi) {
          set((state) => {
            const next = new Set(state.selectedFiles);
            if (next.has(path)) {
              next.delete(path);
            } else {
              next.add(path);
            }
            return { selectedFiles: next };
          });
        } else {
          set({ selectedFiles: new Set([path]) });
        }
      },

      deselectFile: (path: string) => {
        set((state) => {
          const next = new Set(state.selectedFiles);
          next.delete(path);
          return { selectedFiles: next };
        });
      },

      clearSelection: () => set({ selectedFiles: new Set() }),

      selectAll: (files: string[]) => set({ selectedFiles: new Set(files) }),

      copyFiles: (paths: string[]) => set({
        clipboard: { files: paths, operation: 'copy' }
      }),

      cutFiles: (paths: string[]) => set({
        clipboard: { files: paths, operation: 'cut' }
      }),

      paste: async (targetPath: string) => {
        const { clipboard } = get();
        if (!clipboard || clipboard.files.length === 0) return;

        set({ isLoading: true });
        try {
          for (const src of clipboard.files) {
            const name = src.split('/').pop()?.split('\\').pop() || src;
            const dest = `${targetPath}/${name}`.replace(/\/+/g, '/');

            if (clipboard.operation === 'copy') {
              await castFS.copyFile(src, dest);
            } else if (clipboard.operation === 'cut') {
              await castFS.moveFile(src, dest);
            }
          }

          if (clipboard.operation === 'cut') {
            set({ clipboard: null });
          }
          await get().navigateTo(targetPath);
        } catch (error) {
          set({ error: error instanceof Error ? error.message : String(error) });
        } finally {
          set({ isLoading: false });
        }
      },

      addBookmark: (path: string) => {
        set((state) => {
          if (state.bookmarks.includes(path)) return state;
          return { bookmarks: [...state.bookmarks, path] };
        });
        get().saveToStorage();
      },

      removeBookmark: (path: string) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter(b => b !== path)
        }));
        get().saveToStorage();
      },

      addRecentFile: (file: { path: string; name: string; size: number }) => {
        set((state) => {
          const filtered = state.recentFiles.filter(f => f.path !== file.path);
          const updated = [{ ...file, accessedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT_FILES);
          return { recentFiles: updated };
        });
        get().saveToStorage();
      },

      clearRecentFiles: () => {
        set({ recentFiles: [] });
        get().saveToStorage();
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),

      loadFromStorage: () => {
        try {
          const recentRaw = localStorage.getItem(RECENT_STORAGE_KEY);
          if (recentRaw) {
            const parsed = JSON.parse(recentRaw);
            set({ recentFiles: Array.isArray(parsed) ? parsed : [] });
          }

          const bookmarksRaw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
          if (bookmarksRaw) {
            const parsed = JSON.parse(bookmarksRaw);
            set({ bookmarks: Array.isArray(parsed) ? parsed : [] });
          }
        } catch (error) {
          console.error('[CastFileSystemStore] Load failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const { recentFiles, bookmarks } = get();
          localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentFiles));
          localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
        } catch (error) {
          console.error('[CastFileSystemStore] Save failed:', error);
        }
      }
    }),
    { name: 'cast-filesystem-store' }
  )
);
