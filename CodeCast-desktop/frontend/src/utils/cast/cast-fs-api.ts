export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  createdAt: number;
  extension?: string;
  children?: FileSystemEntry[];
}

export interface FileReadResult {
  content: string;
  encoding: string;
  size: number;
  path: string;
}

export interface FileWriteResult {
  path: string;
  bytesWritten: number;
  success: boolean;
}

export interface FileOperationOptions {
  encoding?: string;
  createParentDirs?: boolean;
  overwrite?: boolean;
  recursive?: boolean;
}

export interface SearchOptions {
  query: string;
  path?: string;
  extensions?: string[];
  maxResults?: number;
  includeHidden?: boolean;
  modifiedAfter?: number;
  modifiedBefore?: number;
  maxSize?: number;
  minSize?: number;
}

export interface SearchResult {
  entries: FileSystemEntry[];
  totalCount: number;
  searchPath: string;
  query: string;
  duration: number;
}

const VFS_PREFIX = 'cast_fs_';
const VFS_META_PREFIX = 'cast_fs_meta_';

interface VFSMetadata {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
  createdAt: number;
}

class CastFileSystemAPI {
  private isWailsAvailable: boolean;

  constructor() {
    this.isWailsAvailable = typeof window !== 'undefined' &&
      !!(window as unknown as { go?: { main?: unknown } })?.go?.main;
  }

  private get goApp() {
    if (!this.isWailsAvailable) return null;
    return (window as unknown as { go?: { main?: { App?: Record<string, (...args: unknown[]) => unknown> } } })?.go?.main?.App ?? null;
  }

  private hasMethod(method: string): boolean {
    const app = this.goApp;
    return !!app && typeof app[method] === 'function';
  }

  private vfsKey(path: string): string {
    return `${VFS_PREFIX}${path}`;
  }

  private vfsMetaKey(path: string): string {
    return `${VFS_META_PREFIX}${path}`;
  }

  private vfsRead(path: string): string | null {
    try {
      return localStorage.getItem(this.vfsKey(path));
    } catch {
      return null;
    }
  }

  private vfsWrite(path: string, content: string): void {
    localStorage.setItem(this.vfsKey(path), content);
    const now = Date.now();
    const meta: VFSMetadata = {
      name: path.split('/').pop() || path.split('\\').pop() || path,
      path,
      isDirectory: false,
      size: new Blob([content]).size,
      modifiedAt: now,
      createdAt: now
    };
    localStorage.setItem(this.vfsMetaKey(path), JSON.stringify(meta));
  }

  private vfsDelete(path: string): void {
    localStorage.removeItem(this.vfsKey(path));
    localStorage.removeItem(this.vfsMetaKey(path));
  }

  private vfsExists(path: string): boolean {
    return localStorage.getItem(this.vfsKey(path)) !== null;
  }

