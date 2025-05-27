import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import axios from 'axios';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `http://localhost:${PORT}/auth/github/callback`;

// In-memory store for OAuth state (in production, use Redis or database)
const oauthStates = new Map<string, { timestamp: number; redirectUrl?: string }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      oauthStates.delete(state);
    }
  }
}, 10 * 60 * 1000);

// GitHub OAuth endpoints

// Initiate OAuth flow
app.get('/auth/github', (req, res) => {
  try {
    if (!GITHUB_CLIENT_ID) {
      return res.status(500).json({ error: 'GitHub OAuth not configured' });
    }

    // Generate secure random state parameter
    const state = crypto.randomBytes(32).toString('hex');
    const redirectUrl = req.query.redirect_url as string;
    
    // Store state with timestamp for validation
    oauthStates.set(state, { 
      timestamp: Date.now(),
      redirectUrl: redirectUrl 
    });

    // GitHub OAuth scopes for repository access
    const scopes = [
      'repo', // Full control of private repositories
      'user:email', // Access to user email addresses
      'read:user' // Read access to user profile
    ].join(' ');

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
    githubAuthUrl.searchParams.set('scope', scopes);
    githubAuthUrl.searchParams.set('state', state);
    githubAuthUrl.searchParams.set('allow_signup', 'true');

    res.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// Handle OAuth callback
app.get('/auth/github/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return res.status(400).json({ error: `OAuth error: ${error}` });
    }

    // Validate required parameters
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Validate state parameter
    const stateData = oauthStates.get(state as string);
    if (!stateData) {
      return res.status(400).json({ error: 'Invalid or expired state parameter' });
    }

    // Remove used state
    oauthStates.delete(state as string);

    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code,
      redirect_uri: GITHUB_REDIRECT_URI
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const { access_token, token_type, scope } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({ error: 'Failed to obtain access token' });
    }

    // Get user information
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const userData = userResponse.data;

    // For now, return the token and user data (in next task, we'll create JWT)
    res.json({
      success: true,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        email: userData.email,
        avatar_url: userData.avatar_url
      },
      github_token: access_token,
      scope: scope,
      redirect_url: stateData.redirectUrl
    });

  } catch (error) {
    console.error('Error in OAuth callback:', error);
    if (axios.isAxiosError(error)) {
      console.error('GitHub API error:', error.response?.data);
    }
    res.status(500).json({ error: 'Failed to complete OAuth flow' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'GitHub OAuth Authentication Server' });
});

app.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});


