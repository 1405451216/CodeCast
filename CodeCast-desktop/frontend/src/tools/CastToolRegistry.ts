import type {
  ICastTool,
  CastToolCategory,
  CastPluginManifest,
  PluginLoadResult,
  CastToolRegistryState,
  ToolContext,
  ToolResult
} from '../types/cast-plugin';
import type { AgentTool } from './types';
import castTools from './builtin/CastTools';
import { CastBrowserEngine } from '../utils/cast/cast-browser-engine';

class CastToolRegistryImpl implements CastToolRegistryState {
  tools: Map<string, ICastTool> = new Map();
  plugins: Map<string, CastPluginManifest> = new Map();
  categories: Map<CastToolCategory, string[]> = new Map();
  private changeListeners: Set<() => void> = new Set();
  private usageStats: Map<string, number> = new Map();

  register(tool: ICastTool): boolean {
    if (!tool.id || !tool.name || !tool.description || !tool.version || !tool.author || !tool.category || !tool.icon || !tool.color) {
      console.warn('[CastToolRegistry] Tool missing required fields:', tool.id);
      return false;
    }

    if (this.tools.has(tool.id)) {
      console.warn(`[CastToolRegistry] Tool "${tool.id}" is already registered. Overwriting.`);
      this.unregister(tool.id);
    }

    this.validateToolFields(tool);
    this.tools.set(tool.id, tool);
    this.addToCategoryIndex(tool);
    this.notifyChange();
    console.log(`[CastToolRegistry] Registered tool: ${tool.name} (${tool.id})`);
    return true;
  }

  unregister(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) {
      console.warn(`[CastToolRegistry] Tool "${toolId}" not found for unregistration.`);
      return false;
    }

