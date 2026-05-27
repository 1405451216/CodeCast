export interface AIRequest {
  query: string;
  context?: {
    language?: string;
    filePath?: string;
    codeSnippet?: string;
    projectType?: string;
  };
}

export interface AIResponse {
  suggestions: Array<{
    text: string;
    confidence: number;
    type: 'completion' | 'refactor' | 'explanation' | 'snippet';
    source: string;
  }>;
  processedQuery: string;
}

interface IntentPattern {
  pattern: RegExp;
  intent: string;
  confidence: number;
  requiredContext?: string[];
}

export class LocalAICore {
  private static readonly INTENT_PATTERNS: IntentPattern[] = [
    // Creation intents
    { pattern: /create|make|new|build|generate/i, intent: 'create', confidence: 0.9 },
    { pattern: /write|implement|code|develop/i, intent: 'implement', confidence: 0.85 },
    
    // Component/Structure intents
    { pattern: /component|widget|ui|element/i, intent: 'component', confidence: 0.95, requiredContext: ['react', 'vue', 'jsx'] },
    { pattern: /class|struct|object|model|entity/i, intent: 'class', confidence: 0.9 },
    { pattern: /function|method|handler|proc|def/i, intent: 'function', confidence: 0.88 },
    { pattern: /hook|use[A-Z]/i, intent: 'hook', confidence: 0.92 },
    
    // Data handling
    { pattern: /api|endpoint|route|rest|graphql/i, intent: 'api', confidence: 0.87 },
    { pattern: /database|db|sql|query|migration/i, intent: 'database', confidence: 0.85 },
    { pattern: /fetch|request|http|call/i, intent: 'http_request', confidence: 0.83 },
    
    // Testing
    { pattern: /test|spec|unit|integration|jest|pytest/i, intent: 'test', confidence: 0.91 },
    { pattern: /mock|stub|spy|fake/i, intent: 'mock', confidence: 0.86 },
    
    // Patterns & Architecture
    { pattern: /pattern|singleton|factory|observer|strategy/i, intent: 'design_pattern', confidence: 0.89 },
    { pattern: /error|exception|catch|handle.*error/i, intent: 'error_handling', confidence: 0.84 },
    { pattern: /async|await|promise|future|coroutine/i, intent: 'async', confidence: 0.88 },
    { pattern: /validate|check|verify|sanitize/i, intent: 'validation', confidence: 0.82 },
    
    // Utilities
    { pattern: /util|helper|tool|lib/i, intent: 'utility', confidence: 0.8 },
    { pattern: /config|setup|init|bootstrap/i, intent: 'configuration', confidence: 0.83 },
    { pattern: /log|debug|print|console/i, intent: 'logging', confidence: 0.81 }
  ];

  private static readonly LANGUAGE_KEYWORDS: Record<string, string[]> = {
    javascript: ['js', 'javascript', 'node', 'express', 'react', 'next', 'vue'],
    typescript: ['ts', 'typescript', 'angular', 'nestjs'],
    python: ['py', 'python', 'django', 'flask', 'fastapi'],
    go: ['go', 'golang'],
    java: ['java', 'spring', 'maven', 'gradle'],
    rust: ['rs', 'rust'],
    sql: ['sql', 'mysql', 'postgres', 'mongodb'],
    shell: ['bash', 'shell', 'zsh', 'script']
  };

  static async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = performance.now();
    
    const detectedIntent = this.detectIntent(request.query);
    const language = this.detectLanguage(request);
    const normalizedQuery = this.normalizeQuery(request.query);

    let suggestions = [];

    switch (detectedIntent.intent) {
      case 'create':
        suggestions = this.generateCreationSuggestions(normalizedQuery, language, request.context);
        break;
      case 'component':
        suggestions = this.generateComponentSuggestions(normalizedQuery, request.context);
        break;
      case 'function':
        suggestions = this.generateFunctionSuggestions(normalizedQuery, language);
        break;
      case 'test':
        suggestions = this.generateTestSuggestions(normalizedQuery, language);
        break;
      case 'api':
        suggestions = this.generateAPISuggestions(normalizedQuery, language);
        break;
      case 'error_handling':
        suggestions = this.generateErrorHandlingSuggestions(language);
        break;
      case 'async':
        suggestions = this.generateAsyncSuggestions(language);
        break;
      default:
        suggestions = this.generateGenericSuggestions(normalizedQuery, language);
    }

