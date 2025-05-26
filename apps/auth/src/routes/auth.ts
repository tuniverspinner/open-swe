import { Router, Request, Response } from 'express';
import { GitHubOAuthService } from '../services/github.js';
import { SessionStore } from '../services/session.js';
import { AuthMiddleware } from '../middleware/auth.js';
import { AuthStatus } from '../types/index.js';

export function createAuthRoutes(
  githubService: GitHubOAuthService,
  sessionStore: SessionStore,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  /**
   * GET /auth/github
   * Initiate GitHub OAuth flow
   */
  router.get('/github', (req: Request, res: Response) => {
    try {
      const state = req.query.state as string;
      const authUrl = githubService.getAuthorizationUrl(state);
      
      res.json({
        authUrl,
        message: 'Redirect user to this URL to begin GitHub OAuth flow'
      });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ 
        error: 'Failed to generate authorization URL' 
      });
    }
  });

  /**
   * GET /auth/callback
   * Handle GitHub OAuth callback
   */
  router.get('/callback', async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        res.status(400).json({ 
          error: 'OAuth authorization failed',
          details: error 
        });
        return;
      }

      if (!code) {
        res.status(400).json({ 
          error: 'Missing authorization code' 
        });
        return;
      }

      // Exchange code for token
      const token = await githubService.exchangeCodeForToken(code as string);
      
      // Get user information
      const user = await githubService.getUserInfo(token.access_token);
      
      // Create session
      const session = sessionStore.createSession(user, token);
      
      res.json({
        success: true,
        sessionId: session.id,
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          avatar_url: user.avatar_url,
        },
        scopes: session.scopes,
        expiresAt: session.tokenExpiresAt,
        ...(state && { state }),
      });
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ 
        error: 'Failed to complete OAuth flow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /auth/status
   * Check authentication status
   */
  router.get('/status', authMiddleware.optionalAuth, (req: Request, res: Response) => {
    try {
      const status: AuthStatus = {
        authenticated: !!req.session,
        ...(req.session && {
          user: req.session.user,
          scopes: req.session.scopes,
          expiresAt: req.session.tokenExpiresAt,
        }),
      };

      res.json(status);
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({ 
        error: 'Failed to check authentication status' 
      });
    }
  });

  /**
   * POST /auth/logout
   * Logout user and invalidate session
   */
  router.post('/logout', authMiddleware.requireAuth, (req: Request, res: Response) => {
    try {
      const sessionId = req.headers.authorization?.replace('Bearer ', '') || 
                       req.query.session_id as string ||
                       req.body.session_id;

      if (sessionId) {
        sessionStore.deleteSession(sessionId);
      }

      res.json({ 
        success: true,
        message: 'Successfully logged out' 
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ 
        error: 'Failed to logout' 
      });
    }
  });

  /**
   * GET /auth/repositories
   * Get user's accessible repositories
   */
  router.get('/repositories', authMiddleware.requireAuth, async (req: Request, res: Response) => {
    try {
      const repositories = await githubService.getUserRepositories(req.session!.accessToken);
      res.json({ repositories });
    } catch (error) {
      console.error('Error fetching repositories:', error);
      res.status(500).json({ 
        error: 'Failed to fetch repositories' 
      });
    }
  });

  return router;
}

