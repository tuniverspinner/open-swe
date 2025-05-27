import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import { configurePassport } from './auth/passport.js';
import { authRoutes } from './routes/auth.js';
import { apiRoutes } from './routes/api.js';
import { validateEnvironment } from './config/environment.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('Server');

async function startServer() {
  try {
    // Validate environment variables
    const config = validateEnvironment();
    
    const app = express();
    
    // Initialize Redis client for session storage
    const redisClient = createClient({
      url: config.REDIS_URL
    });
    
    await redisClient.connect();
    logger.info('Connected to Redis');
    
    // Configure session middleware
    app.use(session({
      store: new RedisStore({ client: redisClient }),
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));
    
    // Initialize Passport
    configurePassport();
    app.use(passport.initialize());
    app.use(passport.session());

