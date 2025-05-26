import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { JWTPayload, AuthenticatedUser } from '../types/auth.js';
import { createError } from '../middleware/errorHandler.js';

export class JWTService {
  /**
   * Generate JWT access token
   */
  static generateAccessToken(user: AuthenticatedUser): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      login: user.login,
      scopes: user.scopes,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
      issuer: 'open-swe-auth',
      audience: 'open-swe-api',
    });
  }

  /**
   * Generate JWT refresh token
   */
  static generateRefreshToken(user: AuthenticatedUser): string {
    const payload = {
      userId: user.id,
      login: user.login,
      type: 'refresh',
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
      issuer: 'open-swe-auth',
      audience: 'open-swe-api',
    });
  }

  /**
   * Verify and decode JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: 'open-swe-auth',
        audience: 'open-swe-api',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      logger.debug('JWT verification failed', { error });
      
      if (error instanceof jwt.TokenExpiredError) {
        throw createError('Token has expired', 401);
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw createError('Invalid token', 401);
      } else {
        throw createError('Token verification failed', 401);
      }
    }
  }

  /**
   * Decode JWT token without verification (for debugging)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      logger.debug('JWT decode failed', { error });
      return null;
    }
  }
}

