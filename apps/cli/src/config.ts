import fs from "fs";
import path from "path";
import os from "os";
import { Text } from "ink";
import React from "react";

interface ApiKeys {
  TAVILY_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  LANGSMITH_API_KEY?: string;
}

const CONFIG_FILE_NAME = ".open-swe-config.json";
const CONFIG_FILE_PATH = path.join(os.homedir(), CONFIG_FILE_NAME);

const REQUIRED_KEYS = [
  "TAVILY_API_KEY",
  "ANTHROPIC_API_KEY", 
  "LANGSMITH_API_KEY"
] as const;

export function getConfigFilePath(): string {
  return CONFIG_FILE_PATH;
}

export function loadConfig(): ApiKeys {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const configContent = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
      return JSON.parse(configContent);
    }
  } catch (error) {
    console.error("Error loading config:", error);
  }
  return {};
}

export function saveConfig(config: ApiKeys): void {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Error saving config:", error);
    throw error;
  }
}

export function getMissingKeys(config: ApiKeys): string[] {
  return REQUIRED_KEYS.filter(key => !config[key] || config[key]?.trim() === "");
}

export function setEnvironmentVariables(config: ApiKeys): void {
  for (const key of REQUIRED_KEYS) {
    if (config[key]) {
      process.env[key] = config[key];
    }
  }
}

export function validateConfigExists(): { isValid: boolean; missingKeys: string[] } {
  const config = loadConfig();
  const missingKeys = getMissingKeys(config);
  
  if (missingKeys.length === 0) {
    setEnvironmentVariables(config);
    return { isValid: true, missingKeys: [] };
  }
  
  return { isValid: false, missingKeys };
}