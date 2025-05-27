import { config } from '../config/index.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogData {
  [key: string]: any;
}

class Logger {
  private log(level: LogLevel, message: string, data?: LogData): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };

    if (config.env === 'development') {
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data ? data : '');
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  info(message: string, data?: LogData): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: LogData): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: LogData): void {
    this.log('error', message, data);
  }

  debug(message: string, data?: LogData): void {
    if (config.env === 'development') {
      this.log('debug', message, data);
    }
  }
}

export const logger = new Logger();

