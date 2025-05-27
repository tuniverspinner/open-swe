import { Request, Response, NextFunction } from 'express';

export enum ErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  OAUTH_ERROR = 'OAUTH_ERROR',
  JWT_ERROR = 'JWT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;

  constructor(message: string, type: ErrorType, statusCode: number = 500) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
  }
}

export const globalErrorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        type: error.type,
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  res.status(500).json({
    success: false,
    error: {
      type: ErrorType.INTERNAL_ERROR,
      message: 'An internal server error occurred',
      timestamp: new Date().toISOString()
    }
  });
};
