export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  company: string | null;
  location: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface AuthenticatedUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  accessToken: string;
  scopes: string[];
}

export interface UserSession {
  userId: number;
  login: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt?: Date;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface JWTPayload {
  userId: number;
  login: string;
  scopes: string[];
  iat: number;
  exp: number;
}

export interface AuthState {
  state: string;
  redirectUrl?: string;
  createdAt: Date;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
  };
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
  clone_url: string;
  ssh_url: string;
  default_branch: string;
}

