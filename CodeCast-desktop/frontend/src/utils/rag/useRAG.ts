import { useState, useEffect, useCallback, useRef } from 'react';
import { ragEngine, QueryResult, RAGConfig } from './RAGEngine';
import { logger } from '../logger';

interface UseRAGOptions {
  autoIndex?: boolean;
  config?: Partial<RAGConfig>;
  debounceMs?: number;
}

interface UseRAGReturn {
  isIndexing: boolean;
  isQuerying: boolean;
  lastResult: QueryResult | null;
  error: string | null;
  
  indexProject: (files: Array<{ path: string; content: string }>) => Promise<void>;
  query: (text: string, options?: { topK?: number }) => Promise<QueryResult>;
  getRelevantContext: (filePath: string, line: number, column: number) => Promise<string>;
  findSimilarCode: (code: string, limit?: number) => Promise<any[]>;
  
  stats: {
    indexedFiles: number;
    totalChunks: number;
    cacheSize: number;
  };
  
  clearCache: () => void;
  clearIndex: () => void;
}

export function useRAG(options?: UseRAGOptions): UseRAGReturn {
  const [isIndexing, setIsIndexing] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [lastResult, setLastResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const indexProject = useCallback(async (files: Array<{ path: string; content: string }>) => {
    try {
      setError(null);
      setIsIndexing(true);
      
      logger.info('useRAG', '📚 Starting project indexing...', { fileCount: files.length });
      
      await ragEngine.indexProject(files);
      
      const stats = ragEngine.getStats();
      logger.info('useRAG', '✅ Project indexing completed', stats);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to index project';
      logger.error('useRAG', '❌ Indexing error', err);
      setError(errorMsg);
    } finally {
      setIsIndexing(false);
    }
  }, []);

  const query = useCallback(async (
    text: string, 
    queryOptions?: { topK?: number }
  ): Promise<QueryResult> => {
    if (!text || text.trim().length === 0) {
      return {
        query: text,
        results: [],
        context: '',
        totalTokens: 0,
        retrievalTime: 0,
        sources: []
      };
    }

    try {
      setError(null);
      setIsQuerying(true);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      return new Promise((resolve) => {
        debounceRef.current = setTimeout(async () => {
          const result = await ragEngine.query(text, queryOptions);
          
          setLastResult(result);
          setIsQuerying(false);
          
          resolve(result);
        }, options?.debounceMs || 200);
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Query failed';
      logger.error('useRAG', '❌ Query error', err);
      setError(errorMsg);
      setIsQuerying(false);
      
      throw err;
    }
  }, [options?.debounceMs]);

  const getRelevantContext = useCallback(async (
    filePath: string, 
    line: number, 
    column: number
  ): Promise<string> => {
    try {
      return await ragEngine.getRelevantContextForFile(filePath, { line, column });
    } catch (err) {
      logger.error('useRAG', '❌ Error getting relevant context', err);
      return '';
    }
  }, []);

  const findSimilarCode = useCallback(async (
    code: string, 
    limit?: number
  ) => {
    try {
      return await ragEngine.findSimilarCode(code, limit);
    } catch (err) {
      logger.error('useRAG', '❌ Error finding similar code', err);
      return [];
    }
  }, []);

  const clearCache = useCallback(() => {
    ragEngine.clearCache();
  }, []);

  const clearIndex = useCallback(() => {
    ragEngine.clearIndex();
    setLastResult(null);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const stats = ragEngine.getStats();

  return {
    isIndexing,
    isQuerying,
    lastResult,
    error,
    
    indexProject,
    query,
    getRelevantContext,
    findSimilarCode,
    
    stats,
    
    clearCache,
    clearIndex
  };
}