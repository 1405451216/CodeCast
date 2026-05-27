import type { PluginManifest, PluginAPI } from '../../PluginTypes';
import { PluginPermission } from '../../PluginTypes';

interface Snippet {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  category: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  isFavorite: boolean;
  isBuiltin: boolean;
}

interface SnippetConfig {
  maxSnippets: number;
  autoBackup: boolean;
  backupInterval: number;
  enableSync: boolean;
  defaultLanguage: string;
}

class SnippetManagerPlugin {
  private api: PluginAPI | null = null;
  private config: SnippetConfig = {
    maxSnippets: 1000,
    autoBackup: true,
    backupInterval: 3600,
    enableSync: false,
    defaultLanguage: 'typescript'
  };

  private snippets: Snippet[] = [];
  private backupTimer: ReturnType<typeof setInterval> | null = null;

  private builtinSnippets: Snippet[] = [
    {
      id: 'builtin-react-component',
      title: 'React Functional Component',
      description: 'A modern React functional component with TypeScript and hooks',
      language: 'typescript',
      code: [
        "import React, { useState, useEffect } from 'react';",
        '',
        "interface ComponentNameProps {",
        "  // Define your props here",
        "}",
        '',
        "export const ComponentName: React.FC<ComponentNameProps> = ({}) => {",
        "  const [state, setState] = useState<type>(initialValue);",
        '',
        "  useEffect(() => {",
        "    // Side effects here",
        "    return () => {",
        "      // Cleanup",
        "    };",
        "  }, []);",
        '',
        "  return (",
        '    <div className="container">',
        "      {}",
        "    </div>",
        "  );",
        "};",
        '',
        "export default ComponentName;"
      ].join('\n'),
      tags: ['react', 'component', 'typescript', 'hooks'],
      category: 'React',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
      isFavorite: false,
      isBuiltin: true
    },
    {
      id: 'builtin-async-function',
      title: 'Async Function with Error Handling',
      description: 'An async function with proper error handling and type safety',
      language: 'typescript',
      code: [
        'async function functionName(params: paramType): Promise<returnType> {',
        "  try {",
        "    const result = await asyncOperation(params);",
        "    ",
        "    if (!result) {",
        '      throw new Error("Error message");',
        "    }",
        "",
        "    return result;",
        "  } catch (error) {",
        '    console.error("Error in functionName:", error);',
        "    throw error;",
        "  }",
        "}"
      ].join('\n'),
      tags: ['async', 'error-handling', 'typescript', 'pattern'],
      category: 'Patterns',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
      isFavorite: true,
      isBuiltin: true
    },
    {
      id: 'builtin-fetch-api',
      title: 'Fetch API with TypeScript',
      description: 'Type-safe fetch wrapper with error handling and response parsing',
      language: 'typescript',
      code: [
        "interface ApiResponse<T> {",
        "  data: T;",
        "  status: number;",
        "  message: string;",
        "}",
        "",
        "async function fetchApi<T>(",
        "  url: string,",
        "  options?: RequestInit",
        "): Promise<ApiResponse<T>> {",
        "  try {",
        "    const response = await fetch(url, {",
        "      headers: {",
        "        'Content-Type': 'application/json',",
        "        ...options?.headers,",
        "      },",
        "      ...options,",
        "    });",
        "",
        "    if (!response.ok) {",
        '      throw new Error(`HTTP error! status: ${response.status}`);',
        "    }",
        "",
        "    const data = await response.json();",
        "    ",
        "    return {",
        "      data,",
        "      status: response.status,",
        "      message: 'Success',",
        "    };",
        "  } catch (error) {",
        "    console.error('Fetch error:', error);",
        "    throw error;",
        "  }",
        "}",
        "",
        "// Usage example:",
        "// const result = await fetchApi<UserType>('/api/users/1');"
      ].join('\n'),
      tags: ['fetch', 'api', 'typescript', 'http'],
      category: 'API',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
      isFavorite: false,
      isBuiltin: true
    }
  ];

  async activate(api: PluginAPI): Promise<void> {
    this.api = api;

    console.log('[SnippetManager] Plugin activated');

    const savedConfig = await this.api.storage.get<SnippetConfig>('snippet-config');
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }

    const savedSnippets = await this.api.storage.get<Snippet[]>('snippets');
    if (savedSnippets && Array.isArray(savedSnippets)) {
      this.snippets = [...this.builtinSnippets, ...savedSnippets];
    } else {
      this.snippets = [...this.builtinSnippets];
    }

    this.setupAutoBackup();

