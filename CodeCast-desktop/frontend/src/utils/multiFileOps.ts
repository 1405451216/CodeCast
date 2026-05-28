import * as api from '../api';

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt?: number;
  isDirectory?: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  encoding?: string;
  language?: string;
}

export interface SearchResult {
  file: FileInfo;
  line: number;
  column: number;
  match: string;
  contextBefore: string;
  contextAfter: string;
}

export interface BatchOperationResult {
  success: boolean;
  path: string;
  error?: string;
  operation: 'read' | 'write' | 'delete' | 'search';
}

class MultiFileOperations {
  private cache: Map<string, { content: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async readMultipleFiles(filePaths: string[]): Promise<Map<string, FileContent>> {
    const results = new Map<string, FileContent>();
    const errors: Array<{ path: string; error: string }> = [];

    const promises = filePaths.map(async (path) => {
      try {
        const cached = this.cache.get(path);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
          results.set(path, {
            path,
            content: cached.content,
            language: this.detectLanguage(path)
          });
          return;
        }

        const content = await api.readFile(path);
        this.cache.set(path, { content, timestamp: Date.now() });
        
        results.set(path, {
          path,
          content,
          language: this.detectLanguage(path)
        });
      } catch (error: any) {
        errors.push({ path, error: error.message || '读取失败' });
      }
    });

    await Promise.all(promises);

    if (errors.length > 0) {
      console.warn('[MultiFile] Some files failed to read:', errors);
    }

    return results;
  }

  async writeMultipleFiles(files: Array<{ path: string; content: string }>): Promise<BatchOperationResult[]> {
    const results: BatchOperationResult[] = [];

    const promises = files.map(async ({ path, content }) => {
      try {
        await api.writeFile(path, content);
        
        this.cache.set(path, { content, timestamp: Date.now() });
        
        results.push({
          success: true,
          path,
          operation: 'write'
        });
      } catch (error: any) {
        results.push({
          success: false,
          path,
          error: error.message || '写入失败',
          operation: 'write'
        });
      }
    });

    await Promise.all(promises);

    return results;
  }

  async searchInFiles(
    pattern: string,
    options: {
      paths?: string[];
      fileTypes?: string[];
      caseSensitive?: boolean;
      useRegex?: boolean;
      maxResults?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const {
      paths = ['.'],
      fileTypes = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs'],
      caseSensitive = false,
      useRegex = true,
      maxResults = 50
    } = options;

    const allResults: SearchResult[] = [];

    for (const dirPath of paths) {
      try {
        const fileList = await api.listFiles(dirPath);
        
        const filteredFiles = fileList.filter((file: any) => {
          const fileName = this.getFileName(file);
          if (!fileName || file.isDirectory || file.IsDirectory) return false;
          
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          return fileTypes.includes(ext);
        });

        for (const file of filteredFiles.slice(0, maxResults)) {
          try {
            const fileName = this.getFileName(file);
            const fullPath = `${dirPath}/${fileName}`.replace('//', '/');
            const content = await api.readFile(fullPath);
            const lines = content.split('\n');

            lines.forEach((line, lineIndex) => {
              let matches: Array<{ index?: number; 0: string; input: string }> | null = null;

              if (useRegex) {
                try {
                  const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
                  matches = [...line.matchAll(regex)];
                } catch {
                  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  const fallbackRegex = new RegExp(escapedPattern, caseSensitive ? 'g' : 'gi');
                  matches = [...line.matchAll(fallbackRegex)];
                }
              } else {
                const searchStr = caseSensitive ? pattern : pattern.toLowerCase();
                const targetLine = caseSensitive ? line : line.toLowerCase();
                
                const index = targetLine.indexOf(searchStr);
                if (index !== -1) {
                  matches = [{
                    index,
                    0: line.substring(index, index + searchStr.length),
                    input: line
                  }];
                }
              }

              if (matches && matches.length > 0) {
                  matches.forEach((match) => {
                    if (allResults.length < maxResults) {
                      allResults.push({
                        file: {
                          path: fullPath,
                          name: fileName,
                          extension: fileName.split('.').pop() || '',
                          size: this.getFileSize(file),
                          modifiedAt: undefined
                        },
                        line: lineIndex + 1,
                        column: match.index || 0,
                        match: match[0],
                        contextBefore: lines[Math.max(0, lineIndex - 2)] || '',
                        contextAfter: lines[lineIndex + 1] || ''
                      });
                    }
                  });
              }
            });
          } catch (error) {
            console.warn(`[MultiFile] Failed to search in ${this.getFileName(file)}:`, error);
          }
        }
      } catch (error) {
        console.error(`[MultiFile] Failed to list files in ${dirPath}:`, error);
      }
    }

    return allResults.slice(0, maxResults);
  }

  async findReferences(
    symbol: string,
    basePath: string = '.'
  ): Promise<Array<{ file: string; line: number; type: 'definition' | 'usage' }>> {
    const searchPattern = `\\b${symbol}\\b`;
    
    const results = await this.searchInFiles(searchPattern, {
      paths: [basePath],
      useRegex: true,
      maxResults: 100
    });

    return results.map(result => ({
      file: result.file.path,
      line: result.line,
      type: 'usage' as const
    }));
  }

  async batchRename(
    oldPaths: string[],
    newPaths: string[]
  ): Promise<BatchOperationResult[]> {
    if (oldPaths.length !== newPaths.length) {
      throw new Error('旧路径和新路径数量不匹配');
    }

    const results: BatchOperationResult[] = [];

    for (let i = 0; i < oldPaths.length; i++) {
      try {
        const content = await api.readFile(oldPaths[i]);
        await api.writeFile(newPaths[i], content);
        
        this.cache.delete(oldPaths[i]);
        this.cache.set(newPaths[i], { content, timestamp: Date.now() });
        
        results.push({
          success: true,
          path: oldPaths[i],
          operation: 'write'
        });

        console.log(`[MultiFile] Renamed: ${oldPaths[i]} → ${newPaths[i]}`);
      } catch (error: any) {
        results.push({
          success: false,
          path: oldPaths[i],
          error: error.message || '重命名失败',
          operation: 'write'
        });
      }
    }

    return results;
  }

  async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;

    try {
      const content = await api.readFile(filePath);
      await api.writeFile(backupPath, content);

      console.log(`[MultiFile] Created backup: ${backupPath}`);
      return backupPath;
    } catch (error: any) {
      console.error(`[MultiFile] Backup failed for ${filePath}:`, error);
      throw error;
    }
  }

  async restoreFromBackup(backupPath: string, originalPath: string): Promise<void> {
    try {
      const backupContent = await api.readFile(backupPath);
      await api.writeFile(originalPath, backupContent);

      this.cache.set(originalPath, { 
        content: backupContent, 
        timestamp: Date.now() 
      });

      console.log(`[MultiFile] Restored from backup: ${originalPath}`);
    } catch (error: any) {
      console.error(`[MultiFile] Restore failed:`, error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[MultiFile] Cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      rb: 'ruby',
      php: 'php',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      css: 'css',
      scss: 'scss',
      less: 'less',
      html: 'html',
      htm: 'html',
      json: 'json',
      md: 'markdown',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      svg: 'svg',
      toml: 'toml',
      ini: 'ini',
      env: 'env',
      dockerfile: 'dockerfile',
      makefile: 'makefile'
    };

    return langMap[ext] || 'plaintext';
  }

  private getFileName(file: any): string {
    return file.name || file.Name || '';
  }

  private getFileSize(file: any): number {
    return file.size || file.Size || 0;
  }
}

export const multiFileOps = new MultiFileOperations();
export default MultiFileOperations;
