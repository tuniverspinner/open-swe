import { v4 as uuidv4 } from 'uuid';
import { UserSession, GitHubUser, GitHubOAuthToken } from '../types/index.js';

/**
 * In-memory session store for development
 * In production, this should be replaced with a persistent store like Redis
 */
export class SessionStore {
  private sessions: Map<string, UserSession> = new Map();

  /**
   * Create a new user session
   */
  createSession(
    user: GitHubUser,
    token: GitHubOAuthToken
  ): UserSession {
    const sessionId = uuidv4();
    const now = new Date();
    
    const session: UserSession = {
      id: sessionId,
      userId: user.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: token.expires_in 
        ? new Date(now.getTime() + token.expires_in * 1000)
        : undefined,
      refreshTokenExpiresAt: token.refresh_token_expires_in
        ? new Date(now.getTime() + token.refresh_token_expires_in * 1000)
        : undefined,
      scopes: token.scope.split(' ').filter(Boolean),
      user,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): UserSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Update session with new token information
   */
  updateSession(sessionId: string, token: GitHubOAuthToken): UserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const now = new Date();
    const updatedSession: UserSession = {
      ...session,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || session.refreshToken,
      tokenExpiresAt: token.expires_in 
        ? new Date(now.getTime() + token.expires_in * 1000)
        : session.tokenExpiresAt,
      refreshTokenExpiresAt: token.refresh_token_expires_in
        ? new Date(now.getTime() + token.refresh_token_expires_in * 1000)
        : session.refreshTokenExpiresAt,
      scopes: token.scope.split(' ').filter(Boolean),
      updatedAt: now,
    };

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(session: UserSession): boolean {
    if (!session.tokenExpiresAt) {
      return false; // No expiration set
    }
    return new Date() > session.tokenExpiresAt;
  }

  /**
   * Check if refresh token is expired
   */
  isRefreshTokenExpired(session: UserSession): boolean {
    if (!session.refreshTokenExpiresAt) {
      return false; // No expiration set
    }
    return new Date() > session.refreshTokenExpiresAt;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session) && this.isRefreshTokenExpired(session)) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get all active sessions (for debugging/admin purposes)
   */
  getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }
}

