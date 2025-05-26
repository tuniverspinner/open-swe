import { AuthConfig } from '../types/index.js';

export const getAuthConfig = (): AuthConfig => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/auth/callback';

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set'
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: [
      'repo',           // Full control of private repositories
      'public_repo',    // Access to public repositories
      'user:email',     // Access to user email addresses
      'read:user',      // Read access to user profile data
    ],
  };
};

export const getServerConfig = () => {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  };
};

export const validateEnvironment = () => {
  const requiredVars = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return true;
};

