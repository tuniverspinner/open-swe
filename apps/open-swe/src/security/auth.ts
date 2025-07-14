import { Auth, HTTPException } from "@langchain/langgraph-sdk/auth";
import {
  verifyGithubUser,
  GithubUser,
  verifyGithubUserId,
} from "@open-swe/shared/github/verify-user";
import {
  GITHUB_INSTALLATION_NAME,
  GITHUB_INSTALLATION_TOKEN_COOKIE,
  GITHUB_TOKEN_COOKIE,
  GITHUB_USER_ID_HEADER,
  GITHUB_USER_LOGIN_HEADER,
} from "@open-swe/shared/constants";
import { decryptSecret } from "@open-swe/shared/crypto";
import { verifyGitHubWebhookOrThrow } from "./github.js";
import { createWithOwnerMetadata, createOwnerFilter } from "./utils.js";
import { LANGGRAPH_USER_PERMISSIONS } from "../constants.js";
import { getGitHubPatFromRequest } from "../utils/github-pat.js";

// TODO: Export from LangGraph SDK
export interface BaseAuthReturn {
  is_authenticated?: boolean;
  display_name?: string;
  identity: string;
  permissions: string[];
}

interface AuthenticateReturn extends BaseAuthReturn {
  metadata: {
    installation_name: string;
  };
}

export const auth = new Auth()
  .authenticate<AuthenticateReturn>(async (request: Request) => {
    if (request.method === "OPTIONS") {
      return {
        identity: "anonymous",
        permissions: [],
        is_authenticated: false,
        display_name: "CORS Preflight",
        metadata: {
          installation_name: "n/a",
        },
      };
    }

    const isProd = process.env.NODE_ENV === "production";

    const ghSecretHashHeader = request.headers.get("X-Hub-Signature-256");
    if (ghSecretHashHeader) {
      // This will either return a valid user, or throw an error
      return await verifyGitHubWebhookOrThrow(request);
    }

    const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("Missing SECRETS_ENCRYPTION_KEY environment variable.");
    }

    // Check for GitHub PAT authentication (simpler mode for evals, etc.)
    const githubPat = getGitHubPatFromRequest(request, encryptionKey);
    if (githubPat && !isProd) {
      const user = await verifyGithubUser(githubPat);
      if (!user) {
        throw new HTTPException(401, {
          message: "Invalid GitHub PAT",
        });
      }

      return {
        identity: user.id.toString(),
        is_authenticated: true,
        display_name: user.login,
        metadata: {
          installation_name: "pat-auth",
        },
        permissions: LANGGRAPH_USER_PERMISSIONS,
      };
    }

    // GitHub App authentication mode (existing logic)
    const installationNameHeader = request.headers.get(
      GITHUB_INSTALLATION_NAME,
    );
    if (!installationNameHeader) {
      throw new HTTPException(401, {
        message: "GitHub installation name header missing",
      });
    }

    // We don't do anything with this token right now, but still confirm it
    // exists as it will cause issues later on if it's not present.
    const encryptedInstallationToken = request.headers.get(
      GITHUB_INSTALLATION_TOKEN_COOKIE,
    );
    if (!encryptedInstallationToken) {
      throw new HTTPException(401, {
        message: "GitHub installation token header missing",
      });
    }

    let user: GithubUser | undefined;

    const encryptedAccessToken = request.headers.get(GITHUB_TOKEN_COOKIE);
    if (!encryptedAccessToken) {
      // If there isn't a user access token, check to see if the user info is in headers.
      // This would indicate a bot created the request.
      const userIdHeader = request.headers.get(GITHUB_USER_ID_HEADER);
      const userLoginHeader = request.headers.get(GITHUB_USER_LOGIN_HEADER);
      if (!userIdHeader || !userLoginHeader) {
        throw new HTTPException(401, {
          message: "Github-User-Id or Github-User-Login header missing",
        });
      }
      user = await verifyGithubUserId(
        decryptSecret(encryptedInstallationToken, encryptionKey),
        Number(userIdHeader),
        userLoginHeader,
      );
    } else {
      // Ensure we decrypt the token before passing to the verification function.
      user = await verifyGithubUser(
        decryptSecret(encryptedAccessToken, encryptionKey),
      );
    }

    if (!user) {
      throw new HTTPException(401, {
        message: "User not found",
      });
    }

    return {
      identity: user.id.toString(),
      is_authenticated: true,
      display_name: user.login,
      metadata: {
        installation_name: installationNameHeader,
      },
      permissions: LANGGRAPH_USER_PERMISSIONS,
    };
  })

  // THREADS: create operations with metadata
  .on("threads:create", ({ value, user }) =>
    createWithOwnerMetadata(value, user),
  )
  .on("threads:create_run", ({ value, user }) =>
    createWithOwnerMetadata(value, user),
  )

  // THREADS: read, update, delete, search operations
  .on("threads:read", ({ user }) => createOwnerFilter(user))
  .on("threads:update", ({ user }) => createOwnerFilter(user))
  .on("threads:delete", ({ user }) => createOwnerFilter(user))
  .on("threads:search", ({ user }) => createOwnerFilter(user))

  // ASSISTANTS: create operation with metadata
  .on("assistants:create", ({ value, user }) =>
    createWithOwnerMetadata(value, user),
  )

  // ASSISTANTS: read, update, delete, search operations
  .on("assistants:read", ({ user }) => createOwnerFilter(user))
  .on("assistants:update", ({ user }) => createOwnerFilter(user))
  .on("assistants:delete", ({ user }) => createOwnerFilter(user))
  .on("assistants:search", ({ user }) => createOwnerFilter(user))

  // STORE: permission-based access
  .on("store", ({ user }) => {
    return { owner: user.identity };
  });
