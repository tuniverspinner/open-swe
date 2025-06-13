import { GITHUB_TOKEN_COOKIE } from "@open-swe/shared/constants";
import { GraphConfig } from "@open-swe/shared/open-swe/types";
import { decryptGitHubToken, isTokenEncrypted } from "@open-swe/shared/crypto";

export function getGitHubTokensFromConfig(config: GraphConfig): {
  githubAccessToken: string;
} {
  if (!config.configurable) {
    throw new Error("No configurable object found in graph config.");
  }
  const rawToken = config.configurable[GITHUB_TOKEN_COOKIE];
  if (!rawToken) {
    throw new Error("Missing required x-github-access-token in configuration.");
  }

  let githubAccessToken = rawToken;

  // Check if the token is encrypted and decrypt it if necessary
  if (isTokenEncrypted(rawToken)) {
    const encryptionKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required to decrypt GitHub tokens.");
    }
    try {
      githubAccessToken = decryptGitHubToken(rawToken, encryptionKey);
    } catch (error) {
      throw new Error(`Failed to decrypt GitHub token: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return { githubAccessToken };
}

