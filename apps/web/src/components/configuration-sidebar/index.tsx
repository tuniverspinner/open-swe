"use client";

import { forwardRef, ForwardedRef, useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigField } from "@/components/configuration-sidebar/config-field";
import { ConfigSection } from "@/components/configuration-sidebar/config-section";
import { useConfigStore, DEFAULT_CONFIG_KEY } from "@/hooks/useConfigStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConfigurableFieldUIMetadata } from "@open-swe/shared/configurable-metadata";
import { Button } from "@/components/ui/button";
import { PanelRightOpen } from "lucide-react";
import { GraphConfigurationMetadata } from "@open-swe/shared/open-swe/types";
import { useQueryState } from "nuqs";
import { useStreamContext } from "@/providers/Stream";
import { Input } from "@/components/ui/input";

/**
 * Extract configuration metadata from the GraphConfiguration Zod schema
 */
function extractConfigurationsFromSchema(
  configurable: Record<string, any>,
): ConfigurableFieldUIMetadata[] {
  const configurations: ConfigurableFieldUIMetadata[] = [];

  for (const [label, { x_open_swe_ui_config: metadata }] of Object.entries(
    GraphConfigurationMetadata,
  )) {
    if (metadata.type === "hidden") {
      continue;
    }
    configurations.push({
      label,
      type: metadata.type,
      default: configurable[label] || metadata.default,
      description: metadata.description,
      placeholder: metadata.placeholder,
      options: metadata.options,
      min: metadata.min,
      max: metadata.max,
      step: metadata.step,
    });
  }

  return configurations;
}

// Model providers that support API keys
const MODEL_PROVIDERS = [
  { key: "anthropic", label: "Anthropic" },
  { key: "openai", label: "OpenAI" },
  { key: "google-genai", label: "Google GenAI" },
] as const;

export interface AIConfigPanelProps {
  className?: string;
  open: boolean;
  onClose?: () => void;
}

export const ConfigurationSidebar = forwardRef<
  HTMLDivElement,
  AIConfigPanelProps
>(({ className, open, onClose }, ref: ForwardedRef<HTMLDivElement>) => {
  const { configs, updateConfig } = useConfigStore();
  const stream = useStreamContext();

  const [threadId] = useQueryState("threadId");

  const [configurations, setConfigurations] = useState<
    ConfigurableFieldUIMetadata[]
  >([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Load API keys from localStorage on mount
  useEffect(() => {
    const loadedApiKeys: Record<string, string> = {};
    MODEL_PROVIDERS.forEach(({ key }) => {
      const storedKey = localStorage.getItem(`open-swe-api-key-${key}`);
      if (storedKey) {
        loadedApiKeys[key] = storedKey;
      }
    });
    setApiKeys(loadedApiKeys);
  }, []);

  // Save API key to localStorage
  const saveApiKey = useCallback((provider: string, apiKey: string) => {
    if (apiKey.trim()) {
      localStorage.setItem(`open-swe-api-key-${provider}`, apiKey);
    } else {
      localStorage.removeItem(`open-swe-api-key-${provider}`);
    }
    setApiKeys(prev => ({
      ...prev,
      [provider]: apiKey,
    }));
  }, []);

  // Handle API key input change
  const handleApiKeyChange = useCallback((provider: string, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: value,
    }));
  }, []);

  // Handle API key input blur (save to localStorage)
  const handleApiKeyBlur = useCallback((provider: string) => {
    saveApiKey(provider, apiKeys[provider] || '');
  }, [apiKeys, saveApiKey]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const configKey = threadId || DEFAULT_CONFIG_KEY;

    if (threadId) {
      stream.client.threads.get(threadId).then((t) => {
        if (
          !("config" in t) ||
          !(t as any).config ||
          !(t as any).config.configurable
        ) {
          console.error("Thread does not have config key", t);
          return;
        }

        const actualConfigs = extractConfigurationsFromSchema(
          (t.config as any).configurable,
        );
        actualConfigs.forEach((c) => {
          // Always update the config store with either the default values, or the values from the thread.
          updateConfig(configKey, c.label, c.default);
        });

        setConfigurations(actualConfigs);
      });
    } else {
      const actualConfigs = extractConfigurationsFromSchema({});
      actualConfigs.forEach((c) => {
        updateConfig(configKey, c.label, c.default);
      });
      setConfigurations(actualConfigs);
    }
    setLoading(false);
  }, [threadId]);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed top-0 right-0 z-10 h-screen border-l border-gray-200 bg-white shadow-lg transition-all duration-300",
        open ? "w-80 md:w-xl" : "w-0 overflow-hidden border-l-0",
        className,
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-4">
            <h2 className="text-lg font-semibold">Agent Configuration</h2>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Tabs
            defaultValue="general"
            className="flex flex-1 flex-col overflow-y-auto"
          >
            <TabsList className="flex-shrink-0 justify-start bg-transparent px-4 pt-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 overflow-y-auto">
              <TabsContent
                value="general"
                className="m-0 p-4"
              >
                <ConfigSection title="Configuration">
                  {loading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : (
                    configurations.map(
                      (c: ConfigurableFieldUIMetadata, index: number) => (
                        <ConfigField
                          key={`${c.label}-${index}`}
                          id={c.label}
                          label={c.label}
                          type={
                            c.type === "boolean" ? "switch" : (c.type ?? "text")
                          }
                          description={c.description}
                          placeholder={c.placeholder}
                          options={c.options}
                          min={c.min}
                          max={c.max}
                          step={c.step}
                        />
                      ),
                    )
                  )}
                </ConfigSection>
              </TabsContent>

              <TabsContent
                value="api-keys"
                className="m-0 p-4"
              >
                <ConfigSection title="API Keys">
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500">
                      Provide custom API keys for model providers. These are stored locally in your browser and used when invoking the agent.
                    </p>
                    {MODEL_PROVIDERS.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <label
                          htmlFor={`api-key-${key}`}
                          className="text-sm font-medium"
                        >
                          {label} API Key
                        </label>
                        <Input
                          id={`api-key-${key}`}
                          type="password"
                          value={apiKeys[key] || ''}
                          onChange={(e) => handleApiKeyChange(key, e.target.value)}
                          onBlur={() => handleApiKeyBlur(key)}
                          placeholder={`Enter your ${label} API key`}
                        />
                      </div>
                    ))}
                  </div>
                </ConfigSection>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      )}
    </div>
  );
});

ConfigurationSidebar.displayName = "ConfigurationSidebar";

