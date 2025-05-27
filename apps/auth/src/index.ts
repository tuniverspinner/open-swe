import dotenv from 'dotenv';
import path from 'path';
import { createServer } from './server';
import { logger } from './utils/logger';
import { validateEnvironment } from './config/environment';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function startServer() {
  try {
    // Validate environment variables
    const config = validateEnvironment();
    
    // Create Express server
    const app = createServer();
    
    // Start server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`🚀 Auth server running on ${config.host}:${config.port}`);
      logger.info(`📝 Environment: ${config.nodeEnv}`);
      logger.info(`🔗 GitHub OAuth callback: ${config.github.callbackUrl}`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`📡 Received ${signal}. Starting graceful shutdown...`);
      server.close(() => {
        logger.info('✅ Server closed successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

