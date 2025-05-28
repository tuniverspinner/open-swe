import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

// GitHub OAuth endpoints (to be implemented in subsequent tasks)
app.get('/auth/github', (req, res) => {
  res.status(501).json({
    error: 'GitHub OAuth flow not yet implemented',
    message: 'This endpoint will redirect to GitHub OAuth authorization',
  });
});

app.get('/auth/github/callback', (req, res) => {
  res.status(501).json({
    error: 'GitHub OAuth callback not yet implemented',
    message: 'This endpoint will handle GitHub OAuth callback',
  });
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

app.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
});

