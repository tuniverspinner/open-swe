import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import dotenv from 'dotenv';
import { OAuthApp } from '@octokit/oauth-app';
import { Octokit } from '@octokit/rest';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize GitHub OAuth App
const oauthApp = new OAuthApp({
  clientType: 'oauth-app',
  clientId: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
});

// Extend session interface to include user data
declare module 'express-session' {
  interface SessionData {
    user?: { id: number; login: string; name: string; email: string; avatar_url: string; access_token: string };
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'GitHub OAuth Authentication Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth/github',
      callback: '/auth/github/callback',
      user: '/auth/user',
      logout: '/auth/logout'
    }
  });
});

// GitHub OAuth endpoints

// Initiate GitHub OAuth flow
app.get('/auth/github', (req, res) => {
  try {
    const state = Math.random().toString(36).substring(2, 15);
    req.session.oauthState = state;
    
    const { url } = oauthApp.getWebFlowAuthorizationUrl({
      state,
      scopes: ['repo', 'user:email', 'read:user'],
      redirectUrl: process.env.GITHUB_CALLBACK_URL || `http://localhost:${PORT}/auth/github/callback`,
    });
    
    res.redirect(url);
  } catch (error) {
    console.error('Error initiating GitHub OAuth:', error);
    res.status(500).json({ 
      error: 'Failed to initiate GitHub authentication',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Authentication error'
    });
  }
});

// Handle GitHub OAuth callback
app.get('/auth/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Validate state parameter to prevent CSRF attacks
    if (!state || state !== req.session.oauthState) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }
    
    // Clear the state from session
    delete req.session.oauthState;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }
    
    // Exchange code for access token
    const { token } = await oauthApp.createToken({
      code: code as string,
    });
    
    // Get user information using the access token
    const octokit = new Octokit({
      auth: token,
    });
    
    const { data: user } = await octokit.rest.users.getAuthenticated();
    
    // Store user information in session
    req.session.user = {
      id: user.id,
      login: user.login,
      name: user.name || user.login,
      email: user.email || '',
      avatar_url: user.avatar_url,
      access_token: token,
    };
    
    // Redirect to frontend success page or return success response
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/success`);
    
  } catch (error) {
    console.error('Error in GitHub OAuth callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent('Authentication failed')}`);
  }
});

// Get current user information
app.get('/auth/user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Return user info without access token for security
  const { access_token, ...userInfo } = req.session.user;
  res.json({ user: userInfo });
});

// Check authentication status
app.get('/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.user,
    user: req.session.user ? {
      id: req.session.user.id,
      login: req.session.user.login,
      name: req.session.user.name,
      avatar_url: req.session.user.avatar_url
    } : null
  });
});

// Logout endpoint
app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    
    res.clearCookie('connect.sid'); // Clear session cookie
    res.json({ message: 'Logged out successfully' });
  });
});

// Get user's GitHub access token (for internal API use)
app.get('/auth/token', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({ access_token: req.session.user.access_token });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GitHub OAuth Auth Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;


