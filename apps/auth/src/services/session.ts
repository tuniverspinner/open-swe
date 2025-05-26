import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { UserSession, AuthState, AuthenticatedUser } from '../types/auth.js';

/**
 * In-memory session storage for development
 * In production, this should be replaced with Redis or database storage
 */
class InMemorySessionStore {
  private sessions = new Map<string, UserSession>();
  private authStates = new Map<string, AuthState>();

  // Session management
  async createSession(user: AuthenticatedUser): Promise<string> {
    const sessionId = uuidv4();
    const session: UserSession = {
      userId: user.id,
      login: user.login,
      accessToken: user.accessToken,
      scopes: user.scopes,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    logger.debug('Session created', { sessionId, userId: user.id });
    return sessionId;
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastAccessedAt = new Date();
      this.sessions.set(sessionId, session);
    }
    return session || null;
  }

  async updateSession(sessionId: string, updates: Partial<UserSession>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates, { lastAccessedAt: new Date() });
      this.sessions.set(sessionId, session);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    logger.debug('Session deleted', { sessionId });
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const maxAge = config.session.maxAge;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.lastAccessedAt.getTime();
      if (age > maxAge) {
        this.sessions.delete(sessionId);
        logger.debug('Expired session cleaned up', { sessionId });
      }
    }
  }

  // Auth state management (for OAuth flow)
  async createAuthState(redirectUrl?: string): Promise<string> {
    const state = uuidv4();
    const authState: AuthState = {
      state,
      redirectUrl,
      createdAt: new Date(),
    };

    this.authStates.set(state, authState);
    logger.debug('Auth state created', { state });
    return state;
  }

  async getAuthState(state: string): Promise<AuthState | null> {
    return this.authStates.get(state) || null;
  }

  async deleteAuthState(state: string): Promise<void> {
    this.authStates.delete(state);
    logger.debug('Auth state deleted', { state });
  }

  async cleanupExpiredAuthStates(): Promise<void> {
    const now = new Date();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [state, authState] of this.authStates.entries()) {
      const age = now.getTime() - authState.createdAt.getTime();
      if (age > maxAge) {
        this.authStates.delete(state);
        logger.debug('Expired auth state cleaned up', { state });
      }
    }
  }
}

// Export singleton instance
export const sessionStore = new InMemorySessionStore();

// Start cleanup interval
setInterval(() => {
  sessionStore.cleanupExpiredSessions();
  sessionStore.cleanupExpiredAuthStates();
}, 5 * 60 * 1000); // Run every 5 minutes

