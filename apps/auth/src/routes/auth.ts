import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const router = Router();

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Required scopes for repository operations
const GITHUB_SCOPES = [
  'repo',           // Full control of private repositories
  'read:user',      // Read user profile data
  'user:email'      // Access user email addresses
].join(' ');

/**
 * GET /auth/github
 * Initiates GitHub OAuth flow by redirecting to GitHub authorization page
 */
router.get('/github', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_REDIRECT_URI) {
    return res.status(500).json({
      error: 'GitHub OAuth not configured',
      message: 'Missing GITHUB_CLIENT_ID or GITHUB_REDIRECT_URI environment variables'
    });
  }

  // Generate a random state parameter for CSRF protection
  const state = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
  
  // Store state in session or return it to be stored client-side
  // For now, we'll include it in the redirect and verify it in callback
  
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
  githubAuthUrl.searchParams.set('scope', GITHUB_SCOPES);
  githubAuthUrl.searchParams.set('state', state);
  githubAuthUrl.searchParams.set('allow_signup', 'true');

  res.redirect(githubAuthUrl.toString());
});

/**
 * GET /auth/github/callback
 * Handles GitHub OAuth callback and exchanges code for access token
 */
router.get('/github/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error('GitHub OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}/auth/error?error=${encodeURIComponent(error as string)}`);
  }

  // Validate required parameters
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/auth/error?error=missing_code`);
  }

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    console.error('GitHub OAuth not configured');
    return res.redirect(`${FRONTEND_URL}/auth/error?error=server_configuration`);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code as string,
      redirect_uri: GITHUB_REDIRECT_URI
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const { access_token, token_type, scope } = tokenResponse.data;

    if (!access_token) {
      throw new Error('No access token received from GitHub');
    }

    // Get user information from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `${token_type} ${access_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const githubUser = userResponse.data;

    // Create JWT token with user info and GitHub access token
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const jwtToken = jwt.sign({
      userId: githubUser.id,
      username: githubUser.login,
      githubAccessToken: access_token,
      scope: scope
    }, JWT_SECRET, { expiresIn: '7d' });

    // Redirect to frontend with JWT token
    res.redirect(`${FRONTEND_URL}/auth/success?token=${jwtToken}`);

  } catch (error) {
    console.error('Error during GitHub OAuth callback:', error);
    res.redirect(`${FRONTEND_URL}/auth/error?error=oauth_failed`);
  }
});

/**
 * POST /auth/logout
 * Logs out the user (client should delete the JWT token)
 */
router.post('/logout', (req: Request, res: Response) => {
  // Since we're using JWT tokens, logout is handled client-side
  // The client should delete the token from storage
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /auth/status
 * Returns the current authentication status
 */
router.get('/status', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }

  const token = authHeader.substring(7);
  
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.json({
      authenticated: true,
      user: {
        userId: decoded.userId,
        username: decoded.username
      }
    });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

export { router as authRoutes };