  private vfsListAll(): VFSMetadata[] {
    const metas: VFSMetadata[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(VFS_META_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) metas.push(JSON.parse(raw));
        } catch { /* skip */ }
      }
    }
    return metas.sort((a, b) => a.path.localeCompare(b.path));
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  private formatDate(ts: number): string {
    if (!ts) return '';
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}-${day}`;
  }

  async readFile(path: string, options?: FileOperationOptions): Promise<FileReadResult> {
    const encoding = options?.encoding || 'utf-8';

    if (this.hasMethod('ReadFileContent')) {
      try {
        const content = await (this.goApp as any).ReadFileContent(path) as string;
        return {
          content,
          encoding,
          size: new Blob([content]).size,
          path
        };
      } catch (error) {
        console.error('[CastFS] ReadFileContent failed:', error);
        throw error;
      }
    }

    if (this.hasMethod('ReadFile')) {
      try {
        const content = await (this.goApp as any).ReadFile(path) as string;
        return {
          content,
          encoding,
          size: new Blob([content]).size,
          path
        };
      } catch (error) {
        console.error('[CastFS] ReadFile failed:', error);
        throw error;
      }
    }

    const content = this.vfsRead(path);
    if (content === null) {
      throw new Error(`[CastFS] File not found: ${path}`);
    }
    return {
      content,
      encoding,
      size: new Blob([content]).size,
      path
    };
  }

  async writeFile(path: string, content: string, options?: FileOperationOptions): Promise<FileWriteResult> {
    if (this.hasMethod('WriteFile')) {
      try {
        await (this.goApp as any).WriteFile(path, content);
        return {
          path,
          bytesWritten: new Blob([content]).size,
          success: true
        };
      } catch (error) {
        console.error('[CastFS] WriteFile failed:', error);
        return { path, bytesWritten: 0, success: false };
      }
    }

    this.vfsWrite(path, content);
    return {
      path,
      bytesWritten: new Blob([content]).size,
      success: true
    };
  }

  async appendFile(path: string, content: string, options?: FileOperationOptions): Promise<FileWriteResult> {
    const existing = await this.readFile(path, options).catch(() => ({ content: '', encoding: 'utf-8', size: 0, path }));
    return this.writeFile(path, existing.content + content, options);
  }

  async deleteFile(path: string): Promise<boolean> {
    if (this.hasMethod('ExecuteCommand')) {
      try {
        const isWin = navigator.platform?.includes('Win') || true;
        const cmd = isWin ? `del "${path}"` : `rm "${path}"`;
        await (this.goApp as any).ExecuteCommand(cmd, 10);
        return true;
      } catch {
        // fallback to VFS
      }
    }

    if (this.vfsExists(path)) {
      this.vfsDelete(path);
      return true;
    }
    return false;
  }

  async copyFile(src: string, dest: string): Promise<boolean> {
    try {
      const result = await this.readFile(src);
      const writeResult = await this.writeFile(dest, result.content);
      return writeResult.success;
    } catch {
      return false;
    }
  }

  async moveFile(src: string, dest: string): Promise<boolean> {
    const copied = await this.copyFile(src, dest);
    if (copied) {
      await this.deleteFile(src);
      return true;
    }
    return false;
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    return this.moveFile(oldPath, newPath);
  }

  async listDirectory(path: string, options?: { deep?: number }): Promise<FileSystemEntry[]> {
    if (this.hasMethod('ListFiles')) {
      try {
        const entries = await (this.goApp as any).ListFiles(path) as Array<{
          Name: string;
          Path: string;
          IsDir: boolean;
          Size: number;
          ModTime: string;
        }>;
        return (entries || []).map(e => ({
          name: e.Name || e.Path?.split(/[/\\]/).pop() || '',
          path: e.Path || `${path}/${e.Name}`,
          isDirectory: !!e.IsDir,
          size: e.Size || 0,
          modifiedAt: e.ModTime ? new Date(e.ModTime).getTime() : Date.now(),
          createdAt: Date.now(),
          extension: !e.IsDir ? (e.Name?.split('.').pop() || '') : undefined
        }));
      } catch (error) {
        console.error('[CastFS] ListFiles failed:', error);
      }
    }

    if (this.hasMethod('GetWorkspaceFiles')) {
      try {
        const files = await (this.goApp as any).GetWorkspaceFiles(path) as Array<{
          Name: string;
          Path: string;
          IsDir: boolean;
          Size: number;
        }>;
        return (files || []).map(f => ({
          name: f.Name || '',
          path: f.Path || '',
          isDirectory: !!f.IsDir,
          size: f.Size || 0,
          modifiedAt: Date.now(),
          createdAt: Date.now(),
          extension: !f.IsDir ? (f.Name?.split('.').pop()) : undefined
        }));
      } catch (error) {
        console.error('[CastFS] GetWorkspaceFiles failed:', error);
      }
    }

    const allMeta = this.vfsListAll();
    const normalizedPath = path.replace(/[/\\]+$/, '');
    const filtered = allMeta.filter(m => {
      if (!normalizedPath || normalizedPath === '.' || normalizedPath === '/') return true;
      const dirPart = m.path.substring(0, m.path.lastIndexOf('/') || m.path.lastIndexOf('\\'));
      return dirPart === normalizedPath || m.path.startsWith(normalizedPath + '/') || m.path.startsWith(normalizedPath + '\\');
    });

    return filtered.map(m => ({
      ...m,
      extension: !m.isDirectory ? (m.name.includes('.') ? m.name.split('.').pop() : '') : undefined
    }));
  }

  async createDirectory(path: string, _recursive?: boolean): Promise<boolean> {
    if (this.hasMethod('ExecuteCommand')) {
      try {
        const isWin = navigator.platform?.includes('Win') || true;
        const cmd = isWin ? `mkdir "${path}"` : `mkdir -p "${path}"`;
        await (this.goApp as any).ExecuteCommand(cmd, 10);
        return true;
      } catch {
        // fallback
      }
    }

    const meta: VFSMetadata = {
      name: path.split('/').pop() || path.split('\\').pop() || path,
      path,
      isDirectory: true,
      size: 0,
      modifiedAt: Date.now(),
      createdAt: Date.now()
    };
    localStorage.setItem(this.vfsMetaKey(path), JSON.stringify(meta));
    return true;
  }

  async deleteDirectory(path: string, recursive?: boolean): Promise<boolean> {
    if (recursive) {
      const entries = await this.listDirectory(path);
      for (const entry of entries) {
        if (entry.isDirectory) {
          await this.deleteDirectory(entry.path, true);
        } else {
          await this.deleteFile(entry.path);
        }
      }
    }
    this.vfsDelete(path);
    return true;
  }

  async stat(path: string): Promise<FileSystemEntry | null> {
    if (this.hasMethod('ListFiles')) {
      try {
        const parent = path.substring(0, path.lastIndexOf('/')) || path.substring(0, path.lastIndexOf('\\')) || '.';
        const entries = await this.listDirectory(parent);
        return entries.find(e => e.path === path) || null;
      } catch {
        return null;
      }
    }

    const raw = localStorage.getItem(this.vfsMetaKey(path));
    if (raw) {
      try {
        const meta = JSON.parse(raw) as VFSMetadata;
        return {
          ...meta,
          extension: !meta.isDirectory ? (meta.name.includes('.') ? meta.name.split('.').pop() : '') : undefined
        };
      } catch {
        return null;
      }
    }

    if (this.vfsExists(path)) {
      const name = path.split('/').pop() || path.split('\\').pop() || path;
      return {
        name,
        path,
        isDirectory: false,
        size: 0,
        modifiedAt: Date.now(),
        createdAt: Date.now(),
        extension: name.includes('.') ? name.split('.').pop() : ''
      };
    }

    return null;
  }

  async exists(path: string): Promise<boolean> {
    if (this.hasMethod('ListFiles') || this.hasMethod('ReadFile')) {
      try {
        const result = await this.stat(path);
        return result !== null;
      } catch {
        return false;
      }
    }
    return this.vfsExists(path) || localStorage.getItem(this.vfsMetaKey(path)) !== null;
  }

  async getFileSize(path: string): Promise<number> {
    const entry = await this.stat(path);
    return entry?.size ?? 0;
  }

  async getFileHash(_path: string, _algorithm: 'md5' | 'sha1' | 'sha256' = 'md5'): Promise<string> {
    if (this.hasMethod('ExecuteCommand')) {
      try {
        const algoMap: Record<string, string> = { md5: 'md5sum', sha1: 'sha1sum', sha256: 'sha256sum' };
        const cmd = `${algoMap[_algorithm]} "${_path}"`;
        const result = await (this.goApp as any).ExecuteCommand(cmd, 10) as string;
        return (result || '').trim().split(/\s+/)[0] || '';
      } catch {
        // fallback
      }
    }

    let hash = 0;
    const content = this.vfsRead(_path) || '';
    for (let i = 0; i < content.length; i++) {
      const ch = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  async searchFiles(options: SearchOptions): Promise<SearchResult> {
    const startTime = performance.now();
    const searchPath = options.path || '.';
    const maxResults = options.maxResults || 100;

    let allEntries: FileSystemEntry[];

    if (this.hasMethod('ListFiles') || this.hasMethod('GetWorkspaceFiles')) {
      allEntries = await this.listDirectory(searchPath);
    } else {
      const allMeta = this.vfsListAll();
      allEntries = allMeta.map(m => ({
        ...m,
        extension: !m.isDirectory ? (m.name.includes('.') ? m.name.split('.').pop() : '') : undefined
      }));
    }

    const queryLower = options.query.toLowerCase();
    let results = allEntries.filter(entry => {
      if (options.extensions && options.extensions.length > 0 && entry.extension) {
        if (!options.extensions.some(ext => entry.extension?.toLowerCase() === ext.toLowerCase())) return false;
      }
      if (!options.includeHidden && entry.name.startsWith('.')) return false;
      if (options.modifiedAfter && entry.modifiedAt < options.modifiedAfter) return false;
      if (options.modifiedBefore && entry.modifiedAt > options.modifiedBefore) return false;
      if (options.maxSize !== undefined && entry.size > options.maxSize) return false;
      if (options.minSize !== undefined && entry.size < options.minSize) return false;
      return entry.name.toLowerCase().includes(queryLower);
    });

    results = results.slice(0, maxResults);

    return {
      entries: results,
      totalCount: results.length,
      searchPath,
      query: options.query,
      duration: Math.round(performance.now() - startTime)
    };
  }

  async batchRead(paths: string[]): Promise<Map<string, FileReadResult>> {
    const results = new Map<string, FileReadResult>();
    await Promise.all(
      paths.map(async (path) => {
        try {
          const result = await this.readFile(path);
          results.set(path, result);
        } catch (error) {
          console.error(`[CastFS] batchRead failed for ${path}:`, error);
        }
      })
    );
    return results;
  }

  async batchWrite(operations: Array<{ path: string; content: string }>): Promise<Map<string, FileWriteResult>> {
    const results = new Map<string, FileWriteResult>();
    await Promise.all(
      operations.map(async ({ path, content }) => {
        const result = await this.writeFile(path, content);
        results.set(path, result);
      })
    );
    return results;
  }

  watchDirectory?(_path: string, _callback: (event: { type: 'create' | 'modify' | 'delete'; path: string }) => void): () => void {
    console.warn('[CastFS] watchDirectory: file watching requires Go backend support');
    return () => {};
  }

  async pickFile(options?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null> {
    if (this.hasMethod('SelectFile')) {
      try {
        const result = await (this.goApp as any).SelectFile() as string;
        return result || null;
      } catch (error) {
        console.error('[CastFS] SelectFile failed:', error);
      }
    }

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options?.filters && options.filters.length > 0) {
        input.accept = options.filters.flatMap(f => f.extensions.map(e => `.${e}`)).join(',');
      }
      input.onchange = () => {
        const file = input.files?.[0];
        resolve(file ? file.name : null);
        input.remove();
      };
      input.oncancel = () => {
        resolve(null);
        input.remove();
      };
      input.click();
    });
  }

  async pickDirectory(): Promise<string | null> {
    if (this.hasMethod('SelectFolder')) {
      try {
        const result = await (this.goApp as any).SelectFolder() as string;
        return result || null;
      } catch (error) {
        console.error('[CastFS] SelectFolder failed:', error);
      }
    }

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          const parts = (file.webkitRelativePath || '').split('/');
          resolve(parts.length > 1 ? parts.slice(0, -1).join('/') : '.');
        } else {
          resolve(null);
        }
        input.remove();
      };
      input.oncancel = () => {
        resolve(null);
        input.remove();
      };
      input.click();
    });
  }

  async showInFileManager(path: string): Promise<void> {
    if (this.hasMethod('OpenInEditor')) {
      try {
        await (this.goApp as any).OpenInEditor(path);
        return;
      } catch (error) {
        console.error('[CastFS] OpenInEditor failed:', error);
      }
    }

    if (this.hasMethod('ExecuteCommand')) {
      try {
        const isWin = navigator.platform?.includes('Win') || true;
        const cmd = isWin ? `explorer /select,"${path}"` : `open -R "${path}"`;
        await (this.goApp as any).ExecuteCommand(cmd, 10);
        return;
      } catch (error) {
        console.error('[CastFS] ExecuteCommand for showInFileManager failed:', error);
      }
    }

    console.log(`[CastFS] showInFileManager: 无法打开文件管理器显示 ${path}，请手动查看`);
  }

  async exportAsFile(content: string, filename: string, mimeType?: string): Promise<boolean> {
    try {
      const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      return true;
    } catch (error) {
      console.error('[CastFS] exportAsFile failed:', error);
      return false;
    }
  }

  async importFromFile(accept?: string): Promise<{ content: string; name: string } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          input.remove();
          return;
        }
        try {
          const content = await file.text();
          resolve({ content, name: file.name });
        } catch (error) {
          console.error('[CastFS] importFromFile read failed:', error);
          resolve(null);
        }
        input.remove();
      };
      input.oncancel = () => {
        resolve(null);
        input.remove();
      };
      input.click();
    });
  }

  get formatSizeFn() { return this.formatSize.bind(this); }
  get formatDateFn() { return this.formatDate.bind(this); }
}

export const castFS = new CastFileSystemAPI();
