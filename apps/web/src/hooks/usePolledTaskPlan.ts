import { useMemo } from "react";
import useSWR from "swr";
import { THREAD_STATUS_SWR_CONFIG } from "@/lib/swr-config";
import { ThreadStatusData } from "@/lib/schemas/thread-status";
import { fetchThreadStatus } from "@/services/thread-status.service";
import { TaskPlan } from "@open-swe/shared/open-swe/types";

interface UsePolledTaskPlanResult {
  taskPlan?: TaskPlan;
  isLoading: boolean;
  isProgrammerActive: boolean;
}

/**
 * Hook that extracts taskPlan from the existing thread status polling system.
 * Only returns taskPlan data when the programmer is active/running.
 */
export function usePolledTaskPlan(threadId: string): UsePolledTaskPlanResult {
  const swrKey = `thread-status-${threadId}`;

  const { data, isLoading } = useSWR<ThreadStatusData>(
    swrKey,
    () => fetchThreadStatus(threadId),
    THREAD_STATUS_SWR_CONFIG,
  );

  const { taskPlan, isProgrammerActive } = useMemo(() => {
    if (!data) {
      return {
        taskPlan: undefined,
        isProgrammerActive: false
      };
    }

    // Check if programmer is active and we have taskPlan data
    const isProgrammerActive = data.graph === "programmer" && 
                              (data.status === "running" || data.status === "paused");
    
    // Only return taskPlan when programmer is active
    const taskPlan = isProgrammerActive ? data.taskPlan : undefined;
    
    return {
      taskPlan,
      isProgrammerActive
    };
  }, [data]);

  return {
    taskPlan,
    isLoading,
    isProgrammerActive
  };
} 