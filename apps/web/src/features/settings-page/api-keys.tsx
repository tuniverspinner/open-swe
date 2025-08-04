import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Key, Trash2, Info, Server, CircleQuestionMark, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useConfigStore, DEFAULT_CONFIG_KEY } from "@/hooks/useConfigStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  value: string;
  allowed_in_dev: boolean;
  isVisible: boolean;
  lastUsed?: string;
}

interface ApiKeySection {
  title: string;
  keys: ApiKey[];
}

const API_KEY_SECTIONS: Record<string, Omit<ApiKeySection, "keys">> = {
  llms: {
    title: "LLMs",
  },
  // infrastructure: {
  //   title: "Infrastructure",
  // },
  custom: {
    title: "Add More Environment Variables",
  }
};

const PROVIDER_DEFINITIONS = {
  llms: [
    { id: "anthropic", name: "Anthropic", description: "" },
    { id: "openai", name: "OpenAI", description: "" },
    { id: "google-genai", name: "Google Gen AI", description: "" },
  ],
  // infrastructure: [
  //   {
  //     id: "daytona",
  //     name: "Daytona",
  //     description: "Users not required to set this if using the demo",
  //   },
  // ],
  custom: []
};

export function APIKeysTab() {
  const { getConfig, updateConfig } = useConfigStore();
  const config = getConfig(DEFAULT_CONFIG_KEY);

  const [visibilityState, setVisibilityState] = useState<Record<string, boolean>>({});

  const toggleKeyVisibility = (providerId: string) => {
    setVisibilityState((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const updateApiKey = (providerId: string, value: string) => {
    const currentApiKeys = config.apiKeys || {};
    const currentProvider = currentApiKeys[providerId] || {};
    
    updateConfig(DEFAULT_CONFIG_KEY, "apiKeys", {
      ...currentApiKeys,
      [providerId]: {
        ...currentProvider,
        api_key: value,
      },
    });
  };

  const updateDevServerSetting = (providerId: string, enabled: boolean) => {
    const currentApiKeys = config.apiKeys || {};
    const currentProvider = currentApiKeys[providerId] || {};
    
    updateConfig(DEFAULT_CONFIG_KEY, "apiKeys", {
      ...currentApiKeys,
      [providerId]: {
        ...currentProvider,
        allowed_in_dev: enabled,
      },
    });
  };

  const deleteApiKey = (providerId: string) => {
    const currentApiKeys = config.apiKeys || {};
    const updatedApiKeys = { ...currentApiKeys };
    delete updatedApiKeys[providerId];
    updateConfig(DEFAULT_CONFIG_KEY, "apiKeys", updatedApiKeys);
  };

  const addCustomEnvVar = () => {
    // Create a temporary entry with a unique key that user can edit
    const tempKey = `NEW_VAR_${Date.now()}`;
    updateApiKey(tempKey, "");
  };

  const updateCustomKeyName = (oldKey: string, newKey: string) => {
    if (!newKey.trim() || oldKey === newKey) return;
    
    const cleanNewKey = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const currentApiKeys = config.apiKeys || {};
    const keyData = currentApiKeys[oldKey];
    
    if (keyData) {
      // Create new entry with cleaned key name
      const updatedApiKeys = { ...currentApiKeys };
      updatedApiKeys[cleanNewKey] = keyData;
      delete updatedApiKeys[oldKey];
      
      updateConfig(DEFAULT_CONFIG_KEY, "apiKeys", updatedApiKeys);
    }
  };

  const getApiKeySections = (): Record<string, ApiKeySection> => {
    const sections: Record<string, ApiKeySection> = {};
    const currentApiKeys = config.apiKeys || {};

    const predefinedIds = [
      ...PROVIDER_DEFINITIONS.llms.map(p => p.id),
      // ...PROVIDER_DEFINITIONS.infrastructure.map(p => p.id),
    ];
    
    const customProviders = Object.keys(currentApiKeys)
      .filter(id => !predefinedIds.includes(id))
      .map(id => ({ 
        id, 
        name: id.startsWith('NEW_VAR_') ? '' : id,
        description: "" 
      }));


    const dynamicProviderDefinitions = {
      ...PROVIDER_DEFINITIONS,
      custom: customProviders,
    };

    Object.entries(API_KEY_SECTIONS).forEach(([sectionKey, sectionInfo]) => {
      sections[sectionKey] = {
        ...sectionInfo,
        keys: dynamicProviderDefinitions[sectionKey as keyof typeof dynamicProviderDefinitions].map((providerDef): ApiKey => {
          const providerData = currentApiKeys[providerDef.id] || {};
          return {
            id: providerDef.id,
            name: providerDef.name,
            description: providerDef.description,
            value: providerData.api_key || "",
            allowed_in_dev: providerData.allowed_in_dev || false,
            isVisible: visibilityState[providerDef.id] || false,
            lastUsed: providerData.lastUsed,
          };
        }),
      };
    });

    return sections;
  };

  const apiKeySections = getApiKeySections();

  return (
    <div className="space-y-8">
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-300">
          Open SWE uses Anthropic models by default. Configure your Anthropic
          API key below to get started.
        </AlertDescription>
      </Alert>

      {Object.entries(apiKeySections).map(([sectionKey, section]) => (
        <Card
          key={sectionKey}
          className="bg-card border-border shadow-sm"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Key className="h-5 w-5" />
              {section.title}
            </CardTitle>
            <CardDescription>
              {sectionKey === 'custom' 
                ? "Add custom environment variables for development server monitoring"
                : `Manage API keys for ${section.title.toLowerCase()} services`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.keys.map((apiKey: ApiKey) => (
              <div
                key={apiKey.id}
                className="border-border rounded-lg border p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {sectionKey === 'custom' ? (
                      <Input
                        value={apiKey.name}
                        onChange={(e) => updateCustomKeyName(apiKey.id, e.target.value)}
                        onBlur={(e) => {
                          // Clean up the display name to match the stored key
                          const cleanKey = e.target.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                          if (cleanKey !== apiKey.name) {
                            updateCustomKeyName(apiKey.id, cleanKey);
                          }
                        }}
                        placeholder="VARIABLE_NAME"
                        className="font-mono font-semibold text-foreground bg-transparent border-dashed min-w-0 w-auto px-2 py-1 h-auto text-base"
                      />
                    ) : (
                      <h3 className="text-foreground font-mono font-semibold">
                        {apiKey.name}
                      </h3>
                    )}
                    {apiKey.value && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          "border-green-200 bg-green-50 text-green-700",
                          "dark:border-green-800 dark:bg-green-900/20 dark:text-green-400",
                        )}
                      >
                        Configured
                      </Badge>
                    )}
                    {apiKey.lastUsed && (
                      <span className="text-muted-foreground text-xs">
                        Last used {apiKey.lastUsed}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* API Key Input Section */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label
                        htmlFor={`${apiKey.id}-key`}
                        className="text-sm font-medium"
                      >
                        {sectionKey === 'custom' ? 'Value' : 'API Key'}
                      </Label>
                      {apiKey.description && (
                        <p className="text-muted-foreground text-xs">
                          {apiKey.description}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <Input
                          id={`${apiKey.id}-key`}
                          type={apiKey.isVisible ? "text" : "password"}
                          value={apiKey.value}
                          onChange={(e) =>
                            updateApiKey(apiKey.id, e.target.value)
                          }
                          placeholder={sectionKey === 'custom' 
                            ? `Enter value for ${apiKey.name}`
                            : `Enter your ${apiKey.name} API key`
                          }
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                          className="px-2"
                        >
                          {apiKey.isVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {(apiKey.value || sectionKey === 'custom') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteApiKey(apiKey.id)}
                            className={cn(
                              "px-2",
                              "text-destructive hover:bg-destructive/10 hover:text-destructive",
                            )}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dev Server Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`${apiKey.id}-devserver`} className="text-sm font-medium">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        Include in Dev Server
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CircleQuestionMark className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Make this {sectionKey === 'custom' ? 'environment variable' : 'API key'} available when monitoring development servers</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id={`${apiKey.id}-devserver`}
                      checked={apiKey.allowed_in_dev}
                      onCheckedChange={(enabled) =>
                        updateDevServerSetting(apiKey.id, enabled)
                      }
                      disabled={!apiKey.value}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {/* Button for custom section */}
            {sectionKey === 'custom' && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={addCustomEnvVar}
                  className="min-w-[200px] h-10 gap-2 border-dashed border-2 hover:border-solid hover:bg-accent transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add Environment Variable
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
