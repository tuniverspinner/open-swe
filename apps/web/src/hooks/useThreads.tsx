import { createClient } from "@/providers/client";
import { Thread } from "@langchain/langgraph-sdk";
import { useCallback, useEffect, useState } from "react";
import { useThreadPolling } from "./useThreadPolling";

export function useThreads<State extends Record<string, any>>(
  assistantId?: string,
) {
  const apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL ?? "";
  const [threads, setThreads] = useState<Thread<State>[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const getThread = useCallback(
    async (threadId: string): Promise<Thread<State> | null> => {
      if (!apiUrl) return null;
      const client = createClient(apiUrl);

      try {
        const thread = await client.threads.get<State>(threadId);
        return thread;
      } catch (error) {
        console.error("Failed to fetch thread:", threadId, error);
        return null;
      }
    },
    [apiUrl],
  );

  const getThreads = useCallback(async (): Promise<Thread<State>[] | null> => {
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
      const threads = await client.threads.search<State>(searchArgs);
      return threads;
    } catch (error) {
      console.error("Failed to fetch threads:", error);
      return null;
    } finally {
      setThreadsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    getThreads().then((threads) => {
      setThreads(threads ?? []);
    });
  }, [getThreads]);

  // Add polling to automatically update thread titles when TaskPlans are created
  const handlePollingUpdate = useCallback(
    (updatedThreads: Thread<any>[], changedThreadIds: string[]) => {
      setThreads((currentThreads) => {
        const updatedMap = new Map(updatedThreads.map((t) => [t.thread_id, t]));
        return currentThreads.map(
          (thread) => updatedMap.get(thread.thread_id) || thread,
        );
      });
    },
    [],
  );

  // Enable polling for automatic updates (cast types for compatibility)
  useThreadPolling({
    threads: threads as Thread<any>[],
    getThread: getThread as (threadId: string) => Promise<Thread<any> | null>,
    onUpdate: handlePollingUpdate,
    enabled: true,
  });

  return { threads, setThreads, getThread, getThreads, threadsLoading };
}
