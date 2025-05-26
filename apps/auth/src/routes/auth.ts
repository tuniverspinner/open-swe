import { Router, Request, Response, NextFunction } from 'express';
import { GitHubService } from '../services/github.js';
import { JWTService } from '../services/jwt.js';
import { sessionStore } from '../services/session.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { authenticateSession } from '../middleware/auth.js';
import { config } from '../config/index.js';

const router = Router();

/**
 * GET /auth/login
 * Initiate GitHub OAuth flow
 */
router.get('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { redirect_url } = req.query;
    
    // Create auth state for CSRF protection
    const state = await sessionStore.createAuthState(redirect_url as string);
    
    // Generate GitHub OAuth URL
    const authUrl = GitHubService.generateAuthUrl(state);
    
    logger.info('OAuth flow initiated', { state, redirect_url });
    
    res.json({
      authUrl,
      state,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/callback
 * Handle GitHub OAuth callback
 */
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query;
    
    // Handle OAuth errors
    if (error) {
      logger.warn('OAuth callback error', { error });
      throw createError(`OAuth error: ${error}`, 400);
    }
    
    if (!code || !state) {
      throw createError('Missing code or state parameter', 400);
    }
    
    // Verify state parameter
    const authState = await sessionStore.getAuthState(state as string);
    if (!authState) {
      throw createError('Invalid or expired state parameter', 400);
    }
    
    // Exchange code for access token
    const tokenResponse = await GitHubService.exchangeCodeForToken(code as string);
    
    // Get user information
    const user = await GitHubService.createAuthenticatedUser(tokenResponse.access_token);
    
    // Create session
    const sessionId = await sessionStore.createSession(user);
    
    // Generate JWT tokens
    const accessToken = JWTService.generateAccessToken(user);
    const refreshToken = JWTService.generateRefreshToken(user);
    
    // Set session cookie
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: config.session.maxAge,
    });
    
    // Clean up auth state
    await sessionStore.deleteAuthState(state as string);
    
    logger.info('OAuth flow completed', { 
      userId: user.id, 
      login: user.login,
      scopes: user.scopes 
    });
    
    // Redirect to frontend or return tokens
    if (authState.redirectUrl) {
      const redirectUrl = new URL(authState.redirectUrl);
      redirectUrl.searchParams.set('token', accessToken);
      res.redirect(redirectUrl.toString());
    } else {
      res.json({
        user: {
          id: user.id,
          login: user.login,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
        },
        accessToken,
        refreshToken,
        expiresIn: config.jwt.expiresIn,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', authenticateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies?.sessionId;
    
    if (sessionId) {
      await sessionStore.deleteSession(sessionId);
    }
    
    // Clear session cookie
    res.clearCookie('sessionId');
    
    logger.info('User logged out', { userId: req.session?.userId });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', authenticateSession, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.session!;
    
    res.json({
      id: session.userId,
      login: session.login,
      scopes: session.scopes,
      lastAccessedAt: session.lastAccessedAt,
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };

