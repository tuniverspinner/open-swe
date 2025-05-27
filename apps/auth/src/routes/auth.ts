import express from 'express';
import passport from '../passport.js';
import { ensureAuthenticated, GitHubUser } from '../passport.js';

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
    
    // In a real application, you might redirect to a frontend URL with a token
    // For now, we'll return user information
    res.json({
      success: true,
      message: 'Authentication successful',
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

export default router;