    this.tools.delete(toolId);
    this.removeFromCategoryIndex(toolId, tool.category);
    this.usageStats.delete(toolId);
    this.notifyChange();
    console.log(`[CastToolRegistry] Unregistered tool: ${toolId}`);
    return true;
  }

  get(toolId: string): ICastTool | undefined {
    return this.tools.get(toolId);
  }

  getByCategory(category: CastToolCategory): ICastTool[] {
    const ids = this.categories.get(category) || [];
    return ids.map(id => this.tools.get(id)).filter((t): t is ICastTool => t !== undefined);
  }

  getAll(): ICastTool[] {
    return Array.from(this.tools.values());
  }

  search(query: string): ICastTool[] {
    if (!query.trim()) return this.getAll();

    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(tool => {
      return (
        tool.id.toLowerCase().includes(lowerQuery) ||
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        tool.author.toLowerCase().includes(lowerQuery)
      );
    });
  }

  count(): number {
    return this.tools.size;
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  clear(): void {
    this.tools.clear();
    this.plugins.clear();
    this.categories.clear();
    this.usageStats.clear();
    this.notifyChange();
    console.log('[CastToolRegistry] All tools and plugins cleared');
  }

  loadPlugin(manifest: CastPluginManifest): PluginLoadResult {
    const startTime = Date.now();
    const errors: string[] = [];
    const loadedTools: ICastTool[] = [];

    try {
      const validationErrors = this.validateManifest(manifest);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        return {
          plugin: manifest,
          tools: [],
          errors,
          loadTime: Date.now() - startTime
        };
      }

      for (const tool of manifest.tools) {
        const toolErrors = this.validateToolFields(tool);
        if (toolErrors.length > 0) {
          errors.push(`Tool ${tool.id}: ${toolErrors.join(', ')}`);
          continue;
        }

        if (this.tools.has(tool.id)) {
          errors.push(`Tool "${tool.id}" conflicts with existing tool`);
          continue;
        }

        this.register(tool);
        loadedTools.push(tool);
      }

      this.plugins.set(manifest.name, manifest);

      console.log(`[CastToolRegistry] Plugin "${manifest.name}" loaded with ${loadedTools.length} tools`);

      return {
        plugin: manifest,
        tools: loadedTools,
        errors,
        loadTime: Date.now() - startTime
      };
    } catch (error: any) {
      errors.push(`Unexpected error loading plugin: ${error.message}`);
      return {
        plugin: manifest,
        tools: loadedTools,
        errors,
        loadTime: Date.now() - startTime
      };
    }
  }

  unloadPlugin(pluginName: string): boolean {
    const manifest = this.plugins.get(pluginName);
    if (!manifest) {
      console.warn(`[CastToolRegistry] Plugin "${pluginName}" not found.`);
      return false;
    }

    for (const tool of manifest.tools) {
      this.unregister(tool.id);
    }

    this.plugins.delete(pluginName);
    console.log(`[CastToolRegistry] Plugin "${pluginName}" unloaded`);
    this.notifyChange();
    return true;
  }

  getPlugins(): CastPluginManifest[] {
    return Array.from(this.plugins.values());
  }

  getPluginTools(pluginName: string): ICastTool[] {
    const manifest = this.plugins.get(pluginName);
    if (!manifest) return [];
    return manifest.tools.map(t => this.tools.get(t.id)).filter((t): t is ICastTool => t !== undefined);
  }

  subscribe(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  getSnapshot(): Map<string, ICastTool> {
    return new Map(this.tools);
  }

  incrementUsage(toolId: string): void {
    const current = this.usageStats.get(toolId) || 0;
    this.usageStats.set(toolId, current + 1);
  }

  getUsageStats(toolId?: string): number | Record<string, number> {
    if (toolId) {
      return this.usageStats.get(toolId) || 0;
    }
    return Object.fromEntries(this.usageStats);
  }

  private validateToolFields(tool: ICastTool): string[] {
    const errors: string[] = [];

    if (!tool.id || typeof tool.id !== 'string') errors.push('Invalid or missing id');
    if (!tool.name || typeof tool.name !== 'string') errors.push('Invalid or missing name');
    if (!tool.description || typeof tool.description !== 'string') errors.push('Invalid or missing description');
    if (!tool.version || typeof tool.version !== 'string') errors.push('Invalid or missing version');
    if (!tool.author || typeof tool.author !== 'string') errors.push('Invalid or missing author');
    if (!tool.category || !['analysis', 'meeting', 'management', 'utility', 'creative', 'communication', 'productivity', 'custom'].includes(tool.category)) {
      errors.push('Invalid category');
    }
    if (!tool.icon || typeof tool.icon !== 'string') errors.push('Invalid or missing icon');
    if (!tool.color || typeof tool.color !== 'string') errors.push('Invalid or missing color');
    if (!Array.isArray(tool.tags)) errors.push('tags must be an array');
    if (typeof tool.execute !== 'function') errors.push('execute must be a function');

    return errors;
  }

  private validateManifest(manifest: CastPluginManifest): string[] {
    const errors: string[] = [];

    if (!manifest.name || typeof manifest.name !== 'string') errors.push('Missing or invalid plugin name');
    if (!manifest.version || typeof manifest.version !== 'string') errors.push('Missing or invalid version');
    if (!manifest.description || typeof manifest.description !== 'string') errors.push('Missing or invalid description');
    if (!manifest.author || typeof manifest.author !== 'string') errors.push('Missing or invalid author');
    if (!manifest.entry || typeof manifest.entry !== 'string') errors.push('Missing or invalid entry point');
    if (!Array.isArray(manifest.tools) || manifest.tools.length === 0) errors.push('Plugin must provide at least one tool');

    return errors;
  }

  private addToCategoryIndex(tool: ICastTool): void {
    const category = tool.category;
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    const categoryList = this.categories.get(category)!;
    if (!categoryList.includes(tool.id)) {
      categoryList.push(tool.id);
    }
  }

  private removeFromCategoryIndex(toolId: string, category: CastToolCategory): void {
    const categoryList = this.categories.get(category);
    if (categoryList) {
      const index = categoryList.indexOf(toolId);
      if (index > -1) {
        categoryList.splice(index, 1);
      }
    }
  }

  private notifyChange(): void {
    this.changeListeners.forEach(listener => {
      try {
        listener();
      } catch (e) {
        console.error('[CastToolRegistry] Error in change listener:', e);
      }
    });
  }
}

export const CastToolRegistry = new CastToolRegistryImpl();

