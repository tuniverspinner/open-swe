import { Request, Response, NextFunction } from 'express';
import { SessionStore } from '../services/session.js';
import { GitHubOAuthService } from '../services/github.js';
import { UserSession } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      session?: UserSession;
      user?: UserSession['user'];
    }
  }
}

export class AuthMiddleware {
  constructor(
    private sessionStore: SessionStore,
    private githubService: GitHubOAuthService
  ) {}

  /**
   * Middleware to require authentication
   */
  requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.headers.authorization?.replace('Bearer ', '') || 
                       req.query.session_id as string ||
                       req.body.session_id;

      if (!sessionId) {
        res.status(401).json({ 
          error: 'Authentication required',
          message: 'No session ID provided' 
        });
        return;
      }

      const session = this.sessionStore.getSession(sessionId);
      if (!session) {
        res.status(401).json({ 
          error: 'Invalid session',
          message: 'Session not found' 
        });
        return;
      }

      // Check if token is expired and try to refresh
      if (this.sessionStore.isSessionExpired(session)) {
        if (session.refreshToken && !this.sessionStore.isRefreshTokenExpired(session)) {
          try {
            const newToken = await this.githubService.refreshToken(session.refreshToken);
            const updatedSession = this.sessionStore.updateSession(sessionId, newToken);
            if (updatedSession) {
              req.session = updatedSession;
              req.user = updatedSession.user;
              next();
              return;
            }
          } catch (error) {
            console.error('Failed to refresh token:', error);
          }
        }
        
        res.status(401).json({ 
          error: 'Session expired',
          message: 'Please re-authenticate' 
        });
        return;
      }

      // Validate token with GitHub
      const isValid = await this.githubService.validateToken(session.accessToken);
      if (!isValid) {
        this.sessionStore.deleteSession(sessionId);
        res.status(401).json({ 
          error: 'Invalid token',
          message: 'Token is no longer valid' 
        });
        return;
      }

      req.session = session;
      req.user = session.user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Optional authentication middleware
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.requireAuth(req, res, () => {
        // If auth succeeds, continue
        next();
      });
    } catch {
      // If auth fails, continue without user
      next();
    }
  };
}

