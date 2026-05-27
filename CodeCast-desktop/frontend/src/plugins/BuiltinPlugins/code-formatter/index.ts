import type { PluginManifest, PluginAPI } from '../../PluginTypes';

interface FormatterConfig {
  language: string;
  tabWidth: number;
  useSemicolons: boolean;
  singleQuote: boolean;
  trailingComma: string;
  printWidth: number;
  autoFormatOnSave: boolean;
}

class CodeFormatterPlugin {
  private api: PluginAPI | null = null;
  private config: FormatterConfig = {
    language: 'typescript',
    tabWidth: 2,
    useSemicolons: true,
    singleQuote: false,
    trailingComma: 'all',
    printWidth: 80,
    autoFormatOnSave: true
  };

  async activate(api: PluginAPI): Promise<void> {
    this.api = api;

    console.log('[CodeFormatter] Plugin activated');

    const savedConfig = await this.api.storage.get<FormatterConfig>('formatter-config');
    if (savedConfig) {
      this.config = { ...this.config, ...savedConfig };
    }

    this.api.ui.registerToolbarButton({
      id: 'format-code',
      icon: '✨',
      label: 'Format Code',
      tooltip: 'Format current file or selection (Ctrl+Shift+F)',
      onClick: this.formatCurrentFile.bind(this)
    });

    this.api.commands.registerCommand({
      id: 'code-formatter.format',
      title: 'Format Code',
      handler: this.formatCurrentFile.bind(this)
    });

    this.api.commands.registerCommand({
      id: 'code-formatter.format-selection',
      title: 'Format Selection',
      handler: this.formatSelection.bind(this)
    });

    this.api.events.on('file:saved', async (data) => {
      if (this.config.autoFormatOnSave && data.path) {
        console.log(`[CodeFormatter] Auto-formatting on save: ${data.path}`);
        await this.formatFile(data.path);
      }
    });
  }

  async deactivate(): Promise<void> {
    console.log('[CodeFormatter] Plugin deactivated');
    
    if (this.api) {
      this.api.ui.unregisterToolbarButton('format-code');
      this.api.commands.unregisterCommand('code-formatter.format');
      this.api.commands.unregisterCommand('code-formatter.format-selection');
    }
  }

  private async formatCurrentFile(): Promise<void> {
    try {
      const activeFile = this.api?.editor.getActiveFile();
      if (!activeFile) {
        this.api?.ui.showNotification({
          type: 'warning',
          message: 'No active file to format'
        });
        return;
      }

      const content = await this.api?.files.readFile(activeFile);
      if (!content) return;

      const formatted = this.formatCode(content as string, activeFile);

      await this.api?.files.writeFile(activeFile, formatted);

      this.api?.ui.showNotification({
        type: 'success',
        message: `Formatted ${activeFile}`
      });

      this.api?.events.emit('code-formatter:formatted', { path: activeFile });
    } catch (error) {
      console.error('[CodeFormatter] Format failed:', error);
      this.api?.ui.showNotification({
        type: 'error',
        message: `Format failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async formatSelection(): Promise<void> {
    try {
      const selection = this.api?.editor.getSelection();
      if (!selection || !selection.text) {
        this.api?.ui.showNotification({
          type: 'warning',
          message: 'No selection to format'
        });
        return;
      }

      const formatted = this.formatCode(selection.text, selection.filePath || '');

      this.api?.editor.replaceSelection(formatted);

      this.api?.ui.showNotification({
        type: 'success',
        message: 'Selection formatted'
      });
    } catch (error) {
      console.error('[CodeFormatter] Selection format failed:', error);
      this.api?.ui.showNotification({
        type: 'error',
        message: `Selection format failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async formatFile(filePath: string): Promise<void> {
    try {
      const content = await this.api?.files.readFile(filePath);
      if (!content) return;

      const formatted = this.formatCode(content as string, filePath);
      
      if (formatted !== content) {
        await this.api?.files.writeFile(filePath, formatted);
        console.log(`[CodeFormatter] Formatted: ${filePath}`);
      }
    } catch (error) {
      console.error(`[CodeFormatter] Failed to format ${filePath}:`, error);
    }
  }

  private formatCode(code: string, filePath: string): string {
    let result = code;

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        result = this.formatJavaScript(result);
        break;
      case 'py':
        result = this.formatPython(result);
        break;
      case 'json':
        result = this.formatJSON(result);
        break;
      default:
        console.log(`[CodeFormatter] Unsupported extension: ${ext}, using basic formatting`);
        result = this.basicFormat(result);
    }

    return result;
  }

  private formatJavaScript(code: string): string {
    let result = code;
    const indent = ' '.repeat(this.config.tabWidth);

    result = result.replace(/\t/g, indent);

    if (this.config.useSemicolons) {
      result = result.replace(/;(\s*)$/gm, ';');
    } else {
      result = result.replace(/;\s*$/gm, '');
    }

    if (this.config.singleQuote) {
      result = result.replace(/"([^"]*)"/g, "'$1'");
    }

    result = result.replace(/{\s*/g, '{\n' + indent);
    result = result.replace(/\s*}/g, '\n}');

    return result.trim();
  }

  private formatPython(code: string): string {
    let result = code;
    const indent = ' '.repeat(this.config.tabWidth * 4);

    result = result.replace(/\t/g, indent);

    result = result.replace(/:\s*$/gm, ':');

    return result;
  }

  private formatJSON(code: string): string {
    try {
      const parsed = JSON.parse(code);
      return JSON.stringify(parsed, null, this.config.tabWidth);
    } catch {
      return code;
    }
  }

  private basicFormat(code: string): string {
    const indent = ' '.repeat(this.config.tabWidth);
    return code
      .replace(/\t/g, indent)
      .trim();
  }

  async updateConfig(newConfig: Partial<FormatterConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    if (this.api) {
      await this.api.storage.set('formatter-config', this.config);
    }

    console.log('[CodeFormatter] Config updated:', this.config);
    this.api?.events.emit('code-formatter:config-updated', this.config);
  }

  getConfig(): FormatterConfig {
    return { ...this.config };
  }
}

const plugin: PluginManifest = {
  id: 'code-formatter',
  name: 'Code Formatter',
  version: '1.0.0',
  description: '自动格式化代码，支持多种编程语言和自定义规则',
  author: 'CodeCast Team',
  permissions: ['file:read', 'file:write'],
  entry: CodeFormatterPlugin
};

export default plugin;