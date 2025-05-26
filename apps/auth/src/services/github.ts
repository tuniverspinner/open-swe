import { OAuthApp } from '@octokit/oauth-app';
import { Octokit } from '@octokit/rest';
import { GitHubUser, GitHubOAuthToken, AuthConfig, GitHubRepository } from '../types/index.js';

export class GitHubOAuthService {
  private oauthApp: OAuthApp;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.oauthApp = new OAuthApp({
      clientType: 'oauth-app',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
  }

  /**
   * Generate the GitHub OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      ...(state && { state }),
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<GitHubOAuthToken> {
    try {
      const { authentication } = await this.oauthApp.createToken({
        code,
      });

      return {
        access_token: authentication.token,
        token_type: authentication.tokenType || 'bearer',
        scope: authentication.scopes?.join(' ') || '',
        refresh_token: authentication.refreshToken,
        expires_in: authentication.expiresIn,
        refresh_token_expires_in: authentication.refreshTokenExpiresIn,
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  /**
   * Get user information using access token
   */
  async getUserInfo(accessToken: string): Promise<GitHubUser> {
    try {
      const octokit = new Octokit({
        auth: accessToken,
      });

      const { data } = await octokit.rest.users.getAuthenticated();

      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
      };
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw new Error('Failed to fetch user information');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<GitHubOAuthToken> {
    try {
      const { authentication } = await this.oauthApp.refreshToken({
        refreshToken,
      });

      return {
        access_token: authentication.token,
        token_type: authentication.tokenType || 'bearer',
        scope: authentication.scopes?.join(' ') || '',
        refresh_token: authentication.refreshToken,
        expires_in: authentication.expiresIn,
        refresh_token_expires_in: authentication.refreshTokenExpiresIn,
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get user's repositories with required permissions
   */
  async getUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
    try {
      const octokit = new Octokit({
        auth: accessToken,
      });

      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        visibility: 'all',
        sort: 'updated',
        per_page: 100,
      });

      return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        permissions: {
          admin: repo.permissions?.admin || false,
          maintain: repo.permissions?.maintain || false,
          push: repo.permissions?.push || false,
          triage: repo.permissions?.triage || false,
          pull: repo.permissions?.pull || false,
        },
      }));
    } catch (error) {
      console.error('Error fetching user repositories:', error);
      throw new Error('Failed to fetch user repositories');
    }
  }

  /**
   * Validate access token by making a test API call
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken);
      return true;
    } catch {
      return false;
    }
  }
}

