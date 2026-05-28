import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  ChannelConfig,
  CastMessage,
  CastEvent,
  ChannelType,
  WebhookChannelConfig,
  EmailChannelConfig
} from '../types/cast-channels';
import {
  castChannels,
  WEBHOOK_TEMPLATES
} from '../utils/cast/cast-channels-engine';
import type { WebhookTemplate } from '../utils/cast/cast-channels-engine';

interface CastChannelsState {
  channels: Array<{ id: string; config: ChannelConfig }>;
  messages: CastMessage[];
  events: CastEvent[];
  activeEventBridges: string[];

  addChannel: (config: ChannelConfig) => string;
  updateChannel: (id: string, updates: Partial<ChannelConfig>) => void;
  removeChannel: (id: string) => void;
  toggleChannel: (id: string) => void;
  testChannel: (id: string) => Promise<{ success: boolean; latency: number; error?: string }>;

  setupFromTemplate: (templateKey: string, params: Record<string, string>) => string;

  bridgeEvent: (eventType: string) => void;
  unbridgeEvent: (eventType: string) => void;

  getMessages: (limit?: number) => CastMessage[];
  getEvents: (limit?: number) => CastEvent[];
  getChannelsByType: (type: ChannelType) => Array<{ id: string; config: ChannelConfig }>;

  loadFromStorage: () => void;
  saveToStorage: () => void;
  clearAll: () => void;
}

const CHANNELS_STORAGE_KEY = 'cast_channels_config';
const BRIDGES_STORAGE_KEY = 'cast_channels_bridges';

function generateId(): string {
  return `store-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export const useCastChannelsStore = create<CastChannelsState>()(
  devtools(
    (set, get) => ({
      channels: [],
      messages: [],
      events: [],
      activeEventBridges: [],

      addChannel: (config) => {
        const id = castChannels.addChannel(config);

        set((state) => ({
          channels: [...state.channels, { id, config }]
        }));

        get().saveToStorage();
        return id;
      },

      updateChannel: (id, updates) => {
        castChannels.updateChannel(id, updates);

        set((state) => ({
          channels: state.channels.map(ch =>
            ch.id === id ? { ...ch, config: { ...ch.config, ...updates } as ChannelConfig } : ch
          )
        }));

        get().saveToStorage();
      },

      removeChannel: (id) => {
        castChannels.removeChannel(id);

        set((state) => ({
          channels: state.channels.filter(ch => ch.id !== id)
        }));

        get().saveToStorage();
      },

      toggleChannel: (id) => {
        const channel = get().channels.find(ch => ch.id === id);
        if (!channel) return;

        const currentConfig = channel.config;

        if (currentConfig.type === 'webhook') {
          const webhookConfig = currentConfig as WebhookChannelConfig;
          const updated: WebhookChannelConfig = {
            ...webhookConfig,
            enabledEvents: webhookConfig.enabledEvents.length > 0 ? [] : ['*']
          };
          castChannels.updateChannel(id, updated);
          set((state) => ({
            channels: state.channels.map(ch =>
              ch.id === id ? { ...ch, config: updated as ChannelConfig } : ch
            )
          }));
        }

        get().saveToStorage();
      },

      testChannel: async (id) => {
        return await castChannels.testChannel(id);
      },

      setupFromTemplate: (templateKey, params) => {
        const template = WEBHOOK_TEMPLATES[templateKey] as WebhookTemplate | undefined;
        if (!template) {
          console.warn(`[CastChannelsStore] Template not found: ${templateKey}`);
          return '';
        }

        let url = template.urlTemplate;
        for (const [key, value] of Object.entries(params)) {
          url = url.replace(`{${key}}`, value);
        }

        const config: WebhookChannelConfig = {
          type: 'webhook',
          name: `${template.name}`,
          url,
          method: 'POST',
          contentType: template.contentType,
          retryCount: 3,
          timeout: 10000,
          enabledEvents: ['*']
        };

        return get().addChannel(config);
      },

      bridgeEvent: (eventType) => {
        castChannels.bridgeEventToChannels(eventType);

        set((state) => {
          if (!state.activeEventBridges.includes(eventType)) {
            return { activeEventBridges: [...state.activeEventBridges, eventType] };
          }
          return state;
        });

        get().saveToStorage();
      },

      unbridgeEvent: (eventType) => {
        castChannels.unbridgeEvent(eventType);

        set((state) => ({
          activeEventBridges: state.activeEventBridges.filter(e => e !== eventType)
        }));

        get().saveToStorage();
      },

      getMessages: (limit) => {
        return castChannels.getMessages(limit);
      },

      getEvents: (limit) => {
        const events = get().events.slice();
        events.sort((a, b) => b.timestamp - a.timestamp);
        if (limit && limit > 0) {
          return events.slice(0, limit);
        }
        return events;
      },

      getChannelsByType: (type) => {
        return get().channels.filter(ch => ch.config.type === type);
      },

      loadFromStorage: () => {
        try {
          const rawChannels = localStorage.getItem(CHANNELS_STORAGE_KEY);
          if (rawChannels) {
            const parsedChannels: Array<{ id: string; config: ChannelConfig }> = JSON.parse(rawChannels);
            if (parsedChannels.length > 0) {
              castChannels.importChannels(parsedChannels.map(ch => [ch.id, ch.config]));
              set({ channels: parsedChannels });
            }
          }

          const rawBridges = localStorage.getItem(BRIDGES_STORAGE_KEY);
          if (rawBridges) {
            const bridges: string[] = JSON.parse(rawBridges);
            bridges.forEach(evt => castChannels.bridgeEventToChannels(evt));
            set({ activeEventBridges: bridges });
          }
        } catch (error) {
          console.error('[CastChannelsStore] Load failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const { channels, activeEventBridges } = get();
          localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(channels));
          localStorage.setItem(BRIDGES_STORAGE_KEY, JSON.stringify(activeEventBridges));
        } catch (error) {
          console.error('[CastChannelsStore] Save failed:', error);
        }
      },

      clearAll: () => {
        castChannels.clearLogs();

        get().activeEventBridges.forEach(evt => {
          castChannels.unbridgeEvent(evt);
        });

        set({
          channels: [],
          messages: [],
          events: [],
          activeEventBridges: []
        });

        get().saveToStorage();
      }
    }),
    { name: 'cast-channels-store' }
  )
);
