interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      backoffMultiplier = 2,
      shouldRetry = (error) => 
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.name === 'AbortError'
    } = options;

    let lastError: Error | undefined;
    let currentDelay = retryDelay;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const data = await operation();
        
        if (attempt > 1) {
          console.log(`[Retry] Operation succeeded after ${attempt} attempts`);
        }
        
        return {
          success: true,
          data,
          attempts: attempt
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn(`[Retry] Attempt ${attempt}/${maxRetries + 1} failed:`, lastError.message);

        if (attempt <= maxRetries && shouldRetry(lastError)) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay *= backoffMultiplier;
        } else if (!shouldRetry(lastError)) {
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: maxRetries + 1
    };
  }

  static async withRetrySimple<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    const result = await this.withRetry(operation, { maxRetries });
    
    if (!result.success || !result.data) {
      throw result.error || new Error('Operation failed after retries');
    }
    
    return result.data;
  }
}

export { RetryHandler, type RetryOptions, type RetryResult };
