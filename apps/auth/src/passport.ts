import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';

// User interface for TypeScript
export interface GitHubUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  accessToken: string;
  refreshToken?: string;
  profileUrl: string;
}

// Configure GitHub OAuth strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/github/callback',
  scope: ['user:email', 'repo', 'write:repo_hook', 'read:org']
}, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
  try {
    // Extract user information from GitHub profile
    const user: GitHubUser = {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName || profile.username,
      email: profile.emails?.[0]?.value || '',
      avatarUrl: profile.photos?.[0]?.value || '',
      accessToken,
      refreshToken,
      profileUrl: profile.profileUrl
    };

    // In a real application, you would save the user to a database here
    // For now, we'll just pass the user object to the session
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Serialize user for session storage
passport.serializeUser((user: any, done) => {
  // Store the entire user object in the session
  // In production, you might want to store only the user ID and fetch from database
  done(null, user);
});

// Deserialize user from session storage
passport.deserializeUser((user: any, done) => {
  // In production, you would fetch the user from database using the stored ID
  // For now, we'll just return the stored user object
  done(null, user);
});

// Middleware to check if user is authenticated
export const ensureAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

export default passport;
