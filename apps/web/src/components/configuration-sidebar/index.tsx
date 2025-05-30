"use client";
import { forwardRef, ForwardedRef, useState, useEffect } from "react";
import { Lightbulb, Save, Trash2, X } from "lucide-react";
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
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfigurableFieldUIMetadata } from "@/types/configurable";

function NameAndDescriptionAlertDialog({
  name,
  setName,
  description,
  setDescription,
  open,
  setOpen,
  handleSave,
}: {
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  handleSave: () => void;
}) {
  const handleSaveAgent = () => {
    setOpen(false);
    handleSave();
  };
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
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSaveAgent}>
            Submit
          </AlertDialogAction>
        </AlertDialogFooter>
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
  const {
    configsByAgentId,
    resetConfig,
    getAgentConfig,
    updateConfig,
    setDefaultConfig,
  } = useConfigStore();
  const [agentId] = useQueryState("agentId");
  const [deploymentId] = useQueryState("deploymentId");
  const [threadId] = useQueryState("threadId");

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

  // TODO: Add useEffect to load configurations based on your requirements
  useEffect(() => {
    setLoading(true);

    // Use the actual graph name from langgraph.json
    const graphId = agentId || "open-swe";

    // Example placeholder configurations for repo and LLM model
    const placeholderConfigs: ConfigurableFieldUIMetadata[] = [
      {
        label: "model",
        type: "select",
        description: "Select the LLM model to use",
        options: [
          { label: "GPT-4", value: "gpt-4" },
          { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
          { label: "Claude-3", value: "claude-3" },
        ],
        default: "gpt-4",
      },
      {
        label: "repository",
        type: "text",
        description: "Repository URL or path",
        placeholder: "Enter repository URL",
        default: "",
      },
      {
        label: "temperature",
        type: "number",
        description: "Model temperature (0.0 - 1.0)",
        min: 0,
        max: 1,
        step: 0.1,
        default: 0.7,
      },
    ];

    // Initialize the store manually if not exists to avoid type issues
    if (!configsByAgentId[graphId]) {
      // Use the existing setDefaultConfig method - this is the proper Zustand way
      setDefaultConfig(graphId, placeholderConfigs as any);
    }

    setConfigurations(placeholderConfigs);
    setLoading(false);
  }, [agentId, updateConfig, configsByAgentId, setDefaultConfig]);

  const handleSave = async () => {
    // Use the actual graph name from langgraph.json
    const defaultAgentId = agentId || "open-swe";

    if (!newName) {
      setOpenNameAndDescriptionAlertDialog(true);
      return;
    }

    // TODO: Implement save functionality based on your requirements
    // You can use getAgentConfig(defaultAgentId) to get current config values
    const currentConfig = getAgentConfig(defaultAgentId);
    console.log("Saving config:", currentConfig);

    toast.success("Agent configuration saved successfully");
  };

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
                        if (!agentId) return;
                        resetConfig(agentId);
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
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={handleSave}
                    >
                      <Save className="mr-1 h-4 w-4" />
                      Save
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save your changes to the agent</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          {
            <div className="p-4">
              <Alert variant="info">
                <Lightbulb className="size-4" />
                <AlertTitle>
                  Pro Tip
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-1 right-2 hover:bg-transparent"
                    onClick={() => {}}
                  >
                    <X className="size-4" />
                  </Button>
                </AlertTitle>
                <AlertDescription>
                  Changes made to the configuration will be saved automatically,
                  but will only persist across sessions if you click "Save".
                </AlertDescription>
              </Alert>
            </div>
          }
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
                          agentId={agentId || "open-swe"}
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
        handleSave={handleSave}
      />
    </div>
  );
});

ConfigurationSidebar.displayName = "ConfigurationSidebar";
