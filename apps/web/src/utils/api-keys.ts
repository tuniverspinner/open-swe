/**
 * Utility functions for handling API keys stored in localStorage
 */

export interface ApiKeyMap {
  [provider: string]: string;
}

/**
 * Extract API keys from localStorage for all supported model providers
 * @returns Object mapping provider names to API keys
 */
export function getApiKeysFromLocalStorage(): ApiKeyMap {
  const apiKeys: ApiKeyMap = {};
  
  // List of supported model providers (matching the ones in the config sidebar)
  const providers = ['anthropic', 'openai', 'google-genai'];
  
  providers.forEach(provider => {
    const key = localStorage.getItem(`open-swe-api-key-${provider}`);
    if (key && key.trim()) {
      apiKeys[provider] = key.trim();
    }
  });
  
  return apiKeys;
}

