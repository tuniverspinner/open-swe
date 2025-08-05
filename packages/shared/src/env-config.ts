import { EnvVarConfig } from "./open-swe/types.js";

/**
 * Type guard to check if an object is a valid EnvVarConfig
 */
export function isEnvVarConfig(obj: any): obj is EnvVarConfig {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "api_key" in obj &&
    "allowed_in_dev" in obj &&
    typeof obj.api_key === "string"
  );
}
