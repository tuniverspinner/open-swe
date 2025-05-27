import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration interface defining all environment variables
 */
export interface Config {
  // Server Configuration
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  
  // GitHub OAuth Configuration
  github: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  
  // Security Configuration
  sessionSecret: string;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
}

/**
 * Validates that a required environment variable is set
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set. Please check your .env file.`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Validates that a URL is properly formatted
 */
function validateUrl(url: string, name: string): string {
  try {
    new URL(url);
    return url;
  } catch {
    throw new Error(`Invalid URL format for ${name}: ${url}`);
  }
}

/**
 * Validates and creates the application configuration
 */
function createConfig(): Config {
  // Validate required GitHub OAuth credentials
  const githubClientId = requireEnv('GITHUB_CLIENT_ID');
  const githubClientSecret = requireEnv('GITHUB_CLIENT_SECRET');
  const githubCallbackUrl = validateUrl(
    getEnv('GITHUB_CALLBACK_URL', 'http://localhost:3001/auth/github/callback'),
    'GITHUB_CALLBACK_URL'
  );
  
  // Validate required security secrets
  const sessionSecret = requireEnv('SESSION_SECRET');
  const jwtSecret = requireEnv('JWT_SECRET');
  
  // Validate frontend URL if provided
  const frontendUrl = getEnv('FRONTEND_URL', 'http://localhost:3000');
  validateUrl(frontendUrl, 'FRONTEND_URL');
  
  // Parse and validate port
  const portStr = getEnv('PORT', '3001');
  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port number: ${portStr}. Port must be between 1 and 65535.`);
  }
  
  return {
    port,
    nodeEnv: getEnv('NODE_ENV', 'development'),
    frontendUrl,
    github: {
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      callbackUrl: githubCallbackUrl,
    },
    sessionSecret,
    jwt: {
      secret: jwtSecret,
      expiresIn: getEnv('JWT_EXPIRES_IN', '24h'),
      refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    },
  };
}

// Create and export the validated configuration
export const config = createConfig();

// Export individual configuration sections for convenience
export const { github, jwt } = config;

