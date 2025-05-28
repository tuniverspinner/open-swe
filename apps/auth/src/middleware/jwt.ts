import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

// Interface for JWT payload
export interface JWTPayload {
  userId: number;
  username: string;
  githubAccessToken: string;
  scopes: string[];
  iat?: number;
  exp?: number;
}

// Interface for authenticated request
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Generate a JWT token for an authenticated user
 * @param payload - User data to include in the token
 * @returns Signed JWT token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  try {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  } catch (error) {
    console.error('Error generating JWT token:', error);
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @returns Decoded JWT payload
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as JWTPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      console.error('Error verifying JWT token:', error);
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Express middleware to validate JWT tokens
 * Extracts token from Authorization header and validates it
 */
export function validateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization header provided',
      });
      return;
    }

    // Check for Bearer token format
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!tokenMatch) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Expected: Bearer <token>',
      });
      return;
    }

    const token = tokenMatch[1];

    // Verify and decode the token
    const decoded = verifyToken(token);
    
    // Attach user data to request object
    req.user = decoded;
    
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token validation failed';
    res.status(401).json({
      error: 'Unauthorized',
      message,
    });
  }
}


