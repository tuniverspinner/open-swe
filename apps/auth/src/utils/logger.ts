import { config } from '../config/index.js';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

class Logger {
  private logLevel: LogLevel;
  private format: 'json' | 'simple';

  constructor() {
    this.logLevel = config.logging.level;
    this.format = config.logging.format;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    return levels[level] <= levels[this.logLevel];
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata }),
    };

    const output = this.format === 'json' 
      ? JSON.stringify(entry)
      : `[${entry.timestamp}] ${level.toUpperCase()}: ${message}${metadata ? ` ${JSON.stringify(metadata)}` : ''}`;

    console.log(output);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }
}

export const logger = new Logger();

