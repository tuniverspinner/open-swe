import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";
import {
  GITHUB_TOKEN_COOKIE,
  GITHUB_INSTALLATION_ID_COOKIE,
  GITHUB_INSTALLATION_TOKEN_COOKIE,
  GITHUB_INSTALLATION_NAME,
} from "@open-swe/shared/constants";
import {
  getGitHubInstallationTokenOrThrow,
  getGitHubInstallationToken,
  getInstallationNameFromReq,
  getGitHubAccessToken,
} from "./utils";
import { encryptSecret } from "@open-swe/shared/crypto";

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL ?? "http://localhost:2024",
    runtime: "edge", // default
    disableWarningLog: true,
    bodyParameters: (req, body) => {
      if (body.config?.configurable && "apiKeys" in body.config.configurable) {
        const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
        if (!encryptionKey) {
          throw new Error(
            "SECRETS_ENCRYPTION_KEY environment variable is required",
          );
        }

        const apiKeys = body.config.configurable.apiKeys;
        const encryptedApiKeys: Record<string, unknown> = {};

        // Encrypt each field in the apiKeys object
        for (const [key, value] of Object.entries(apiKeys)) {
          if (typeof value === "string" && value.trim() !== "") {
            encryptedApiKeys[key] = encryptSecret(value, encryptionKey);
          } else {
            encryptedApiKeys[key] = value;
          }
        }

        // Update the body with encrypted apiKeys
        body.config.configurable.apiKeys = encryptedApiKeys;
        return body;
      }
      return body;
    },
    headers: async (req) => {
      const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error(
          "SECRETS_ENCRYPTION_KEY environment variable is required",
        );
      }

      const installationIdCookie = req.cookies.get(
        GITHUB_INSTALLATION_ID_COOKIE,
      )?.value;

      // Try to get authentication tokens - don't throw if they're missing
      const accessToken = getGitHubAccessToken(req, encryptionKey);
      const installationToken = await getGitHubInstallationToken(
        installationIdCookie,
        encryptionKey,
      );

      // Only add authentication headers if we have valid tokens
      const headers: Record<string, string> = {};

      if (accessToken) {
        headers[GITHUB_TOKEN_COOKIE] = accessToken;
      }

      if (installationToken && installationIdCookie) {
        headers[GITHUB_INSTALLATION_TOKEN_COOKIE] = installationToken;

        // Only get installation name if we have installation token
        const installationName = await getInstallationNameFromReq(
          req.clone(),
          installationIdCookie,
        );
        headers[GITHUB_INSTALLATION_NAME] = installationName;
      }

      return headers;
    },
  });
