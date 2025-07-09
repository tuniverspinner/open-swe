import useSWR from "swr";
import { THREAD_STATUS_SWR_CONFIG } from "@/lib/swr-config";
import {
  ThreadDisplayStatus,
  ThreadPollingResponseSchema,
} from "@/lib/schemas/thread-status";
import { fetchThreadStatus } from "@/services/thread-status.service";

interface UseThreadStatusOptions {
  enabled?: boolean;
  refreshInterval?: number;
}

interface ThreadStatusResult {
  status: ThreadDisplayStatus;
  isLoading: boolean;
  error: Error | null;
  taskPlan?: any;
  mutate: () => void;
}

/**
 * Thread status hook using SWR for real-time status updates
 * Uses SWR caching directly instead of manual Zustand cache
 */
export function useThreadStatus(
  threadId: string,
  options: UseThreadStatusOptions = {},
): ThreadStatusResult {
  const {
    enabled = true,
    refreshInterval = THREAD_STATUS_SWR_CONFIG.refreshInterval,
  } = options;

  const swrKey = enabled ? `thread-status-${threadId}` : null;

  const { data, error, isLoading, mutate } =
    useSWR<ThreadPollingResponseSchema>(
      swrKey,
      () => fetchThreadStatus(threadId),
      {
        ...THREAD_STATUS_SWR_CONFIG,
        refreshInterval,
      },
    );

  return {
    status: data?.status || "idle",
    isLoading,
    error,
    taskPlan: data?.taskPlan,
    mutate,
  };
}