function convertAgentToolToICastTool(agentTool: AgentTool): ICastTool {
  const categoryMap: Record<string, CastToolCategory> = {
    writing: 'productivity',
    translate: 'communication',
    knowledge: 'analysis',
    schedule: 'management',
    email: 'communication',
    analysis: 'analysis',
    meeting: 'meeting',
    creative: 'creative',
    utility: 'utility'
  };

  const iconMap: Record<string, string> = {
    write_document: '📝',
    translate_text: '🌐',
    search_knowledge: '📚',
    create_schedule: '📋',
    draft_email: '📧',
    analyze_data: '📊',
    summarize_meeting: '📝',
    create_todo: '✅',
    brainstorm: '💡',
    extract_keywords: '🔑',
    compare_texts: '⚖️',
    format_convert: '🔄'
  };

  const colorMap: Record<string, string> = {
    write_document: '#f59e0b',
    translate_text: '#10b981',
    search_knowledge: '#8b5cf6',
    create_schedule: '#3b82f6',
    draft_email: '#ef4444',
    analyze_data: '#3b82f6',
    summarize_meeting: '#f59e0b',
    create_todo: '#3b82f6',
    brainstorm: '#eab308',
    extract_keywords: '#06b6d4',
    compare_texts: '#f97316',
    format_convert: '#14b8a6'
  };

  const originalExecute = agentTool.execute;

  return {
    id: agentTool.id,
    name: agentTool.name,
    description: agentTool.description,
    version: agentTool.version || '1.0.0',
    author: 'CodeCast Built-in',
    category: categoryMap[agentTool.category as string] || 'custom',
    icon: iconMap[agentTool.id] || '🔧',
    color: colorMap[agentTool.id] || '#c084fc',
    tags: agentTool.tags || [agentTool.category as string],
    execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const result = await originalExecute(params as Record<string, any>, context as any);
      return {
        success: result.success,
        output: result.output || '',
        data: result.data,
        error: result.error,
        metadata: result.metadata,
        streaming: false
      };
    },
    streaming: false,
    permissions: [agentTool.permission === 'none' ? 'none' : agentTool.permission === 'read' ? 'read' : 'write'],
    metadata: {
      license: 'MIT',
      createdAt: new Date().toISOString()
    }
  };
}

export function bootstrapBuiltinCastTools(): void {
  console.log('[CastToolRegistry] Bootstrapping built-in Cast tools...');

  let registeredCount = 0;

  for (const agentTool of castTools) {
    try {
      const icastTool = convertAgentToolToICastTool(agentTool);
      if (CastToolRegistry.register(icastTool)) {
        registeredCount++;
      }
    } catch (error: any) {
      console.error(`[CastToolRegistry] Failed to bootstrap tool ${agentTool.id}:`, error.message);
    }
  }

  console.log(`[CastToolRegistry] Bootstrap complete: ${registeredCount}/${castTools.length} tools registered`);

  try {
    registerBrowserTools();
  } catch (e) {
    console.warn('[CastToolRegistry] Browser tools registration deferred or failed:', e);
  }
}

