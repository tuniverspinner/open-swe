"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Loader2,
  GitBranch,
  GitPullRequest,
  Bug,
  FilePlus2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ThreadDisplayInfo } from "./types";
import { TerminalInput } from "./terminal-input";
import { useFileUpload } from "@/hooks/useFileUpload";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Label } from "../ui/label";
import { ContentBlocksPreview } from "../thread/ContentBlocksPreview";
import { TooltipIconButton } from "../ui/tooltip-icon-button";
import { ThemeToggle } from "../theme-toggle";
import { ThreadCard } from "./thread-card";

interface DefaultViewProps {
  threads: ThreadDisplayInfo[];
}

export function DefaultView({ threads }: DefaultViewProps) {
  const router = useRouter();
  const apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL ?? "";
  const assistantId: string | undefined =
    process.env.NEXT_PUBLIC_MANAGER_ASSISTANT_ID ?? "";
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    dragOver,
    handlePaste,
  } = useFileUpload();

  if (!apiUrl || !assistantId) {
    return <div>Missing API URL or Assistant ID</div>;
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-border bg-card border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-muted-foreground font-mono text-sm">
              Open SWE
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">ready</span>
              <div className="bg-muted h-1 w-1 rounded-full"></div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-4">
          {/* Terminal Chat Input */}
          <Card
            className={cn(
              "border-border bg-card py-0 dark:bg-gray-950",
              dragOver
                ? "border-primary border-2 border-dotted"
                : "border border-solid",
            )}
            ref={dropRef}
          >
            <CardContent className="p-4">
              <ContentBlocksPreview
                blocks={contentBlocks}
                onRemove={removeBlock}
              />
              <input
                id="file-input"
                type="file"
                onChange={handleFileUpload}
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
              />
              <div className="space-y-3">
                <TerminalInput
                  placeholder="Describe your coding task or ask a question..."
                  apiUrl={apiUrl}
                  assistantId={assistantId}
                  contentBlocks={contentBlocks}
                  setContentBlocks={setContentBlocks}
                  onPaste={handlePaste}
                />
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Label
                          htmlFor="file-input"
                          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center justify-center rounded-full bg-inherit"
                        >
                          <FilePlus2 className="size-4" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>Attach files</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent & Running Threads */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-foreground text-base font-semibold">
                Recent & Running Threads
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="border-border text-muted-foreground hover:text-foreground h-7 text-xs"
                onClick={() => router.push("/chat/threads")}
              >
                View All
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {threads.slice(0, 4).map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-foreground mb-3 text-base font-semibold">
              Quick Actions
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="border-border bg-card hover:bg-muted cursor-pointer py-3 transition-shadow hover:shadow-lg dark:bg-gray-950">
                <CardHeader className="px-3">
                  <CardTitle className="text-foreground text-sm">
                    Debug Code
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">
                    Find and fix issues in your codebase
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border bg-card hover:bg-muted cursor-pointer py-3 transition-shadow hover:shadow-lg dark:bg-gray-950">
                <CardHeader className="px-3">
                  <CardTitle className="text-foreground text-sm">
                    Add Feature
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">
                    Implement new functionality
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border bg-card hover:bg-muted cursor-pointer py-3 transition-shadow hover:shadow-lg dark:bg-gray-950">
                <CardHeader className="px-3">
                  <CardTitle className="text-foreground text-sm">
                    Refactor Code
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">
                    Improve code structure and performance
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
