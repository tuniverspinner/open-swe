import express from 'express';
import passport from '../passport.js';
import { ensureAuthenticated, GitHubUser } from '../passport.js';
import { generateAccessToken, generateRefreshToken, authenticateJWT, AuthenticatedRequest } from '../middleware/jwt.js';

const router = express.Router();

// GitHub OAuth authorization endpoint
router.get('/github', passport.authenticate('github', {
  scope: ['user:email', 'repo', 'write:repo_hook', 'read:org']
}));

// GitHub OAuth callback endpoint
router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // Successful authentication
    const user = req.user as GitHubUser;
    
    // Generate JWT tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Set tokens as HTTP-only cookies for security
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({
      success: true,
      message: 'Authentication successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        profileUrl: user.profileUrl
      }
    });
  }
);

// Authentication failure endpoint
router.get('/failure', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Authentication failed'
  });
});

// Token refresh endpoint
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  // In a production app, you would validate the refresh token and generate new tokens
  // For now, we'll return an error as we need to implement refresh token validation
  res.status(501).json({ error: 'Token refresh not yet implemented' });
});

// Get current user information
router.get('/user', ensureAuthenticated, (req, res) => {
  const user = req.user as GitHubUser;
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl
  });
});

// Get current user information using JWT
router.get('/user/jwt', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const jwtPayload = req.jwtPayload;
  if (!jwtPayload) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }
  
  res.json({
    userId: jwtPayload.userId,
    username: jwtPayload.username,
    email: jwtPayload.email
  });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Session destruction failed' });
      }
      res.clearCookie('connect.sid');
      // Clear JWT cookies as well
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });
});

// Get user's GitHub access token (protected endpoint)
router.get('/token', ensureAuthenticated, (req, res) => {
  const user = req.user as GitHubUser;
  res.json({
    accessToken: user.accessToken,
    username: user.username
  });
});

// Get user's GitHub access token using JWT authentication
router.get('/token/jwt', authenticateJWT, (req: AuthenticatedRequest, res) => {
  // In a real application, you would fetch the GitHub access token from database using the JWT payload
  // For now, we'll return an error as we need to implement token storage/retrieval
  res.status(501).json({ error: 'GitHub token retrieval via JWT not yet implemented' });
});

export default router;

