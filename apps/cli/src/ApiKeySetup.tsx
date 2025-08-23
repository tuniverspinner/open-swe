import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadConfig, saveConfig, getMissingKeys, setEnvironmentVariables } from "./config.js";

interface ApiKeySetupProps {
  onComplete: () => void;
}

const API_KEY_DESCRIPTIONS = {
  TAVILY_API_KEY: "Tavily API key (for web search)",
  ANTHROPIC_API_KEY: "Anthropic API key (for Claude models)",
  LANGSMITH_API_KEY: "LangSmith API key (for tracing and monitoring)"
};

export const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onComplete }) => {
  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);
  const [input, setInput] = useState("");
  const [config, setConfig] = useState(loadConfig());
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  useEffect(() => {
    const missing = getMissingKeys(config);
    setMissingKeys(missing);
    
    if (missing.length === 0) {
      setEnvironmentVariables(config);
      onComplete();
    }
  }, [config, onComplete]);

  useInput((inputChar: string, key: { [key: string]: any }) => {
    if (missingKeys.length === 0) return;

    if (key.return) {
      const currentKey = missingKeys[currentKeyIndex];
      const trimmedInput = input.trim();
      
      if (trimmedInput) {
        const newConfig = { ...config, [currentKey]: trimmedInput };
        setConfig(newConfig);
        saveConfig(newConfig);
        
        if (currentKeyIndex < missingKeys.length - 1) {
          setCurrentKeyIndex(currentKeyIndex + 1);
          setInput("");
        } else {
          setEnvironmentVariables(newConfig);
          onComplete();
        }
      }
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (inputChar && !key.ctrl) {
      setInput((prev) => prev + inputChar);
    }
  });

  if (missingKeys.length === 0) {
    return null;
  }

  const currentKey = missingKeys[currentKeyIndex];
  const description = API_KEY_DESCRIPTIONS[currentKey as keyof typeof API_KEY_DESCRIPTIONS];

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="yellow">🔑 API Key Setup Required</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text>
          Please enter your {description}:
        </Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color="gray">
          ({currentKeyIndex + 1}/{missingKeys.length}) {currentKey}:
        </Text>
      </Box>
      
      <Box>
        <Text>&gt; {"*".repeat(input.length)}</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Keys will be stored in ~/.open-swe-config.json
        </Text>
      </Box>
    </Box>
  );
};