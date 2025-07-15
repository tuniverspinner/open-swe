"use client";

import { DefaultView } from "@/components/v2/default-view";
import { useThreadsSWR } from "@/hooks/useThreadsSWR";
import { GitHubAppProvider } from "@/providers/GitHubApp";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { MANAGER_GRAPH_ID } from "@open-swe/shared/constants";

export default function ChatPage() {
  const {
    threads,
    threadsMetadata,
    isLoading: threadsLoading,
  } = useThreadsSWR({
    assistantId: MANAGER_GRAPH_ID,
  });
  if (!threads) {
    return <div>No threads</div>;
  }

  return (
    <div className="bg-background h-screen">
      <Suspense>
        <Toaster />
        <GitHubAppProvider>
          <DefaultView
            threads={threadsMetadata}
            threadsLoading={threadsLoading}
            originalThreads={threads}
          />
        </GitHubAppProvider>
      </Suspense>
    </div>
  );
}
