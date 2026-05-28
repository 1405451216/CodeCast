import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Note, NoteCategory } from '../types/cast-types';
import { DEFAULT_NOTE_CATEGORIES } from '../types/cast-types';

interface KnowledgeState {
  notes: Note[];
  categories: NoteCategory[];
  selectedNoteId: string | null;
  searchQuery: string;
  activeCategory: string | null;
  isLoading: boolean;

  setSearchQuery: (query: string) => void;
  setActiveCategory: (catId: string | null) => void;
  selectNote: (id: string | null) => void;

  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  addCategory: (cat: Omit<NoteCategory, 'count'>) => string;
  updateCategory: (id: string, updates: Partial<NoteCategory>) => void;
  deleteCategory: (id: string) => void;

  getFilteredNotes: () => Note[];
  getAllTags: () => Array<[string, number]>;
  getLinkedNotes: (noteId: string) => Note[];

  searchNotes: (query: string) => Note[];
  generateSummary: (content: string) => Promise<string>;

  exportNotes: (ids?: string[]) => void;
  importNotes: (data: string) => number;

  loadFromStorage: () => void;
  saveToStorage: () => void;
}

const STORAGE_KEY = 'codecast_knowledge_data';

function generateId(prefix = 'note'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

export const useKnowledgeStore = create<KnowledgeState>()(
  devtools(
    (set, get) => ({
      notes: [],
      categories: [...DEFAULT_NOTE_CATEGORIES],
      selectedNoteId: null,
      searchQuery: '',
      activeCategory: null,
      isLoading: false,

      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveCategory: (catId) => set({ activeCategory: catId }),
      selectNote: (id) => set({ selectedNoteId: id }),

      addNote: (noteData) => {
        const id = generateId();
        const now = Date.now();
        const newNote: Note = { ...noteData, id, createdAt: now, updatedAt: now };
        set((state) => {
          const updatedCategories = state.categories.map(cat =>
            cat.id === noteData.category ? { ...cat, count: cat.count + 1 } : cat
          );
          return { notes: [newNote, ...state.notes], categories: updatedCategories };
        });
        get().saveToStorage();
        return id;
      },

      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map(n => {
            if (n.id !== id) return n;
            const updated = { ...n, ...updates, updatedAt: Date.now() };
            if (updates.category && updates.category !== n.category) {
              const cats = state.categories.map(cat => {
                if (cat.id === n.category) return { ...cat, count: Math.max(0, cat.count - 1) };
                if (cat.id === updates.category) return { ...cat, count: cat.count + 1 };
                return cat;
              });
              set({ categories: cats });
            }
            return updated;
          })
        }));
        get().saveToStorage();
      },

      deleteNote: (id) => {
        const note = get().notes.find(n => n.id === id);
        set((state) => {
          let updatedCategories = state.categories;
          if (note) {
            updatedCategories = state.categories.map(cat =>
              cat.id === note.category ? { ...cat, count: Math.max(0, cat.count - 1) } : cat
            );
          }
          return {
            notes: state.notes.filter(n => n.id !== id),
            selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
            categories: updatedCategories
          };
        });
        get().saveToStorage();
      },

      addCategory: (catData) => {
        const id = generateId('cat');
        const newCat: NoteCategory = { ...catData, id, count: 0 };
        set((state) => ({ categories: [...state.categories, newCat] }));
        get().saveToStorage();
        return id;
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          categories: state.categories.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
        get().saveToStorage();
      },

      deleteCategory: (id) => {
        set((state) => ({
          categories: state.categories.filter(c => c.id !== id),
          notes: state.notes.filter(n => n.category !== id).map(n => ({ ...n, category: 'work' }))
        }));
        get().saveToStorage();
      },

      getFilteredNotes: () => {
        const { notes, searchQuery, activeCategory } = get();
        let filtered = notes;

        if (activeCategory) {
          filtered = filtered.filter(n => n.category === activeCategory);
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(n =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some(t => t.toLowerCase().includes(q))
          );
        }

        return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
      },

      getAllTags: () => {
        const tagMap = new Map<string, number>();
        get().notes.forEach(n => n.tags.forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1)));
        return Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
      },

      getLinkedNotes: (noteId) => {
        const note = get().notes.find(n => n.id === noteId);
        if (!note?.links || note.links.length === 0) return [];
        return note.links
          .map(linkId => get().notes.find(n => n.id === linkId))
          .filter(Boolean) as Note[];
      },

      searchNotes: (query: string) => {
        if (!query.trim()) return get().notes;
        const q = query.toLowerCase();
        const terms = q.split(/\s+/).filter(Boolean);

        return get()
          .notes
          .map(note => {
            let score = 0;
            const searchText = `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase();

            terms.forEach(term => {
              if (note.title.toLowerCase().includes(term)) score += 10;
              if (note.tags.some(t => t.toLowerCase().includes(term))) score += 5;
              const occurrences = (searchText.match(new RegExp(term, 'g')) || []).length;
              score += occurrences;
            });

            return { note, score };
          })
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ note }) => note);
      },

      generateSummary: async (content: string) => {
        try {
          const api = await import('../api');
          const result = await api.sendMessageEx('', `你是知识摘要助手。请用一句话（不超过50字）概括以下笔记的核心内容。只输出摘要，不要其他内容。\n\n${content.slice(0, 2000)}`, 'deepseek-v4-pro', false);
          return typeof result === 'string' ? (result as string).slice(0, 100) : '';
        } catch {
          return content.slice(0, 80) + (content.length > 80 ? '...' : '');
        }
      },

      exportNotes: (ids) => {
        const notesToExport = ids
          ? get().notes.filter(n => ids.includes(n.id))
          : get().notes;

        const exportData = {
          version: '1.0.0',
          exportTime: new Date().toISOString(),
          totalCount: notesToExport.length,
          notes: notesToExport.map(n => ({
            title: n.title,
            content: n.content,
            category: n.category,
            tags: n.tags,
            links: n.links,
            exportedAt: new Date().toISOString()
          }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codecast-knowledge-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      importNotes: (data) => {
        try {
          const parsed = JSON.parse(data);
          const importedNotes: Note[] = (parsed.notes || []).map((n: any) => ({
            id: generateId(),
            title: n.title || '导入笔记',
            content: n.content || '',
            category: n.category || 'work',
            tags: n.tags || [],
            links: n.links || [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

          set((state) => ({
            notes: [...importedNotes, ...state.notes]
          }));
          get().saveToStorage();
          return importedNotes.length;
        } catch {
          return 0;
        }
      },

      loadFromStorage: () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            set({
              notes: data.notes || [],
              categories: data.categories || DEFAULT_NOTE_CATEGORIES
            });
          }
        } catch (error) {
          console.error('[KnowledgeStore] Load failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const { notes, categories } = get();
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, categories }));
        } catch (error) {
          console.error('[KnowledgeStore] Save failed:', error);
        }
      }
    }),
    { name: 'knowledge-store' }
  )
);
