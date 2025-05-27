import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { GitHubUser } from '../passport.js';

// JWT payload interface
export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Extended request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: GitHubUser;
  jwtPayload?: JWTPayload;
}

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate JWT access token for authenticated user
 */
export const generateAccessToken = (user: GitHubUser): string => {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    email: user.email
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'open-swe-auth',
    audience: 'open-swe-client'
  });
};

/**
 * Generate JWT refresh token for authenticated user
 */
export const generateRefreshToken = (user: GitHubUser): string => {
  const payload = {
    userId: user.id,
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'open-swe-auth',
    audience: 'open-swe-client'
  });
};

/**
 * Verify and decode JWT token
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'open-swe-auth',
      audience: 'open-swe-client'
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * JWT authentication middleware
 * Validates JWT token from Authorization header or cookies
 */
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.cookies?.accessToken;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.jwtPayload = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Optional JWT authentication middleware
 * Validates JWT token if present, but doesn't require it
 */
export const optionalJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.cookies?.accessToken;

  if (token) {
    try {
      const decoded = verifyToken(token);
      req.jwtPayload = decoded;
    } catch (error) {
      // Token is invalid, but we don't fail the request
      // Just continue without setting jwtPayload
    }
  }
  
  next();
};
