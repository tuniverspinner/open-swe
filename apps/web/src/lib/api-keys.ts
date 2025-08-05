export function hasApiKeySet(config: Record<string, any>) {
  const modelNameKeys = Object.keys(config).filter((key) =>
    key.endsWith("ModelName"),
  );
  const enabledProviders = modelNameKeys
    .map((key) => config[key])
    .map((p) => p.split(":")[0]);

  const apiKeys = config.apiKeys || {};

  // No providers enabled means user is using default model: anthropic
  if (enabledProviders.length === 0 && !apiKeys.anthropic?.api_key) {
    return false;
  }

  if (
    (enabledProviders.includes("anthropic") && !apiKeys.anthropic?.api_key) ||
    (enabledProviders.includes("openai") && !apiKeys.openai?.api_key) ||
    (enabledProviders.includes("google-genai") &&
      !apiKeys["google-genai"]?.api_key)
  ) {
    return false;
  }

  return true;
}
