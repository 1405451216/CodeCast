export interface AICompletionRequest {
  context: string;
  filePath: string;
  position: { line: number; column: number };
  language: string;
  maxSuggestions?: number;
  model?: string;
}

export interface AICompletionSuggestion {
  text: string;
  displayText: string;
  confidence: number;
  type: 'code' | 'comment' | 'import' | 'function' | 'variable' | 'snippet';
  documentation?: string;
  insertText?: string;
  additionalEdits?: Array<{ range: { start: number; end: number }; text: string }>;
}

export interface AICompletionResponse {
  suggestions: AICompletionSuggestion[];
  model: string;
  latency: number;
  tokensUsed: number;
}

export class AICompletionService {
  private cache: Map<string, { response: AICompletionResponse; timestamp: number }> = new Map();
  private requestQueue: Array<{
    request: AICompletionRequest;
    resolve: (response: AICompletionResponse) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private isProcessing = false;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly DEBOUNCE_MS = 150;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  async getSuggestions(request: AICompletionRequest): Promise<AICompletionResponse> {
    const cacheKey = this.getCacheKey(request);
    
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.response;
    }

    return new Promise((resolve, reject) => {
      const existingTimer = this.debounceTimers.get(cacheKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.requestQueue.push({ request, resolve, reject });
        this.debounceTimers.delete(cacheKey);
        this.processQueue();
      }, this.DEBOUNCE_MS);

      this.debounceTimers.set(cacheKey, timer);
    });
  }

  async getInlineCompletion(
    context: string,
    position: { line: number; column: number },
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const lines = context.split('\n');
      const currentLine = lines[position.line - 1] || '';
      const prefix = currentLine.slice(0, position.column - 1);
      
      const prompt = this.buildInlinePrompt(context, prefix, position);

      const response = await fetch('/api/ai/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: options?.maxTokens || 100,
          temperature: options?.temperature || 0.2,
          stop: ['\n\n', '\n\t\t', '*/', '}'],
          context_window: this.extractRelevantContext(context, position)
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      console.log(`[AICompletion] Inline completion generated in ${Date.now() - startTime}ms`);
      
      return data.completion || '';
    } catch (error) {
      console.error('[AICompletion] Error generating inline completion:', error);
      return '';
    }
  }

  async getFunctionSignature(
    functionName: string,
    context: string
  ): Promise<{ signature: string; documentation: string } | null> {
    try {
      const response = await fetch('/api/ai/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function_name: functionName,
          context: context.slice(-2000)
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      return {
        signature: data.signature || '',
        documentation: data.documentation || ''
      };
    } catch (error) {
      console.error('[AICompletion] Error getting function signature:', error);
      return null;
    }
  }

  async explainCode(code: string, language: string): Promise<string> {
    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          max_length: 500
        })
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      return data.explanation || '';
    } catch (error) {
      console.error('[AICompletion] Error explaining code:', error);
      return '';
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getStats(): { 
    queueLength: number; 
    cacheSize: number; 
    isProcessing: boolean;
  } {
    return {
      queueLength: this.requestQueue.length,
      cacheSize: this.cache.size,
      isProcessing: this.isProcessing
    };
  }

  private getCacheKey(request: AICompletionRequest): string {
    return `${request.filePath}:${request.position.line}:${request.position.column}:${request.context.slice(-200)}`;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const batch = this.requestQueue.splice(0, 3);

      try {
        const responses = await Promise.all(
          batch.map(({ request }) => this.callAIAPI(request))
        );

        batch.forEach((item, index) => {
          const response = responses[index];
          
          this.cache.set(this.getCacheKey(item.request), {
            response,
            timestamp: Date.now()
          });

          item.resolve(response);
        });
      } catch (error) {
        batch.forEach(item => {
          item.reject(error as Error);
        });
      }
    }

    this.isProcessing = false;
  }

  private async callAIAPI(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    try {
      const relevantContext = this.extractRelevantContext(
        request.context, 
        request.position
      );

      const apiResponse = await fetch('/api/ai/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          context: relevantContext,
          max_suggestions: request.maxSuggestions || 5
        })
      });

      if (!apiResponse.ok) {
        throw new Error(`API request failed: ${apiResponse.status}`);
      }

      const data = await apiResponse.json();

      const response: AICompletionResponse = {
        suggestions: (data.suggestions || []).map((s: any) => ({
          ...s,
          confidence: Math.min(1, Math.max(0, s.confidence || 0))
        })),
        model: data.model || 'unknown',
        latency: Date.now() - startTime,
        tokensUsed: data.tokens_used || 0
      };

      console.log(`[AICompletion] Generated ${response.suggestions.length} suggestions in ${response.latency}ms`);
      
      return response;
    } catch (error) {
      console.error('[AICompletion] API call failed:', error);
      
      return {
        suggestions: [],
        model: 'fallback',
        latency: Date.now() - startTime,
        tokensUsed: 0
      };
    }
  }

  private extractRelevantContext(
    fullContext: string, 
    position: { line: number; column: number }
  ): string {
    const lines = fullContext.split('\n');
    const currentLine = position.line - 1;
    
    const startLine = Math.max(0, currentLine - 50);
    const endLine = Math.min(lines.length, currentLine + 20);
    
    const relevantLines = lines.slice(startLine, endLine + 1);
    
    let context = relevantLines.join('\n');
    
    const imports = lines.filter(line => 
      line.trim().startsWith('import ') || 
      line.trim().startsWith('from ') ||
      line.trim().startsWith('#include') ||
      line.trim().startsWith('package ')
    ).slice(0, 30);
    
    if (imports.length > 0) {
      context = imports.join('\n') + '\n\n' + context;
    }

    return context;
  }

  private buildInlinePrompt(
    context: string, 
    prefix: string,
    position: { line: number; column: number }
  ): string {
    return `Complete the following code. Only output the completion, no explanations.

File context:
${context.slice(-3000)}

Current line (${position.line}, column ${position.column}):
${prefix}

Completion:`;
  }
}