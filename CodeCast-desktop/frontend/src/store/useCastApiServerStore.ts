import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  ApiKeyInfo,
  ApiRequestLog,
  ServerStats
} from '../types/cast-api';
import {
  castApiServer,
  cors,
  auth,
  rateLimit,
  logger,
  jsonParser,
  errorHandler
} from '../utils/cast/cast-api-server';

const CONFIG_STORAGE_KEY = 'cast_api_server_config';
const KEYS_STORAGE_KEY = 'cast_api_keys';

interface CastApiServerState {
  isRunning: boolean;
  port: number;
  routeCount: number;
  apiKeys: ApiKeyInfo[];
  requestLogs: ApiRequestLog[];
  totalRequests: number;
  totalErrors: number;
  uptimeStart: number | null;

  startServer: () => void;
  stopServer: () => void;
  restartServer: () => void;

  generateApiKey: (name: string) => ApiKeyInfo;
  revokeApiKey: (key: string) => void;

  getRequestLogs: (filter?: { method?: string; path?: string; since?: number }) => ApiRequestLog[];
  clearLogs: () => void;

  getStats: () => ServerStats;

  loadFromStorage: () => void;
  saveToStorage: () => void;

  refreshFromServer: () => void;
}

export const useCastApiServerStore = create<CastApiServerState>()(
  devtools(
    (set, get) => ({
      isRunning: false,
      port: castApiServer.getPort(),
      routeCount: 0,
      apiKeys: [],
      requestLogs: [],
      totalRequests: 0,
      totalErrors: 0,
      uptimeStart: null,

      startServer: () => {
        castApiServer.use(cors());
        castApiServer.use(logger());
        castApiServer.use(jsonParser());
        castApiServer.use(errorHandler());
        castApiServer.use(auth(castApiServer as any));
        castApiServer.use(rateLimit(120));

        castApiServer.start();

        set({
          isRunning: true,
          port: castApiServer.getPort(),
          uptimeStart: Date.now()
        });

        get().refreshFromServer();
        get().saveToStorage();
        console.log('[CastApiServerStore] Server started');
      },

      stopServer: () => {
        castApiServer.stop();
        set({
          isRunning: false,
          uptimeStart: null
        });
        get().saveToStorage();
        console.log('[CastApiServerStore] Server stopped');
      },

      restartServer: () => {
        get().stopServer();
        setTimeout(() => {
          get().startServer();
        }, 100);
      },

      generateApiKey: (name) => {
        const keyInfo = castApiServer.generateApiKey(name);
        set((state) => ({
          apiKeys: [...state.apiKeys, keyInfo]
        }));
        get().saveToStorage();
        return keyInfo;
      },

      revokeApiKey: (key) => {
        const success = castApiServer.revokeApiKey(key);
        if (success) {
          set((state) => ({
            apiKeys: state.apiKeys.map(k =>
              k.key === key ? { ...k, enabled: false } : k
            )
          }));
          get().saveToStorage();
        }
      },

      getRequestLogs: (filter) => {
        return castApiServer.getRequestLogs(filter);
      },

      clearLogs: () => {
        castApiServer.clearLogs();
        set({ requestLogs: [] });
        get().saveToStorage();
      },

      getStats: () => {
        return castApiServer.getStats();
      },

      refreshFromServer: () => {
        const status = castApiServer.getServerStatus();
        const stats = castApiServer.getStats();
        const keys = castApiServer.listApiKeys();
        const logs = castApiServer.getRequestLogs();

        set({
          isRunning: status.running,
          port: status.port,
          routeCount: status.routeCount,
          totalRequests: status.totalRequests,
          totalErrors: status.totalErrors,
          apiKeys: keys,
          requestLogs: logs.slice(-100)
        });
      },

      loadFromStorage: () => {
        try {
          const configRaw = localStorage.getItem(CONFIG_STORAGE_KEY);
          if (configRaw) {
            const config = JSON.parse(configRaw);
            set({
              port: config.port || castApiServer.getPort(),
              isRunning: config.autoStart || false
            });
          }

          const keysRaw = localStorage.getItem(KEYS_STORAGE_KEY);
          if (keysRaw) {
            const keys: ApiKeyInfo[] = JSON.parse(keysRaw);

            for (const key of keys) {
              if (!castApiServer.listApiKeys().find(k => k.key === key.key)) {
                castApiServer.generateApiKey(key.name, key.permissions);
              }
            }

            set({ apiKeys: castApiServer.listApiKeys() });
          }

          console.log('[CastApiServerStore] Loaded from storage');
        } catch (error) {
          console.error('[CastApiServerStore] Load failed:', error);
        }
      },

      saveToStorage: () => {
        try {
          const state = get();

          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
            port: state.port,
            autoStart: state.isRunning,
            savedAt: new Date().toISOString()
          }));

          const serializableKeys = state.apiKeys.map(k => ({
            ...k,
            lastUsedAt: k.lastUsedAt
          }));
          localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(serializableKeys));
        } catch (error) {
          console.error('[CastApiServerStore] Save failed:', error);
        }
      }
    }),
    { name: 'cast-api-server-store' }
  )
);
