enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
}

class Logger {
  private enabled: boolean = true;
  private logLevel: LogLevel = LogLevel.DEBUG;
  private history: LogEntry[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    this.enabled = import.meta.env?.DEV !== false;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private log(level: LogLevel, module: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      module,
      message,
      data
    };

    this.history.push(entry);
    
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    const prefix = `[${entry.timestamp}] [${level}] [${module}]`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, data ? data : '');
        break;
      case LogLevel.INFO:
        console.info(prefix, message, data ? data : '');
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, data ? data : '');
        break;
      case LogLevel.ERROR:
        console.error(prefix, message, data ? data : '');
        break;
    }
  }

  debug(module: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, module, message, data);
  }

  info(module: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, module, message, data);
  }

  warn(module: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, module, message, data);
  }

  error(module: string, message: string, error?: Error | any): void {
    this.log(LogLevel.ERROR, module, message, error);
  }

  getHistory(filter?: { level?: LogLevel; module?: string }): LogEntry[] {
    let filtered = [...this.history];
    
    if (filter?.level) {
      filtered = filtered.filter(entry => entry.level === filter.level);
    }
    
    if (filter?.module) {
      filtered = filtered.filter(entry => entry.module === filter.module);
    }
    
    return filtered;
  }

  clearHistory(): void {
    this.history = [];
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

export const logger = new Logger();
export { LogLevel };
export type { LogEntry };