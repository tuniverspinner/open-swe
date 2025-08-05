import { GraphConfig, EnvVarConfig } from "@open-swe/shared/open-swe/types";
import { decryptSecret } from "@open-swe/shared/crypto";

/**
 * Checks if a given object is a valid EnvVarConfig.
 */
function isEnvVarConfig(obj: any): obj is EnvVarConfig {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "api_key" in obj &&
    "allowed_in_dev" in obj
  );
}

/**
 * Extracts user environment variables from GraphConfig and returns them as a Record
 * Only includes keys that are marked as allowed_in_dev
 */
export function getUserEnvironmentVariables(
  config: GraphConfig,
): Record<string, string> {
  const userEnvs: Record<string, string> = {};

  const secretsEncryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
  if (!secretsEncryptionKey) {
    throw new Error("SECRETS_ENCRYPTION_KEY environment variable is required");
  }

  const apiKeys = config.configurable?.apiKeys;
  if (!apiKeys) {
    return userEnvs;
  }

  for (const envVarConfig of Object.values(apiKeys)) {
    if (isEnvVarConfig(envVarConfig) && envVarConfig.allowed_in_dev) {
      try {
        const decryptedKey = decryptSecret(
          envVarConfig.api_key,
          secretsEncryptionKey,
        );
        if (decryptedKey && envVarConfig.name) {
          userEnvs[envVarConfig.name] = decryptedKey; // Use the actual env var name
        }
      } catch (error) {
        console.warn(
          `Failed to decrypt key for env var ${envVarConfig.name}:`,
          error,
        );
      }
    }
  }

  return userEnvs;
}
