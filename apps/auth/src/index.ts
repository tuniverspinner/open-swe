import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { getAuthConfig, getServerConfig, validateEnvironment } from './config/index.js';
import { GitHubOAuthService } from './services/github.js';
import { SessionStore } from './services/session.js';
import { AuthMiddleware } from './middleware/auth.js';
import { createAuthRoutes } from './routes/auth.js';

async function createApp() {
  // Validate environment variables
  try {
    validateEnvironment();
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }

  const app = express();
  const authConfig = getAuthConfig();
  const serverConfig = getServerConfig();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API server
  }));

  // CORS configuration
  app.use(cors({
    origin: serverConfig.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Session middleware
  app.use(session({
    secret: serverConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: serverConfig.nodeEnv === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Initialize services
  const githubService = new GitHubOAuthService(authConfig);
  const sessionStore = new SessionStore();
  const authMiddleware = new AuthMiddleware(sessionStore, githubService);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.0',
    });
  });

  // Auth routes
  app.use('/auth', createAuthRoutes(githubService, sessionStore, authMiddleware));

  // Error handling middleware
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: serverConfig.nodeEnv === 'development' ? error.message : 'Something went wrong',
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ 
      error: 'Not found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Cleanup expired sessions every hour
  setInterval(() => {
    sessionStore.cleanupExpiredSessions();
  }, 60 * 60 * 1000);

  return { app, serverConfig };
}

async function startServer() {
  try {
    const { app, serverConfig } = await createApp();
    
    app.listen(serverConfig.port, () => {
      console.log(`🚀 Auth server running on port ${serverConfig.port}`);
      console.log(`📝 Environment: ${serverConfig.nodeEnv}`);
      console.log(`🔗 Health check: http://localhost:${serverConfig.port}/health`);
      console.log(`🔐 Auth endpoints:`);
      console.log(`   - GET  /auth/github - Start OAuth flow`);
      console.log(`   - GET  /auth/callback - OAuth callback`);
      console.log(`   - GET  /auth/status - Check auth status`);
      console.log(`   - POST /auth/logout - Logout`);
      console.log(`   - GET  /auth/repositories - Get user repositories`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { createApp, startServer };

