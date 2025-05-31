"use client";
import { forwardRef, ForwardedRef, useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigField } from "@/components/configuration-sidebar/config-field";
import { ConfigSection } from "@/components/configuration-sidebar/config-section";
import { useConfigStore } from "@/hooks/use-config-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useQueryState } from "nuqs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfigurableFieldUIMetadata } from "@/types/configurable";

// Import the actual model options from the open-swe types
const MODEL_OPTIONS = [
  {
    label: "Claude Sonnet 4 (Extended Thinking)",
    value: "anthropic:extended-thinking:claude-sonnet-4-0",
  },
  {
    label: "Claude Opus 4 (Extended Thinking)",
    value: "anthropic:extended-thinking:claude-opus-4-0",
  },
  {
    label: "Claude Sonnet 4",
    value: "anthropic:claude-sonnet-4-0",
  },
  {
    label: "Claude Opus 4",
    value: "anthropic:claude-opus-4-0",
  },
  {
    label: "Claude 3.7 Sonnet",
    value: "anthropic:claude-3-7-sonnet-latest",
  },
  {
    label: "Claude 3.5 Sonnet",
    value: "anthropic:claude-3-5-sonnet-latest",
  },
  {
    label: "o4",
    value: "openai:o4",
  },
  {
    label: "o4 mini",
    value: "openai:o4-mini",
  },
  {
    label: "o3",
    value: "openai:o3",
  },
  {
    label: "o3 mini",
    value: "openai:o3-mini",
  },
  {
    label: "GPT 4o",
    value: "openai:gpt-4o",
  },
  {
    label: "GPT 4.1",
    value: "openai:gpt-4.1",
  },
  {
    label: "Gemini 2.5 Pro Preview",
    value: "google-genai:gemini-2.5-pro-preview-05-06",
  },
  {
    label: "Gemini 2.5 Flash Preview",
    value: "google-genai:gemini-2.5-flash-preview-05-20",
  },
];

const MODEL_OPTIONS_NO_THINKING = MODEL_OPTIONS.filter(
  ({ value }) =>
    !value.includes("extended-thinking") && !value.startsWith("openai:o"),
);

function NameAndDescriptionAlertDialog({
  name,
  setName,
  description,
  setDescription,
  open,
  setOpen,
}: {
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={setOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Agent Name and Description</AlertDialogTitle>
          <AlertDialogDescription>
            Please give your new agent a name and optional description.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              placeholder="Agent Name"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Input
              placeholder="Agent Description"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface AIConfigPanelProps {
  className?: string;
  open: boolean;
}

export const ConfigurationSidebar = forwardRef<
  HTMLDivElement,
  AIConfigPanelProps
>(({ className, open }, ref: ForwardedRef<HTMLDivElement>) => {
  const { configs, resetConfig, updateConfig } = useConfigStore();
  const [graphId] = useQueryState("graphId");

  // Local state for configurations and loading
  const [configurations, setConfigurations] = useState<
    ConfigurableFieldUIMetadata[]
  >([]);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [
    openNameAndDescriptionAlertDialog,
    setOpenNameAndDescriptionAlertDialog,
  ] = useState(false);

  /* TODO: Update Configuration to:
  // Replace these types with shared types from open-swe
  // Use shared config store from open-swe

  */
  useEffect(() => {
    setLoading(true);

    // Use actual GraphConfiguration from open-swe types
    const placeholderConfigs: ConfigurableFieldUIMetadata[] = [
      {
        label: "plannerModelName",
        type: "select",
        description: "The model to use for planning",
        options: MODEL_OPTIONS_NO_THINKING,
        default: "anthropic:claude-sonnet-4-0",
      },
      {
        label: "plannerTemperature",
        type: "slider",
        description: "Controls randomness (0 = deterministic, 2 = creative)",
        min: 0,
        max: 2,
        step: 0.1,
        default: 0,
      },
      {
        label: "plannerContextModelName",
        type: "select",
        description: "The model to use for planning context gathering",
        options: MODEL_OPTIONS,
        default: "anthropic:claude-sonnet-4-0",
      },
      {
        label: "plannerContextTemperature",
        type: "slider",
        description:
          "Controls randomness for context gathering (0 = deterministic, 2 = creative)",
        min: 0,
        max: 2,
        step: 0.1,
        default: 0,
      },
      {
        label: "actionGeneratorModelName",
        type: "select",
        description: "The model to use for action generation",
        options: MODEL_OPTIONS,
        default: "anthropic:claude-sonnet-4-0",
      },
      {
        label: "actionGeneratorTemperature",
        type: "slider",
        description:
          "Controls randomness for action generation (0 = deterministic, 2 = creative)",
        min: 0,
        max: 2,
        step: 0.1,
        default: 0,
      },
      {
        label: "progressPlanCheckerModelName",
        type: "select",
        description: "The model to use for progress plan checking",
        options: MODEL_OPTIONS_NO_THINKING,
        default: "anthropic:claude-sonnet-4-0",
      },
      {
        label: "progressPlanCheckerTemperature",
        type: "slider",
        description:
          "Controls randomness for progress checking (0 = deterministic, 2 = creative)",
        min: 0,
        max: 2,
        step: 0.1,
        default: 0,
      },
      {
        label: "summarizerModelName",
        type: "select",
        description: "The model to use for summarizing conversation history",
        options: MODEL_OPTIONS_NO_THINKING,
        default: "anthropic:claude-sonnet-4-0",
      },
      {
        label: "summarizerTemperature",
        type: "slider",
        description:
          "Controls randomness for summarization (0 = deterministic, 2 = creative)",
        min: 0,
        max: 2,
        step: 0.1,
        default: 0,
      },
      {
        label: "maxContextActions",
        type: "number",
        description:
          "Maximum number of context gathering actions during planning",
        min: 1,
        max: 20,
        default: 6,
      },
    ];

    // Initialize configs with defaults if they don't exist
    placeholderConfigs.forEach((config) => {
      if (configs[config.label] === undefined && config.default !== undefined) {
        updateConfig(config.label, config.default);
      }
    });

    setConfigurations(placeholderConfigs);
    setLoading(false);
  }, [configs, updateConfig]);

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
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!graphId) return;
                        resetConfig(graphId);
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Reset
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset the configuration to the last saved state</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild></TooltipTrigger>
                  <TooltipContent>
                    <p>Save your changes to the agent</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <Tabs
            defaultValue="general"
            className="flex flex-1 flex-col overflow-y-auto"
          >
            <TabsList className="flex-shrink-0 justify-start bg-transparent px-4 pt-2">
              <TabsTrigger value="general">General</TabsTrigger>
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
            </ScrollArea>
          </Tabs>
        </div>
      )}
      <NameAndDescriptionAlertDialog
        name={newName}
        setName={setNewName}
        description={newDescription}
        setDescription={setNewDescription}
        open={openNameAndDescriptionAlertDialog}
        setOpen={setOpenNameAndDescriptionAlertDialog}
      />
    </div>
  );
});

ConfigurationSidebar.displayName = "ConfigurationSidebar";
