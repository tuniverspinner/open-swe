import useSWR from "swr";
import { Thread } from "@langchain/langgraph-sdk";
import { createClient } from "@/providers/client";
import { THREAD_SWR_CONFIG } from "@/lib/swr-config";
import { ThreadMetadata } from "@/components/v2/types";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import { getThreadTitle } from "@/lib/thread";
import { calculateLastActivity } from "@/lib/thread-utils";
import { useMemo } from "react";

interface UseThreadsSWROptions {
  assistantId?: string;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
}

/**
 * Hook for fetching manager threads with computed metadata.
 * This hook is specifically designed for ManagerGraphState threads,
 * which are the top-level threads in the Open SWE system.
 */
export function useThreadsSWR(options: UseThreadsSWROptions = {}) {
  const {
    assistantId,
    refreshInterval = THREAD_SWR_CONFIG.refreshInterval,
    revalidateOnFocus = THREAD_SWR_CONFIG.revalidateOnFocus,
    revalidateOnReconnect = THREAD_SWR_CONFIG.revalidateOnReconnect,
  } = options;

  const apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL ?? "";

  // Create a unique key for SWR caching based on assistantId
  const swrKey = assistantId ? ["threads", assistantId] : ["threads", "all"];

  const fetcher = async (): Promise<Thread<ManagerGraphState>[]> => {
    if (!apiUrl) {
      throw new Error("API URL is not configured");
    }

    const client = createClient(apiUrl);
    const searchArgs = assistantId
      ? {
          metadata: {
            graph_id: assistantId,
          },
        }
      : undefined;

    return await client.threads.search<ManagerGraphState>(searchArgs);
  };

  const { data, error, isLoading, mutate, isValidating } = useSWR(
    swrKey,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus,
      revalidateOnReconnect,
      errorRetryCount: THREAD_SWR_CONFIG.errorRetryCount,
      errorRetryInterval: THREAD_SWR_CONFIG.errorRetryInterval,
      dedupingInterval: THREAD_SWR_CONFIG.dedupingInterval,
    },
  );

  // Compute ThreadMetadata once when threads data changes
  const threadsMetadata = useMemo((): ThreadMetadata[] => {
    if (!data) return [];

    return data.map((thread): ThreadMetadata => {
      const values = thread.values;

      return {
        id: thread.thread_id,
        title: getThreadTitle(thread),
        lastActivity: calculateLastActivity(thread.updated_at),
        taskCount: values?.taskPlan?.tasks.length ?? 0,
        repository: values?.targetRepository
          ? `${values.targetRepository.owner}/${values.targetRepository.repo}`
          : "",
        branch: values?.targetRepository?.branch || "main",
        taskPlan: values?.taskPlan,
        status: "idle" as const, // Default status - consumers can override with real status
        githubIssue: values?.githubIssueId
          ? {
              number: values?.githubIssueId,
              url: `https://github.com/${values?.targetRepository?.owner}/${values?.targetRepository?.repo}/issues/${values?.githubIssueId}`,
            }
          : undefined,
      };
    });
  }, [data]);

  return {
    threads: data ?? [],
    threadsMetadata, // Pre-computed metadata with lastActivity calculated once
    error,
    isLoading,
    isValidating,
    mutate, // For manual revalidation
  };
}
