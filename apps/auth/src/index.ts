import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import axios from 'axios';
import { config } from './config/index.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.server.frontendUrl,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'auth-server',
  });
});

// GitHub OAuth endpoints
app.get('/auth/github', (req, res) => {
  // Validate required environment variables
  if (!config.github.clientId) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'GitHub Client ID is not configured',
    });
  }

  // Generate a random state parameter for CSRF protection
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // Store state in session or return it to be stored client-side
  // For now, we'll include it in the redirect and validate it in the callback
  
  // Define the scopes needed for repository operations
  const scopes = [
    'repo',           // Full control of private repositories
    'public_repo',    // Access to public repositories
    'user:email',     // Access to user email addresses
  ].join(' ');

  // Build GitHub OAuth authorization URL
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.append('client_id', config.github.clientId);
  githubAuthUrl.searchParams.append('redirect_uri', config.github.redirectUri);
  githubAuthUrl.searchParams.append('scope', scopes);
  githubAuthUrl.searchParams.append('state', state);
  githubAuthUrl.searchParams.append('allow_signup', 'true');

  // Redirect user to GitHub OAuth authorization page
  res.redirect(githubAuthUrl.toString());
});

app.get('/auth/github/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors
  if (error) {
    console.error('GitHub OAuth error:', error, error_description);
    return res.redirect(`${config.server.frontendUrl}/auth/error?error=${encodeURIComponent(error as string)}&description=${encodeURIComponent(error_description as string || '')}`);
  }

  // Validate required parameters
  if (!code) {
    return res.redirect(`${config.server.frontendUrl}/auth/error?error=missing_code&description=Authorization code not provided`);
  }

  // Validate required environment variables
  if (!config.github.clientId || !config.github.clientSecret) {
    console.error('Missing GitHub OAuth configuration');
    return res.redirect(`${config.server.frontendUrl}/auth/error?error=server_config&description=Server configuration error`);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code: code as string,
      redirect_uri: config.github.redirectUri,
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const { access_token, token_type, scope } = tokenResponse.data;

    if (!access_token) {
      throw new Error('No access token received from GitHub');
    }

    // Get user information from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `${token_type} ${access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = userResponse.data;

    // For now, redirect to frontend with success
    // In the next task, we'll implement JWT token generation
    const successUrl = new URL(`${config.server.frontendUrl}/auth/success`);
    successUrl.searchParams.append('user', userData.login);
    successUrl.searchParams.append('id', userData.id.toString());
    
    res.redirect(successUrl.toString());

  } catch (error) {
    console.error('Error during GitHub OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.redirect(`${config.server.frontendUrl}/auth/error?error=oauth_exchange&description=${encodeURIComponent(errorMessage)}`);
  }
});

// Token validation endpoint (to be implemented in subsequent tasks)
app.get('/auth/validate', (req, res) => {
  res.status(501).json({
    error: 'Token validation not yet implemented',
    message: 'This endpoint will validate JWT tokens',
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.server.port, () => {
  console.log(`Auth server running on port ${config.server.port} in ${config.server.environment} mode`);
});



