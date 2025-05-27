import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        login: string;
        name: string;
        email: string;
        avatar_url: string;
        github_token: string;
      };
    }
  }
}

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export interface UserPayload {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  github_token: string;
}

export interface JWTPayload {
  user: UserPayload;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Generate JWT access token for authenticated user
 */
export function generateAccessToken(user: UserPayload): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    user,
    type: 'access'
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'open-swe-auth',
    audience: 'open-swe-client'
  });
}

/**
 * Generate JWT refresh token for token renewal
 */
export function generateRefreshToken(user: UserPayload): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    user: {
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      github_token: user.github_token
    },
    type: 'refresh'
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'open-swe-auth',
    audience: 'open-swe-client'
  });
}

/**
 * Middleware to validate JWT access tokens
 */
export function validateAccessToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies.access_token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'open-swe-auth',
      audience: 'open-swe-client'
    }) as JWTPayload;

    if (decoded.type !== 'access') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    req.user = decoded.user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else {
      console.error('JWT validation error:', error);
      res.status(500).json({ error: 'Token validation failed' });
    }
  }
}

/**
 * Middleware to validate JWT refresh tokens
 */
export function validateRefreshToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.cookies.refresh_token || req.body.refresh_token;

    if (!token) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'open-swe-auth',
      audience: 'open-swe-client'
    }) as JWTPayload;

    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    req.user = decoded.user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid refresh token' });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Refresh token expired' });
    } else {
      console.error('JWT refresh token validation error:', error);
      res.status(500).json({ error: 'Refresh token validation failed' });
    }
  }
}
