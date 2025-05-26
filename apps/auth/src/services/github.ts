import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { 
  GitHubUser, 
  GitHubEmail, 
  GitHubTokenResponse, 
  AuthenticatedUser,
  GitHubRepository 
} from '../types/auth.js';
import { createError } from '../middleware/errorHandler.js';

export class GitHubService {
  private static readonly GITHUB_API_BASE = 'https://api.github.com';
  private static readonly GITHUB_OAUTH_BASE = 'https://github.com/login/oauth';

  /**
   * Generate GitHub OAuth authorization URL
   */
  static generateAuthUrl(state: string, scopes?: string[]): string {
    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: config.github.callbackUrl,
      scope: (scopes || config.github.scopes).join(' '),
      state,
      allow_signup: 'true',
    });

    return `${this.GITHUB_OAUTH_BASE}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
    try {
      const response = await axios.post(
        `${this.GITHUB_OAUTH_BASE}/access_token`,
        {
          client_id: config.github.clientId,
          client_secret: config.github.clientSecret,
          code,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.error) {
        throw createError(`GitHub OAuth error: ${response.data.error_description}`, 400);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to exchange code for token', { error });
      if (axios.isAxiosError(error)) {
        throw createError(`GitHub API error: ${error.message}`, 500);
      }
      throw error;
    }
  }

  /**
   * Get user information from GitHub API
   */
  static async getUser(accessToken: string): Promise<GitHubUser> {
    try {
      const response = await axios.get(`${this.GITHUB_API_BASE}/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get user from GitHub', { error });
      if (axios.isAxiosError(error)) {
        throw createError(`GitHub API error: ${error.message}`, 500);
      }
      throw error;
    }
  }

  /**
   * Get user email addresses from GitHub API
   */
  static async getUserEmails(accessToken: string): Promise<GitHubEmail[]> {
    try {
      const response = await axios.get(`${this.GITHUB_API_BASE}/user/emails`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get user emails from GitHub', { error });
      if (axios.isAxiosError(error)) {
        throw createError(`GitHub API error: ${error.message}`, 500);
      }
      throw error;
    }
  }

  /**
   * Get user repositories from GitHub API
   */
  static async getUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
    try {
      const response = await axios.get(`${this.GITHUB_API_BASE}/user/repos`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          sort: 'updated',
          per_page: 100,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get user repositories from GitHub', { error });
      if (axios.isAxiosError(error)) {
        throw createError(`GitHub API error: ${error.message}`, 500);
      }
      throw error;
    }
  }

  /**
   * Create authenticated user object
   */
  static async createAuthenticatedUser(accessToken: string): Promise<AuthenticatedUser> {
    const [user, emails] = await Promise.all([
      this.getUser(accessToken),
      this.getUserEmails(accessToken),
    ]);

    const primaryEmail = emails.find(email => email.primary && email.verified);

    return {
      id: user.id,
      login: user.login,
      name: user.name,
      email: primaryEmail?.email || user.email,
      avatar_url: user.avatar_url,
      accessToken,
      scopes: config.github.scopes,
    };
  }
}

