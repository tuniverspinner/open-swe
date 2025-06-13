import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";
import { GITHUB_TOKEN_COOKIE } from "@open-swe/shared/constants";
import { encryptGitHubToken } from "@open-swe/shared/crypto";

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL ?? "http://localhost:2024",
    runtime: "edge", // default
    disableWarningLog: true,
    headers: (req) => {
      const rawToken = req.cookies.get(GITHUB_TOKEN_COOKIE)?.value ?? "";
      
      // If no token, return empty header
      if (!rawToken) {
        return { [GITHUB_TOKEN_COOKIE]: "" };
      }
      
      // Encrypt the token before forwarding to LangGraph server
      const encryptionKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY environment variable is required");
      }
      
      const encryptedToken = encryptGitHubToken(rawToken, encryptionKey);
      return {
        [GITHUB_TOKEN_COOKIE]: encryptedToken,
      };
    },
  });

