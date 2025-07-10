"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Suspense } from "react";
import { ThreadMetadata, threadToMetadata } from "@/components/v2/types";
import { useThreadsSWR } from "@/hooks/useThreadsSWR";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { Toaster } from "@/components/ui/sonner";
import { MANAGER_GRAPH_ID } from "@open-swe/shared/constants";
import { ThreadCard, ThreadCardLoading } from "@/components/v2/thread-card";

export default function ThreadsPage() {
  const router = useRouter();
  const { threads, isLoading: threadsLoading } = useThreadsSWR<GraphState>({
    assistantId: MANAGER_GRAPH_ID,
  });

  const handleBackToHome = () => {
    router.push("/chat");
  };

  if (!threads) {
    return <div>No threads</div>;
  }

  // Convert Thread objects to ThreadMetadata for UI
  // Real-time status will be handled by individual ThreadCard components
  const threadMetadata: ThreadMetadata[] = threads.map(threadToMetadata);

  return (
    <div className="bg-background h-screen">
      <Suspense>
        <Toaster />
        {/* Header */}
        <div className="border-border bg-card border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-muted hover:text-foreground h-6 w-6 p-0"
              onClick={handleBackToHome}
            >
              <ArrowLeft className="h-3 w-3" />
            </Button>
            <span className="text-foreground text-sm font-medium">
              All Threads
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pt-2">
          <div className="mx-auto max-w-4xl space-y-3 p-4">
            {threadsLoading || threadMetadata.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {threadsLoading && threadMetadata.length === 0 && (
                  <>
                    <ThreadCardLoading />
                    <ThreadCardLoading />
                    <ThreadCardLoading />
                    <ThreadCardLoading />
                    <ThreadCardLoading />
                    <ThreadCardLoading />
                  </>
                )}
                {threadMetadata.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-border bg-card dark:bg-gray-950">
                <CardHeader>
                  <CardContent className="flex items-center justify-center py-8">
                    <span className="text-muted-foreground text-sm">
                      No threads found
                    </span>
                  </CardContent>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </Suspense>
    </div>
  );
}
