import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  MarketplacePlugin,
  MarketplaceCategory,
  PluginReview,
  PluginStats
} from '../utils/cast/cast-marketplace';
import { castMarketplace, MARKETPLACE_CATEGORIES } from '../utils/cast/cast-marketplace';

interface CastMarketplaceState {
  plugins: MarketplacePlugin[];
  officialPlugins: MarketplacePlugin[];
  installedPlugins: MarketplacePlugin[];
  categories: MarketplaceCategory[];
  selectedCategory: string | null;
  searchQuery: string;
  showInstalledOnly: boolean;
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  selectedPlugin: MarketplacePlugin | null;

  refreshPlugins: () => Promise<void>;
  searchPlugins: (query: string) => MarketplacePlugin[];
  filterByCategory: (categoryId: string) => void;
  toggleInstalledFilter: () => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSearchQuery: (query: string) => void;

  install: (plugin: MarketplacePlugin) => Promise<{ success: boolean; errors: string[] }>;
  uninstall: (pluginId: string) => Promise<boolean>;
  enable: (pluginId: string) => Promise<boolean>;
  disable: (pluginId: string) => Promise<boolean>;
  update: (pluginId: string) => Promise<boolean>;
  bulkInstall: (pluginIds: string[]) => Promise<{ succeeded: string[]; failed: string[] }>;

  ratePlugin: (pluginId: string, rating: number) => void;
  addReview: (review: Omit<PluginReview, 'createdAt'>) => void;
  getReviews: (pluginId: string) => PluginReview[];

  getStats: () => PluginStats;

  selectPlugin: (plugin: MarketplacePlugin | null) => void;
  getSelected: () => MarketplacePlugin | null;

  loadFromStorage: () => void;
  saveToStorage: () => void;
}

export const useCastMarketplaceStore = create<CastMarketplaceState>()(
  devtools(
    (set, get) => ({
      plugins: [],
      officialPlugins: [],
      installedPlugins: [],
      categories: MARKETPLACE_CATEGORIES,
      selectedCategory: 'all',
      searchQuery: '',
      showInstalledOnly: false,
      isLoading: false,
      viewMode: 'grid',
      selectedPlugin: null,

      refreshPlugins: async () => {
        set({ isLoading: true });

        try {
          const official = castMarketplace.getOfficialPlugins();
          const allPlugins = castMarketplace.getAllPlugins();
          const installed = allPlugins.filter(p => p.localInstallInfo);

          set({
            plugins: allPlugins,
            officialPlugins: official,
            installedPlugins: installed,
            isLoading: false
          });
        } catch (error) {
          console.error('[CastMarketplaceStore] Failed to refresh plugins:', error);
          set({ isLoading: false });
        }
      },

      searchPlugins: (query: string) => {
        return castMarketplace.search(query);
      },

      filterByCategory: (categoryId: string) => {
        set({ selectedCategory: categoryId });
      },

      toggleInstalledFilter: () => {
        set(state => ({ showInstalledOnly: !state.showInstalledOnly }));
      },

      setViewMode: (mode: 'grid' | 'list') => {
        set({ viewMode: mode });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      install: async (plugin: MarketplacePlugin) => {
        set({ isLoading: true });

        try {
          const result = await castMarketplace.installPlugin(plugin);

          if (result.success) {
            await get().refreshPlugins();
          }

          set({ isLoading: false });
          return result;
        } catch (error: any) {
          set({ isLoading: false });
          return { success: false, errors: [error.message] };
        }
      },

      uninstall: async (pluginId: string) => {
        set({ isLoading: true });

        try {
          const success = await castMarketplace.uninstallPlugin(pluginId);

          if (success) {
            set(state => ({
              selectedPlugin: state.selectedPlugin?.name === pluginId ? null : state.selectedPlugin
            }));
            await get().refreshPlugins();
          }

          set({ isLoading: false });
          return success;
        } catch (error: any) {
          set({ isLoading: false });
          return false;
        }
      },

      enable: async (pluginId: string) => {
        const success = await castMarketplace.enablePlugin(pluginId);
        if (success) {
          await get().refreshPlugins();
        }
        return success;
      },

      disable: async (pluginId: string) => {
        const success = await castMarketplace.disablePlugin(pluginId);
        if (success) {
          await get().refreshPlugins();
        }
        return success;
      },

      update: async (pluginId: string) => {
        set({ isLoading: true });

        try {
          const success = await castMarketplace.updatePlugin(pluginId);

          if (success) {
            await get().refreshPlugins();
          }

          set({ isLoading: false });
          return success;
        } catch (error: any) {
          set({ isLoading: false });
          return false;
        }
      },

      bulkInstall: async (pluginIds: string[]) => {
        const succeeded: string[] = [];
        const failed: string[] = [];

        for (const id of pluginIds) {
          const plugin = get().officialPlugins.find(p => p.name === id);
          if (!plugin) {
            failed.push(id);
            continue;
          }

          const result = await castMarketplace.installPlugin(plugin);

          if (result.success) {
            succeeded.push(id);
          } else {
            failed.push(id);
          }
        }

        await get().refreshPlugins();
        return { succeeded, failed };
      },

      ratePlugin: (pluginId: string, rating: number) => {
        castMarketplace.ratePlugin(pluginId, rating);
      },

      addReview: (review: Omit<PluginReview, 'createdAt'>) => {
        castMarketplace.addReview(review);
      },

      getReviews: (pluginId: string) => {
        return castMarketplace.getReviews(pluginId);
      },

      getStats: () => {
        return castMarketplace.getStats();
      },

      selectPlugin: (plugin: MarketplacePlugin | null) => {
        set({ selectedPlugin: plugin });
      },

      getSelected: () => {
        return get().selectedPlugin;
      },

      loadFromStorage: () => {
        castMarketplace.loadFromStorage();
      },

      saveToStorage: () => {
        castMarketplace.saveToStorage();
      }
    }),
    { name: 'cast-marketplace-store' }
  )
);
