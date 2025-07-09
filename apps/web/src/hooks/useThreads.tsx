import { createClient } from "@/providers/client";
import { Thread } from "@langchain/langgraph-sdk";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useThreadStore } from "@/stores/thread-store";
import { useThreadPolling } from "@/hooks/useThreadPolling";
import { threadToDisplayInfo } from "@/components/v2/types";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";

export function useThreads(assistantId?: string) {
  const apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL ?? "";
  const [threads, setThreads] = useState<Thread<GraphState>[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const { updateThreadMetadata, getThreadMetadata } = useThreadStore();

  const getThread = useCallback(
    async (threadId: string): Promise<Thread<GraphState> | null> => {
      if (!apiUrl) return null;
      const client = createClient(apiUrl);

      try {
        const thread = await client.threads.get<GraphState>(threadId);

        // Update thread metadata in Zustand store for caching
        if (thread) {
          // Cast to ManagerGraphState for display info since threadToDisplayInfo expects it
          const displayInfo = threadToDisplayInfo(
            thread as Thread<ManagerGraphState>,
          );
          updateThreadMetadata(threadId, displayInfo);
        }
        return thread;
      } catch (error) {
        console.error("Failed to fetch thread:", threadId, error);
        return null;
      }
    },
    [apiUrl, updateThreadMetadata],
  );

  const getThreads = useCallback(async (): Promise<
    Thread<GraphState>[] | null
  > => {
    if (!apiUrl) return null;
    setThreadsLoading(true);
    const client = createClient(apiUrl);

    try {
      const searchArgs = assistantId
        ? {
            metadata: {
              graph_id: assistantId,
            },
          }
        : undefined;
      const threads = await client.threads.search<GraphState>(searchArgs);
      // Update thread metadata in Zustand store for all fetched threads
      if (threads) {
        threads.forEach((thread) => {
          // Cast to ManagerGraphState for display info since threadToDisplayInfo expects it
          const displayInfo = threadToDisplayInfo(
            thread as Thread<ManagerGraphState>,
          );
          updateThreadMetadata(thread.thread_id, displayInfo);
        });
      }
      return threads;
    } catch (error) {
      console.error("Failed to fetch threads:", error);
      return null;
    } finally {
      setThreadsLoading(false);
    }
  }, [apiUrl, assistantId, updateThreadMetadata]);

  // Handle thread updates from polling system
  const handleThreadUpdate = useCallback(
    (updatedThreads: Thread<GraphState>[], changedThreadIds: string[]) => {
      setThreads(updatedThreads);

      // Update metadata for changed threads in Zustand store
      changedThreadIds.forEach((threadId) => {
        const thread = updatedThreads.find((t) => t.thread_id === threadId);
        if (thread) {
          // Cast to ManagerGraphState for display info since threadToDisplayInfo expects it
          const displayInfo = threadToDisplayInfo(
            thread as Thread<ManagerGraphState>,
          );
          updateThreadMetadata(threadId, displayInfo);
        }
      });
    },
    [updateThreadMetadata],
  );

  // Initialize thread polling with the new SWR-based system
  useThreadPolling({
    threads,
    getThread,
    onUpdate: handleThreadUpdate,
    enabled: threads.length > 0,
  });

  useEffect(() => {
    getThreads().then((threads) => {
      setThreads(threads ?? []);
    });
  }, [getThreads]);

  return { threads, setThreads, getThread, getThreads, threadsLoading };
}