    this.api.ui.registerToolbarButton({
      id: 'insert-snippet',
      label: 'Insert Snippet',
      icon: '📋',
      tooltip: 'Quick insert code snippet',
      onClick: () => this.showSnippetPicker()
    });
  }

  async deactivate(): Promise<void> {
    console.log('[SnippetManager] Plugin deactivated');

    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }

    await this.saveSnippets();
  }

  private setupAutoBackup(): void {
    if (this.config.autoBackup && this.config.backupInterval > 0) {
      this.backupTimer = setInterval(async () => {
        await this.saveSnippets();
        console.log('[SnippetManager] Auto-backup completed');
      }, this.config.backupInterval * 1000);

      console.log(`[SnippetManager] Auto-backup enabled (${this.config.backupInterval}s interval)`);
    }
  }

  private async saveSnippets(): Promise<void> {
    try {
      const customSnippets = this.snippets.filter(s => !s.isBuiltin);
      await this.api?.storage.set('snippets', customSnippets);
    } catch (error) {
      console.error('[SnippetManager] Failed to save snippets:', error);
    }
  }

  async showSnippetPicker(): Promise<void> {
    const recentSnippets = this.snippets
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    if (recentSnippets.length === 0) {
      this.api?.app.showMessage('No snippets available', 'info');
      return;
    }

    const snippetNames = recentSnippets.map((s, index) =>
      `[${index + 1}] ${s.title} (${s.language}): ${s.description}`
    ).join('\n');

    this.api?.app.showMessage(
      `Available snippets:\n${snippetNames}\n\nUse getSnippetById() to insert a specific snippet.`,
      'info'
    );
  }

  private async insertSnippet(snippet: Snippet): Promise<void> {
    try {
      let code = snippet.code;

      code = this.processPlaceholders(code);

      snippet.usageCount++;
      snippet.updatedAt = Date.now();

      await this.saveSnippets();

      this.api?.app.showMessage(`Inserted snippet: ${snippet.title}`, 'success');

      this.api?.events.emit('snippet:inserted', {
        snippetId: snippet.id,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[SnippetManager] Failed to insert snippet:', error);
      this.api?.app.showMessage('Failed to insert snippet', 'error');
    }
  }

  private processPlaceholders(code: string): string {
    return code.replace(/\$\{(\d+)(?::([^}]*))?\}/g, (_match, _num, text) => {
      return text || '';
    }).replace(/\$(\d+)/g, () => {
      return '';
    });
  }

  async createNewSnippet(title: string, language: string, code: string, description?: string, tags?: string[]): Promise<Snippet | null> {
    if (!this.api) return null;

    if (this.snippets.length >= this.config.maxSnippets) {
      this.api.app.showMessage(`Maximum snippets limit reached (${this.config.maxSnippets})`, 'warning');
      return null;
    }

    const newSnippet: Snippet = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: description || '',
      language,
      code,
      tags: tags || [],
      category: 'Custom',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
      isFavorite: false,
      isBuiltin: false
    };

    this.snippets.push(newSnippet);
    await this.saveSnippets();

    this.api.app.showMessage(`Created snippet: ${title}`, 'success');

    this.api.events.emit('snippet:created', { snippetId: newSnippet.id });

    return newSnippet;
  }

  async searchSnippets(query: string): Promise<Snippet[]> {
    const results = this.snippets.filter(snippet =>
      snippet.title.toLowerCase().includes(query.toLowerCase()) ||
      snippet.description.toLowerCase().includes(query.toLowerCase()) ||
      snippet.code.toLowerCase().includes(query.toLowerCase()) ||
      snippet.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
      snippet.language.toLowerCase().includes(query.toLowerCase())
    );

    if (results.length === 0) {
      this.api?.app.showMessage(`No snippets found for "${query}"`, 'info');
    }

    return results;
  }

  getSnippets(filter?: {
    query?: string;
    language?: string;
    tag?: string;
    category?: string;
    favoritesOnly?: boolean;
  }): Snippet[] {
    let results = [...this.snippets];

    if (filter) {
      if (filter.query) {
        const q = filter.query.toLowerCase();
        results = results.filter(s =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some(t => t.includes(q))
        );
      }

      if (filter.language) {
        results = results.filter(s => s.language === filter.language);
      }

      if (filter.tag) {
        results = results.filter(s => s.tags.includes(filter.tag!));
      }

      if (filter.category) {
        results = results.filter(s => s.category === filter.category);
      }

      if (filter.favoritesOnly) {
        results = results.filter(s => s.isFavorite);
      }
    }

    return results.sort((a, b) => b.usageCount - a.usageCount);
  }

  getSnippetById(id: string): Snippet | undefined {
    return this.snippets.find(s => s.id === id);
  }

  async updateSnippet(id: string, updates: Partial<Snippet>): Promise<void> {
    const index = this.snippets.findIndex(s => s.id === id);
    if (index !== -1) {
      this.snippets[index] = {
        ...this.snippets[index],
        ...updates,
        updatedAt: Date.now()
      };
      await this.saveSnippets();

      this.api?.events.emit('snippet:updated', { snippetId: id });
    }
  }

  async deleteSnippet(id: string): Promise<void> {
    const snippet = this.snippets.find(s => s.id === id);
    
    if (snippet?.isBuiltin) {
      this.api?.app.showMessage('Cannot delete built-in snippet', 'warning');
      return;
    }

    this.snippets = this.snippets.filter(s => s.id !== id);
    await this.saveSnippets();

    this.api?.app.showMessage(`Deleted snippet: ${snippet?.title}`, 'success');

    this.api?.events.emit('snippet:deleted', { snippetId: id });
  }

  async toggleFavorite(id: string): Promise<void> {
    const snippet = this.snippets.find(s => s.id === id);
    if (snippet) {
      snippet.isFavorite = !snippet.isFavorite;
      snippet.updatedAt = Date.now();
      await this.saveSnippets();
    }
  }

  getCategories(): string[] {
    const categories = new Set(this.snippets.map(s => s.category));
    return Array.from(categories).sort();
  }

  getTags(): string[] {
    const allTags = this.snippets.flatMap(s => s.tags);
    const uniqueTags = new Set(allTags);
    return Array.from(uniqueTags).sort();
  }

  getLanguages(): string[] {
    const languages = new Set(this.snippets.map(s => s.language));
    return Array.from(languages).sort();
  }

  getStats(): {
    total: number;
    custom: number;
    builtin: number;
    favorites: number;
    totalUsage: number;
    categories: number;
    languages: number;
  } {
    return {
      total: this.snippets.length,
      custom: this.snippets.filter(s => !s.isBuiltin).length,
      builtin: this.snippets.filter(s => s.isBuiltin).length,
      favorites: this.snippets.filter(s => s.isFavorite).length,
      totalUsage: this.snippets.reduce((sum, s) => sum + s.usageCount, 0),
      categories: this.getCategories().length,
      languages: this.getLanguages().length
    };
  }

  async exportSnippets(format: 'json' | 'markdown' = 'json'): Promise<string> {
    const customSnippets = this.snippets.filter(s => !s.isBuiltin);

    switch (format) {
      case 'json':
        return JSON.stringify(customSnippets, null, 2);

      case 'markdown':
        return customSnippets.map(s =>
          `## ${s.title}\n\n` +
          `**Language:** ${s.language}\n` +
          `**Description:** ${s.description || 'N/A'}\n` +
          `**Tags:** ${s.tags.join(', ') || 'None'}\n\n` +
          `\`\`\`${s.language}\n${s.code}\n\`\`\`\n`
        ).join('\n---\n\n');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async importSnippets(data: string): Promise<number> {
    try {
      const imported: Snippet[] = JSON.parse(data);
      
      if (!Array.isArray(imported)) {
        throw new Error('Invalid data format');
      }

      let importedCount = 0;

      for (const snippet of imported) {
        if (this.snippets.length >= this.config.maxSnippets) {
          break;
        }

        const newSnippet: Snippet = {
          ...snippet,
          id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isBuiltin: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          usageCount: 0
        };

        this.snippets.push(newSnippet);
        importedCount++;
      }

      await this.saveSnippets();

      this.api?.app.showMessage(`Imported ${importedCount} snippet(s)`, 'success');

      return importedCount;
    } catch (error) {
      console.error('[SnippetManager] Import failed:', error);
      this.api?.app.showMessage('Failed to import snippets', 'error');
      return 0;
    }
  }

  async updateConfig(newConfig: Partial<SnippetConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    if (this.api) {
      await this.api.storage.set('snippet-config', this.config);
    }

    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
    this.setupAutoBackup();

    this.api?.events.emit('snippet:config-updated', this.config);
  }

  getConfig(): SnippetConfig {
    return { ...this.config };
  }
}

const plugin: PluginManifest = {
  id: 'snippet-manager',
  name: 'Snippet Manager',
  version: '1.0.0',
  description: '强大的代码片段管理系统，支持创建、分类、搜索和快速插入常用代码模板',
  author: 'CodeCast Team',
  entry: './index.ts',
  minAppVersion: '1.0.0',
  permissions: [
    PluginPermission.READ_FILES,
    PluginPermission.WRITE_FILES,
    PluginPermission.MODIFY_UI
  ]
};

export default plugin;