    if (request.context?.codeSnippet) {
      const contextBased = this.analyzeCodeContext(request.context.codeSnippet, language);
      suggestions = [...suggestions, ...contextBased].slice(0, 10);
    }

    const processingTime = performance.now() - startTime;

    return {
      suggestions: suggestions.sort((a, b) => b.confidence - a.confidence),
      processedQuery: normalizedQuery
    };
  }

  private static detectIntent(query: string): { intent: string; confidence: number } {
    let bestMatch = { intent: 'generic', confidence: 0.5 };

    for (const pattern of this.INTENT_PATTERNS) {
      if (pattern.pattern.test(query)) {
        if (pattern.confidence > bestMatch.confidence) {
          bestMatch = { intent: pattern.intent, confidence: pattern.confidence };
        }
      }
    }

    return bestMatch;
  }

  private static detectLanguage(request: AIRequest): string {
    if (request.context?.language) return request.context.language.toLowerCase();

    const queryLower = request.query.toLowerCase();
    
    for (const [lang, keywords] of Object.entries(this.LANGUAGE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (queryLower.includes(keyword)) return lang;
      }
    }

    if (request.context?.filePath) {
      const ext = request.context.filePath.split('.').pop()?.toLowerCase() || '';
      const extMap: Record<string, string> = {
        js: 'javascript',
        ts: 'typescript',
        jsx: 'javascript',
        tsx: 'typescript',
        py: 'python',
        go: 'go',
        java: 'java',
        rs: 'rust',
        sql: 'sql'
      };
      return extMap[ext] || 'javascript';
    }

    return 'javascript';
  }

  private static normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static generateCreationSuggestions(
    query: string,
    language: string,
    context?: AIRequest['context']
  ): Array<AIResponse['suggestions'][0]> {
    const suggestions: Array<AIResponse['suggestions'][0]> = [];

    if (query.includes('react') || query.includes('component')) {
      suggestions.push({
        text: `import React from 'react';

interface ${this.toPascalCase(query)}Props {}

const ${this.toPascalCase(query)}: React.FC<${this.toPascalCase(query)}Props> = () => {
  return <div>${this.toPascalCase(query)}</div>;
};

export default ${this.toPascalCase(query)};`,
        confidence: 0.95,
        type: 'snippet',
        source: 'local-ai-react-template'
      });
    }

    if (query.includes('function') || query.includes('func')) {
      const funcTemplate = language === 'python' 
        ? `def ${this.toSnakeCase(query)}(params):
    """${query}"""
    # Implementation
    pass`
        : language === 'go'
        ? `func ${this.toCamelCase(query)}(params) (result, error) {
    // Implementation
    return result, nil
}`
        : `const ${this.toCamelCase(query)} = (${language === 'typescript' ? 'params: any' : ''}) => {
    // Implementation
};`;

      suggestions.push({
        text: funcTemplate,
        confidence: 0.9,
        type: 'snippet',
        source: 'local-ai-function-template'
      });
    }

    if (query.includes('class') || query.includes('model')) {
      const classTemplate = language === 'python'
        ? `class ${this.toPascalCase(query)}:
    """${query} model."""
    
    def __init__(self):
        pass`
        : language === 'java'
        ? `public class ${this.toPascalCase(query)} {
    // Fields
    
    public ${this.toPascalCase(query)}() {
        // Constructor
    }
}`
        : `class ${this.toPascalCase(query)} {
    constructor(${language === 'typescript' ? 'private params' : ''}) {
        // Initialize
    }
}`;

      suggestions.push({
        text: classTemplate,
        confidence: 0.88,
        type: 'snippet',
        source: 'local-ai-class-template'
      });
    }

    return suggestions;
  }

  private static generateComponentSuggestions(
    query: string,
    context?: AIRequest['context']
  ): Array<AIResponse['suggestions'][0]> {
    const componentName = this.extractComponentName(query);

    return [{
      text: `import React, { useState, useEffect } from 'react';

interface ${componentName}Props {
  // Define props here
}

const ${componentName}: React.FC<${componentName}Props> = ({}) => {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Side effects
  }, []);

  return (
    <div className="${componentName}">
      {/* JSX */}
    </div>
  );
};

export default ${componentName};`,
      confidence: 0.93,
      type: 'snippet',
      source: 'local-ai-component-generator'
    }];
  }

  private static generateFunctionSuggestions(
    query: string,
    language: string
  ): Array<AIResponse['suggestions'][0]> {
    const funcName = this.toCamelCase(query.replace(/function|method|handler/gi, '').trim());

    if (language === 'python') {
      return [{
        text: `def ${this.toSnakeCase(funcName)}(*args, **kwargs):
    """
    ${funcName} - Generated function.
    
    Args:
        *args: Variable arguments
        **kwargs: Keyword arguments
        
    Returns:
        Result of operation
    """
    try:
        result = None
        return result
    except Exception as e:
        logger.error(f"${funcName} failed: {e}")
        raise`,
        confidence: 0.87,
        type: 'snippet',
        source: 'local-ai-python-func'
      }];
    }

    return [{
      text: `${language === 'typescript' ? 'async ' : ''}function ${funcName}(${language === 'typescripts' ? 'params: any' : ''})${language === 'typescript' ? ': Promise<any>' : ''} {
  try {
    const result = await /* operation */;
    return result;
  } catch (error) {
    console.error('${funcName} error:', error);
    throw error;
  }
}`,
      confidence: 0.86,
      type: 'snippet',
      source: 'local-ai-js-func'
    }];
  }

  private static generateTestSuggestions(
    query: string,
    language: string
  ): Array<AIResponse['suggestions'][0]> {
    if (language === 'python') {
      return [{
        text: `import pytest
from unittest.mock import Mock, patch

class Test${this.toPascalCase(query)}:
    def setup_method(self):
        self.mock_dependency = Mock()
        
    def test_${this.toSnakeCase(query)}_success(self):
        """Test successful execution."""
        # Given
        input_data = {}
        
        # When
        result = function_under_test(input_data)
        
        # Then
        assert result is not None
        
    def test_${this.toSnakeCase(query)}_error_handling(self):
        """Test error scenarios."""
        with pytest.raises(Exception):
            function_under_test(invalid_input)`,
        confidence: 0.9,
        type: 'snippet',
        source: 'local-ai-pytest'
      }];
    }

    return [{
      text: `describe('${this.toPascalCase(query)}', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle success case', async () => {
    // Arrange
    const input = {};
    
    // Act
    const result = await functionUnderTest(input);
    
    // Assert
    expect(result).toBeDefined();
  });

  it('should handle error cases', async () => {
    expect(async () => {
      await functionUnderTest(invalidInput);
    }).toThrow();
  });

  it('should call dependencies correctly', () => {
    const mockFn = jest.fn();
    mockFn();
    expect(mockFn).toHaveBeenCalled();
  });
});`,
      confidence: 0.89,
      type: 'snippet',
      source: 'local-ai-jest'
    }];
  }

  private static generateAPISuggestions(
    query: string,
    language: string
  ): Array<AIResponse['suggestions'][0]> {
    const endpoint = query.match(/(?:get|post|put|delete|patch)\s+(\/[\w/-]*)/i)?.[1] || '/resource';

    if (language === 'python') {
      return [{
        text: `from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

router = APIRouter(prefix="${endpoint}", tags=["${endpoint.split('/').pop()}"])

class CreateModel(BaseModel):
    name: str

@router.post("/", status_code=201)
async def create_resource(body: CreateModel):
    """Create new resource."""
    return {"id": 1, **body.dict()}

@router.get("/{resource_id}")
async def get_resource(resource_id: int):
    """Get resource by ID."""
    return {"id": resource_id, "name": "Example"}`,
        confidence: 0.85,
        type: 'snippet',
        source: 'local-ai-fastapi'
      }];
    }

    return [{
      text: `import express from 'express';
const router = express.Router();

// POST /${endpoint}
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const result = await service.create(data);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /${endpoint}/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await service.getById(id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;`,
      confidence: 0.86,
      type: 'snippet',
      source: 'local-ai-express'
    }];
  }

  private static generateErrorHandlingSuggestions(
    language: string
  ): Array<AIResponse['suggestions'][0]> {
    if (language === 'python') {
      return [{
        text: `import logging
from typing import Any

logger = logging.getLogger(__name__)

class AppError(Exception):
    """Base application error."""
    def __init__(self, message: str, code: str = "ERROR", status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code

def handle_errors(func):
    """Error handling decorator."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except AppError as e:
            logger.error(f"AppError in {func.__name__}: {e}")
            raise
        except Exception as e:
            logger.exception(f"Unexpected error in {func.__name__}")
            raise AppError("Internal error", "INTERNAL_ERROR")
    return wrapper`,
        confidence: 0.83,
        type: 'snippet',
        source: 'local-ai-error-python'
      }];
    }

    return [{
      text: `class CustomError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 500) {
    super(message);
    this.name = 'CustomError';
  }
}

async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(\`Error in \${context}:\`, error);
    
    if (error instanceof CustomError) {
      throw error;
    }
    
    throw new CustomError(
      \`Operation failed: \${context}\`,
      'OPERATION_FAILED',
      500
    );
  }
}`,
      confidence: 0.82,
      type: 'snippet',
      source: 'local-ai-error-js'
    }];
  }

  private static generateAsyncSuggestions(
    language: string
  ): Array<AIResponse['suggestions'][0]> {
    if (language === 'python') {
      return [{
        text: `import asyncio
from typing import Coroutine, Any

async def execute_with_retry(
    coroutine: Coroutine[Any, Any, T],
    max_retries: int = 3,
    delay: float = 1.0
) -> T:
    """Execute async operation with retry logic."""
    last_error = None
    
    for attempt in range(max_retries):
        try:
            return await coroutine
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                await asyncio.sleep(delay * (2 ** attempt))  # Exponential backoff
    
    raise last_error or Exception("All retries exhausted")

async def batch_process(
    items: list[T],
    processor: callable,
    batch_size: int = 100,
    concurrency: int = 10
) -> list[Any]:
    """Process items in batches with controlled concurrency."""
    semaphore = asyncio.Semaphore(concurrency)
    results = []
    
    async def process_item(item: T):
        async with semaphore:
            return await processor(item)
    
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        batch_results = await asyncio.gather(
            *[process_item(item) for item in batch],
            return_exceptions=True
        )
        results.extend([r for r in batch_results if not isinstance(r, Exception)])
    
    return results`,
        confidence: 0.84,
        type: 'snippet',
        source: 'local-ai-async-python'
      }];
    }

    return [{
      text: `async function parallelExecution<T>(
    tasks: (() => Promise<T>)[],
    maxConcurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = [];
    const executing = new Set<Promise<void>>();

    for (const task of tasks) {
      const promise = task().then(result => {
        results.push(result);
        executing.delete(promise);
      });

      executing.add(promise);

      if (executing.size >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
    throw new Error('Unreachable');
  }

// Usage example:
// const results = await parallelExecution(tasks, 3);
// const data = await retryWithBackoff(() => fetchData());`,
      confidence: 0.83,
      type: 'snippet',
      source: 'local-ai-async-js'
    }];
  }

  private static generateGenericSuggestions(
    query: string,
    language: string
  ): Array<AIResponse['suggestions'][0]> {
    return [{
      text: `// Generated based on query: "${query}"
// Language: ${language}
// Tip: Be more specific for better suggestions (e.g., "create React component" or "Python async function")`,
      confidence: 0.6,
      type: 'explanation',
      source: 'local-ai-generic'
    }];
  }

  private static analyzeCodeContext(
    codeSnippet: string,
    language: string
  ): Array<AIResponse['suggestions'][0]> {
    const suggestions: Array<AIResponse['suggestions'][0]> = [];
    const lowerCode = codeSnippet.toLowerCase();

    if (lowerCode.includes('usestate') && !lowerCode.includes('useeffect')) {
      suggestions.push({
        text: `useEffect(() => {
  // Side effect based on state changes
}, [dependency]);`,
        confidence: 0.78,
        type: 'completion',
        source: 'context-analysis-hooks'
      });
    }

    if ((lowerCode.includes('try') || lowerCode.includes('catch')) && !lowerCode.includes('finally')) {
      suggestions.push({
        text: `finally {
  // Cleanup resources
}`,
        confidence: 0.76,
        type: 'completion',
        source: 'context-analysis-error'
      });
    }

    if (lowerCode.includes('map(') && !lowerCode.includes('filter(')) {
      suggestions.push({
        text: `.filter(item => condition)`,
        confidence: 0.74,
        type: 'completion',
        source: 'context-analysis-array'
      });
    }

    return suggestions;
  }

  private static toPascalCase(str: string): string {
    return str.replace(/(\w)(\w*)/g, (_, first, rest) =>
      first.toUpperCase() + rest.toLowerCase()
    ).replace(/\s+/g, '');
  }

  private static toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private static toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }

  private static extractComponentName(query: string): string {
    const words = query.split(/\s+/).filter(w => 
      !['create', 'new', 'make', 'react', 'component'].includes(w.toLowerCase())
    );
    
    if (words.length > 0) {
      return this.toPascalCase(words.join(' '));
    }
    
    return 'MyComponent';
  }
}

export const localAICore = LocalAICore;