const browserTools: ICastTool[] = [
  {
    id: 'browser_navigate',
    name: 'Browse Web',
    description: 'Navigate to a URL and retrieve page information, supporting CDP direct connection or fetch simulation mode',
    category: 'utility',
    icon: 'GLOBE',
    color: '#3b82f6',
    version: '1.0.0',
    author: 'CodeCast',
    tags: ['browser', 'web', 'scrape'],
    uiSchema: [
      { type: 'text', name: 'url', label: 'URL', required: true, placeholder: 'https://example.com' },
      { type: 'toggle', name: 'screenshot', label: 'Take screenshot after navigation' },
      { type: 'toggle', name: 'scrape', label: 'Scrape page content after navigation' }
    ],
    permissions: ['network'],
    execute: async (params, _ctx): Promise<ToolResult> => {
      const url = params.url as string;
      if (!url?.trim()) {
        return { success: false, output: 'Error: URL is required', error: 'URL is required' };
      }

      try {
        const info = await CastBrowserEngine.navigate(url.trim(), { timeout: 15000 });

        let extraInfo = '';
        const shouldScreenshot = params.screenshot === true;
        const shouldScrape = params.scrape === true;

        if (shouldScreenshot) {
          try {
            const shot = await CastBrowserEngine.screenshot();
            if (shot.dataUrl) {
              extraInfo += `\n[Screenshot captured: ${shot.width}x${shot.height}]`;
            }
          } catch {
            extraInfo += '\n[Screenshot not available in simulation mode]';
          }
        }

        if (shouldScrape) {
          try {
            const scrapeResult = await CastBrowserEngine.scrape();
            extraInfo += `\n[Page scraped: ${scrapeResult.content.links.length} links, ${scrapeResult.content.images.length} images, ${scrapeResult.metadata.wordCount} words]`;
          } catch (e: any) {
            extraInfo += `\n[Scrape warning: ${e.message}]`;
          }
        }

        return {
          success: true,
          output: `Navigated to: ${info.title || info.url}\nURL: ${info.url}\nStatus: ${info.loading ? 'loading' : 'ready'}${extraInfo}`,
          data: { pageInfo: info },
          metadata: { engineMode: CastBrowserEngine.getStatus().method }
        };
      } catch (error: any) {
        return { success: false, output: `Navigation failed: ${error.message}`, error: error.message };
      }
    },
    streaming: false,
    metadata: { license: 'MIT', createdAt: new Date().toISOString() }
  },
  {
    id: 'browser_scrape',
    name: 'Scrape Web Page',
    description: 'Scrape web page content including text, links, images, and forms. Works in both CDP and simulation mode',
    category: 'analysis',
    icon: 'SPIDER',
    color: '#ef4444',
    version: '1.0.0',
    author: 'CodeCast',
    tags: ['browser', 'web', 'scrape', 'data-extraction'],
    uiSchema: [
      { type: 'text', name: 'url', label: 'URL (optional, uses current page if empty)', placeholder: 'Leave empty to use current page' },
      { type: 'toggle', name: 'includeHtml', label: 'Include raw HTML' },
      { type: 'toggle', name: 'includeLinks', label: 'Extract links', defaultValue: true },
      { type: 'toggle', name: 'includeImages', label: 'Extract images', defaultValue: true },
      { type: 'toggle', name: 'includeForms', label: 'Extract forms', defaultValue: true }
    ],
    permissions: ['network', 'read'],
    execute: async (params, _ctx): Promise<ToolResult> => {
      const targetUrl = params.url as string;

      if (targetUrl?.trim()) {
        try {
          await CastBrowserEngine.navigate(targetUrl.trim(), { timeout: 15000 });
        } catch (error: any) {
          return { success: false, output: `Failed to navigate to ${targetUrl}: ${error.message}`, error: error.message };
        }
      }

      try {
        const result = await CastBrowserEngine.scrape({
          includeHtml: params.includeHtml === true,
          includeLinks: params.includeLinks !== false,
          includeImages: params.includeImages !== false,
          includeForms: params.includeForms !== false
        });

        let summary = `Scraped: "${result.title}" (${result.url})\n`;
        summary += `Text length: ${result.content.text.length} chars | Words: ${result.metadata.wordCount}\n`;
        summary += `Links: ${result.content.links.length} | Images: ${result.content.images.length} | Forms: ${result.content.forms.length} | Load time: ${result.metadata.loadTime}ms\n`;

        if (result.content.links.length > 0) {
          summary += `\n--- Links (first 10) ---\n`;
          result.content.links.slice(0, 10).forEach((l, i) => {
            summary += `${i + 1}. ${l.text || '(no text)'} -> ${l.href}\n`;
          });
        }

        if (result.content.forms.length > 0) {
          summary += `\n--- Forms (${result.content.forms.length}) ---\n`;
          result.content.forms.forEach((form, fi) => {
            summary += `Form #${fi + 1}: ${form.fields.length} fields`;
            if (form.submitButton) summary += ` [Submit: "${form.submitButton.text}"]`;
            form.fields.forEach(f => { summary += `\n  - ${f.name} (${f.type})`; });
            summary += '\n';
          });
        }

        return {
          success: true,
          output: summary,
          data: result,
          metadata: { engineMode: CastBrowserEngine.getStatus().method }
        };
      } catch (error: any) {
        return { success: false, output: `Scrape failed: ${error.message}`, error: error.message };
      }
    },
    streaming: false,
    metadata: { license: 'MIT', createdAt: new Date().toISOString() }
  },
  {
    id: 'browser_fill_form',
    name: 'Auto Fill Form',
    description: 'Automatically fill and submit web forms using field selectors and values',
    category: 'utility',
    icon: 'PENCIL',
    color: '#10b981',
    version: '1.0.0',
    author: 'CodeCast',
    tags: ['browser', 'web', 'form', 'automation'],
    uiSchema: [
      { type: 'textarea', name: 'fields', label: 'Fields (JSON)', required: true, placeholder: '{"#username": "admin", "#password": "123456"}', description: 'JSON object mapping CSS selectors to values' },
      { type: 'toggle', name: 'submit', label: 'Submit form after filling' }
    ],
    permissions: ['network', 'write'],
    execute: async (params, _ctx): Promise<ToolResult> => {
      const fieldsStr = params.fields as string;
      if (!fieldsStr?.trim()) {
        return { success: false, output: 'Error: Fields JSON is required', error: 'Fields JSON is required' };
      }

      let formData: Record<string, string>;
      try {
        formData = JSON.parse(fieldsStr);
      } catch {
        return { success: false, output: 'Error: Invalid JSON format for fields', error: 'Invalid JSON format' };
      }

      if (Object.keys(formData).length === 0) {
        return { success: false, output: 'Error: At least one field is required', error: 'No fields provided' };
      }

      try {
        const currentUrl = await CastBrowserEngine.getCurrentUrl();
        if (!currentUrl) {
          return { success: false, output: 'Error: No page loaded. Navigate first.', error: 'No page loaded' };
        }

        const ok = await CastBrowserEngine.fillForm(formData, { submit: params.submit === true });

        const filledEntries = Object.entries(formData).map(([sel, val]) => `${sel}="${val}"`).join(', ');
        return {
          success: true,
          output: `Form filled on: ${currentUrl}\nFields: ${filledEntries}${params.submit ? '\nForm submitted.' : ''}\nNote: In simulation mode, fills are simulated. Use CDP backend for real interaction.`,
          data: { fields: formData, submitted: params.submit === true, url: currentUrl },
          metadata: { engineMode: CastBrowserEngine.getStatus().method }
        };
      } catch (error: any) {
        return { success: false, output: `Fill form failed: ${error.message}`, error: error.message };
      }
    },
    streaming: false,
    metadata: { license: 'MIT', createdAt: new Date().toISOString() }
  },
  {
    id: 'browser_screenshot',
    name: 'Web Screenshot',
    description: 'Take a screenshot of the current page or a specified URL',
    category: 'utility',
    icon: 'CAMERA',
    color: '#8b5cf6',
    version: '1.0.0',
    author: 'CodeCast',
    tags: ['browser', 'web', 'screenshot', 'visual'],
    uiSchema: [
      { type: 'text', name: 'url', label: 'URL (optional, uses current page)', placeholder: 'Leave empty for current page' },
      { type: 'toggle', name: 'fullPage', label: 'Full page screenshot' }
    ],
    permissions: ['network', 'read'],
    execute: async (params, _ctx): Promise<ToolResult> => {
      const targetUrl = params.url as string;

      if (targetUrl?.trim()) {
        try {
          await CastBrowserEngine.navigate(targetUrl.trim(), { timeout: 15000 });
        } catch (error: any) {
          return { success: false, output: `Failed to navigate: ${error.message}`, error: error.message };
        }
      }

      try {
        const shot = await CastBrowserEngine.screenshot(params.fullPage === true);

        if (shot.dataUrl) {
          return {
            success: true,
            output: `Screenshot captured!\nResolution: ${shot.width}x${shot.height}\nTimestamp: ${new Date(shot.timestamp).toLocaleTimeString()}\nData URL available (base64 PNG, ${(shot.dataUrl.length / 1024).toFixed(1)} KB)`,
            data: shot,
            metadata: { engineMode: CastBrowserEngine.getStatus().method }
          };
        } else {
          return {
            success: false,
            output: 'Screenshot not available. The current engine mode is "' + CastBrowserEngine.getStatus().method + '". Real screenshots require the Go backend with CDP support.',
            error: 'Screenshot requires CDP backend'
          };
        }
      } catch (error: any) {
        return { success: false, output: `Screenshot failed: ${error.message}`, error: error.message };
      }
    },
    streaming: false,
    metadata: { license: 'MIT', createdAt: new Date().toISOString() }
  }
];

export function registerBrowserTools(): void {
  console.log('[CastToolRegistry] Registering browser automation tools...');

  let registeredCount = 0;

  for (const tool of browserTools) {
    try {
      if (CastToolRegistry.register(tool)) {
        registeredCount++;
      }
    } catch (error: any) {
      console.error(`[CastToolRegistry] Failed to register browser tool ${tool.id}:`, error.message);
    }
  }

  console.log(`[CastToolRegistry] Browser tools registration complete: ${registeredCount}/${browserTools.length}`);
}

export { browserTools };
