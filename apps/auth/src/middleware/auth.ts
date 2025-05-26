import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwt.js';
import { sessionStore } from '../services/session.js';
import { logger } from '../utils/logger.js';
import { createError } from './errorHandler.js';
import { JWTPayload, UserSession } from '../types/auth.js';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      session?: UserSession;
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw createError('Access token required', 401);
    }

    // Verify JWT token
    const payload = JWTService.verifyToken(token);
    req.user = payload;

    logger.debug('Token authenticated', { userId: payload.userId, login: payload.login });
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to authenticate session cookies
 */
export const authenticateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.cookies?.sessionId;

    if (!sessionId) {
      throw createError('Session required', 401);
    }

    // Get session from store
    const session = await sessionStore.getSession(sessionId);
    if (!session) {
      throw createError('Invalid or expired session', 401);
    }

    req.session = session;
    logger.debug('Session authenticated', { userId: session.userId, login: session.login });
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if user has required scopes
 */
export const requireScopes = (requiredScopes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userScopes = req.user?.scopes || req.session?.scopes || [];
    
    const hasRequiredScopes = requiredScopes.every(scope => 
      userScopes.includes(scope)
    );

    if (!hasRequiredScopes) {
      return next(createError(`Required scopes: ${requiredScopes.join(', ')}`, 403));
    }

    next();
  };
};

