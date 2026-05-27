import { PluginAPI, SidebarPanelConfig, ToolbarButtonConfig, ContextMenuConfig } from './PluginTypes';
import * as api from '../api';
import { cacheManager } from '../utils/performance';

class PluginAPIImpl implements PluginAPI {
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private registeredPanels: Map<string, SidebarPanelConfig> = new Map();
  private registeredButtons: Map<string, ToolbarButtonConfig> = new Map();
  private registeredMenus: Map<string, ContextMenuConfig> = new Map();
  private styleSheets: Map<string, HTMLStyleElement> = new Map();

  app = {
    getVersion: (): string => {
      return import.meta.env.VITE_APP_VERSION || '1.0.0';
    },

    getTheme: (): 'light' | 'dark' | 'system' => {
      const theme = localStorage.getItem('theme') || 'system';
      return theme as 'light' | 'dark' | 'system';
    },

    setTheme: (theme: string): void => {
      localStorage.setItem('theme', theme);
      window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }));
    },

    openFile: (path: string): void => {
      window.dispatchEvent(new CustomEvent('open-file', { detail: { path } }));
    },

    showMessage: (message: string, type: 'info' | 'success' | 'warning' | 'error'): void => {
      window.dispatchEvent(new CustomEvent('show-message', { detail: { message, type } }));
    }
  };

  files = {
    readFile: async (path: string): Promise<string> => {
      try {
        const cached = await cacheManager.get<string>(`file:${path}`);
        if (cached) return cached;

        const content = await api.readFile(path);
        await cacheManager.set(`file:${path}`, content, 10 * 60 * 1000);
        return content;
      } catch (error) {
        console.error(`[PluginAPI] Failed to read file ${path}:`, error);
        throw error;
      }
    },

    writeFile: async (path: string, content: string): Promise<void> => {
      try {
        await api.writeFile(path, content);
        await cacheManager.delete(`file:${path}`);
        window.dispatchEvent(new CustomEvent('file-changed', { detail: { path } }));
      } catch (error) {
        console.error(`[PluginAPI] Failed to write file ${path}:`, error);
        throw error;
      }
    },

    deleteFile: async (path: string): Promise<void> => {
      try {
        console.warn(`[PluginAPI] deleteFile not implemented, using empty write`);
        await api.writeFile(path, '');
        await cacheManager.delete(`file:${path}`);
      } catch (error) {
        console.error(`[PluginAPI] Failed to delete file ${path}:`, error);
        throw error;
      }
    },

    listFiles: async (dir: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }>> => {
      try {
        const files = await api.listFiles(dir) as any[];
        return files.map((f: any) => ({
          name: f.name || f.FileName || '',
          path: f.path || f.Path || '',
          isDirectory: f.isDirectory ?? f.IsDir ?? false
        }));
      } catch (error) {
        console.error(`[PluginAPI] Failed to list files in ${dir}:`, error);
        throw error;
      }
    },

    watchFile: (path: string, callback: (content: string) => void): (() => void) => {
      const handler = async () => {
        try {
          const content = await this.files.readFile(path);
          callback(content);
        } catch (error) {
          console.error(`[PluginAPI] Watch error for ${path}:`, error);
        }
      };

      window.addEventListener(`file-change:${path}`, handler);

      return () => {
        window.removeEventListener(`file-change:${path}`, handler);
      };
    }
  };

  ui = {
    registerSidebarPanel: (config: SidebarPanelConfig): void => {
      this.registeredPanels.set(config.id, config);
      window.dispatchEvent(new CustomEvent('register-sidebar-panel', { detail: config }));
    },

    registerToolbarButton: (config: ToolbarButtonConfig): void => {
      this.registeredButtons.set(config.id, config);
      window.dispatchEvent(new CustomEvent('register-toolbar-button', { detail: config }));
    },

    registerContextMenu: (config: ContextMenuConfig): void => {
      this.registeredMenus.set(config.id, config);
      window.dispatchEvent(new CustomEvent('register-context-menu', { detail: config }));
    },

    addStyleSheet: (css: string): void => {
      const id = `plugin-style-${Date.now()}`;
      const styleElement = document.createElement('style');
      styleElement.id = id;
      styleElement.textContent = css;
      document.head.appendChild(styleElement);
      this.styleSheets.set(id, styleElement);
    },

    removeStyleSheet: (id: string): void => {
      const element = this.styleSheets.get(id);
      if (element) {
        document.head.removeChild(element);
        this.styleSheets.delete(id);
      }
    }
  };

  terminal = {
    executeCommand: async (command: string): Promise<{ output: string; exitCode: number }> => {
      try {
        const result = await api.executeCommand(command);
        if (typeof result === 'string') {
          return { output: result, exitCode: 0 };
        }
        return result as { output: string; exitCode: number };
      } catch (error) {
        console.error(`[PluginAPI] Command execution failed:`, error);
        throw error;
      }
    },

    onOutput: (callback: (line: string) => void): (() => void) => {
      const handler = (event: Event) => {
        const customEvent = event as CustomEvent;
        callback(customEvent.detail.line);
      };

      window.addEventListener('terminal-output', handler);

      return () => {
        window.removeEventListener('terminal-output', handler);
      };
    },

    writeInput: (text: string): void => {
      window.dispatchEvent(new CustomEvent('terminal-input', { detail: { text } }));
    }
  };

  events = {
    on: (event: string, handler: (...args: any[]) => void): (() => void) => {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
      }

      this.eventListeners.get(event)!.add(handler);
      window.addEventListener(event, handler as EventListener);

      return () => {
        this.eventListeners.get(event)?.delete(handler);
        window.removeEventListener(event, handler as EventListener);
      };
    },

    once: (event: string, handler: (...args: any[]) => void): (() => void) => {
      const wrapper = (...args: any[]) => {
        handler(...args);
        this.events.off(event, wrapper);
      };

      return this.events.on(event, wrapper);
    },

    emit: (event: string, ...args: any[]): void => {
      window.dispatchEvent(new CustomEvent(event, { detail: args }));
    },

    off: (event: string, handler: (...args: any[]) => void): void => {
      this.eventListeners.get(event)?.delete(handler);
      window.removeEventListener(event, handler as EventListener);
    }
  };

  storage = {
    get: async <T>(key: string): Promise<T | null> => {
      try {
        const fullKey = `plugin-storage:${key}`;
        return await cacheManager.get<T>(fullKey);
      } catch (error) {
        console.error(`[PluginAPI] Storage get failed for key ${key}:`, error);
        return null;
      }
    },

    set: async (key: string, value: any): Promise<void> => {
      try {
        const fullKey = `plugin-storage:${key}`;
        await cacheManager.set(fullKey, value, 24 * 60 * 60 * 1000);
      } catch (error) {
        console.error(`[PluginAPI] Storage set failed for key ${key}:`, error);
        throw error;
      }
    },

    remove: async (key: string): Promise<void> => {
      try {
        const fullKey = `plugin-storage:${key}`;
        await cacheManager.delete(fullKey);
      } catch (error) {
        console.error(`[PluginAPI] Storage remove failed for key ${key}:`, error);
        throw error;
      }
    },

    clear: async (): Promise<void> => {
      console.warn('[PluginAPI] Storage clear is not recommended for plugins');
    }
  };

  http = {
    get: async (url: string, options?: RequestInit): Promise<Response> => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers
          },
          ...options
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        console.error(`[PluginAPI] HTTP GET failed for ${url}:`, error);
        throw error;
      }
    },

    post: async (url: string, data: any, options?: RequestInit): Promise<Response> => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers
          },
          body: JSON.stringify(data),
          ...options
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        console.error(`[PluginAPI] HTTP POST failed for ${url}:`, error);
        throw error;
      }
    }
  };

  cleanup(): void {
    this.registeredPanels.clear();
    this.registeredButtons.clear();
    this.registeredMenus.clear();

    this.styleSheets.forEach((element) => {
      if (document.head.contains(element)) {
        document.head.removeChild(element);
      }
    });
    this.styleSheets.clear();

    this.eventListeners.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        window.removeEventListener(event, handler as EventListener);
      });
    });
    this.eventListeners.clear();
  }
}

export const pluginAPI = new PluginAPIImpl();
export default PluginAPIImpl;
