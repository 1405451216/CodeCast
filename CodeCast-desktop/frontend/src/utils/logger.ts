export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

class Logger {
  private static currentLevel = LogLevel.INFO;

  static setLevel(level: LogLevel): void {
    Logger.currentLevel = level;
  }

  static debug(...args: any[]): void {
    if (Logger.currentLevel <= LogLevel.DEBUG) {
      console.debug('[CodeCast][DEBUG]', ...args);
    }
  }

  static info(...args: any[]): void {
    if (Logger.currentLevel <= LogLevel.INFO) {
      console.info('[CodeCast]', ...args);
    }
  }

  static warn(...args: any[]): void {
    if (Logger.currentLevel <= LogLevel.WARN) {
      console.warn('[CodeCast][WARN]', ...args);
    }
  }

  static error(...args: any[]): void {
    if (Logger.currentLevel <= LogLevel.ERROR) {
      console.error('[CodeCast][ERROR]', ...args);
    }
  }

  static isProduction(): boolean {
    return import.meta.env?.MODE === 'production' || 
           import.meta.env?.NODE_ENV === 'production';
  }
}

if (Logger.isProduction()) {
  Logger.setLevel(LogLevel.WARN);
} else {
  Logger.setLevel(LogLevel.DEBUG);
}

export const logger = Logger;
export { Logger };
