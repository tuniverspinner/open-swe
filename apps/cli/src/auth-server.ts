import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import fetch from 'node-fetch';
import type { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || `http://localhost:3456/api/auth/github/callback`;
const PORT = 3456;

const TOKEN_PATH = path.join(os.homedir(), '.open-swe-cli', 'github_token.json');

let accessToken: string | null = null;

function saveToken(tokenData: any) {
  const dir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
}

function loadToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  }
  return null;
}

const app = express();

// 1. Start OAuth flow
app.get('/api/auth/github/login', (_req: Request, res: Response) => {
  const state = Math.random().toString(36).substring(2);
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(CALLBACK_URL)}&state=${state}`;
  res.redirect(githubAuthUrl);
});

// 2. Handle OAuth callback
app.get('/api/auth/github/callback', async (req: Request, res: Response) => {
  console.log('Received callback from GitHub:', req.url);
  const code = req.query.code as string;
  // Optionally validate state here
  if (!code) {
    return res.status(400).send('Missing code parameter');
  }
  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: CALLBACK_URL,
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    return res.status(400).send('Error exchanging code for token: ' + tokenData.error);
  }
  accessToken = tokenData.access_token;
  // Store the token in a config file
  try {
    saveToken(tokenData);
    console.log('GitHub access token stored in ~/.open-swe-cli/github_token.json');
  } catch (err) {
    console.error('Failed to store token in config file:', err);
  }
  res.send('Authentication successful! You can close this window.');
});

export function startAuthServer() {
  app.listen(PORT, () => {
    console.log(`Auth server running at http://localhost:${PORT}`);
    console.log(`Expected callback: ${CALLBACK_URL}`);
  });
}

export function getAccessToken() {
  // Try to get from memory first, then from config file
  if (accessToken) return accessToken;
  const tokenData = loadToken();
  return tokenData ? tokenData.access_token : null;
} 