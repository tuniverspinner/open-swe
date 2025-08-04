import { GraphConfig, ProviderConfig } from "@open-swe/shared/open-swe/types";
import { decryptSecret } from "@open-swe/shared/crypto";


/**
 * Checks if a given object is a valid ProviderConfig.
 */
function isProviderConfig(obj: any): obj is ProviderConfig {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "api_key" in obj &&
    "allowed_in_dev" in obj
  );
}

/**
 * Extracts user environment variables from GraphConfig and returns them as a Record
 * Only includes keys that are marked as allowed_in_dev
 */
export function getUserEnvironmentVariables(config: GraphConfig): Record<string, string> {
  const userEnvs: Record<string, string> = {};
  
  const secretsEncryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
  if (!secretsEncryptionKey) {
    throw new Error("SECRETS_ENCRYPTION_KEY environment variable is required");
  }

  const apiKeys = config.configurable?.apiKeys;
  if (!apiKeys) {
    return userEnvs;
  }

  for (const [providerId, providerConfig] of Object.entries(apiKeys)) {
    if (isProviderConfig(providerConfig) && providerConfig.allowed_in_dev) {
      try {
        const decryptedKey = decryptSecret(providerConfig.api_key, secretsEncryptionKey);
        if (decryptedKey) {
          userEnvs[providerId] = decryptedKey; // Use provider ID directly
        }
      } catch (error) {
        console.warn(`Failed to decrypt key for provider ${providerId}:`, error);
      }
    }
  }

  return userEnvs;
}