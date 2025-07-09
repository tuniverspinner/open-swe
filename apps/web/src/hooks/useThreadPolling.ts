import { useEffect, useRef, useCallback } from "react";
import { useThreadStatus } from "@/hooks/useThreadStatus";
import { useThreadStore } from "@/stores/thread-store";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { Thread } from "@langchain/langgraph-sdk";
import { getThreadTasks, getThreadTitle } from "@/lib/thread";

interface UseThreadPollingProps {
  threads: Thread<GraphState>[];
  getThread: (threadId: string) => Promise<Thread<GraphState> | null>;
  onUpdate: (
    updatedThreads: Thread<GraphState>[],
    changedThreadIds: string[],
  ) => void;

  enabled?: boolean;
}

export function useThreadPolling({
  threads,
  getThread,
  onUpdate,
  enabled = true,
}: UseThreadPollingProps) {
  const { setGlobalPolling, isGlobalPollingEnabled } = useThreadStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);

  // Track previous thread states for change detection
  const previousThreadsRef = useRef<Map<string, Thread<GraphState>>>(new Map());

  const checkForChanges = useCallback(async () => {
    if (!enabled || !isGlobalPollingEnabled) return;

    try {
      // Limit to first 10 threads like the original ThreadPoller
      const threadsToCheck = threads.slice(0, 10);
      const updatedThreads: Thread<GraphState>[] = [];
      const changedThreadIds: string[] = [];

      // Fetch updated threads
      const updatePromises = threadsToCheck.map(async (currentThread) => {
        try {
          const updatedThread = await getThread(currentThread.thread_id);
          if (updatedThread) {
            updatedThreads.push(updatedThread);

            // Check if thread has changed
            const previousThread = previousThreadsRef.current.get(
              currentThread.thread_id,
            );
            if (
              !previousThread ||
              hasThreadChanged(previousThread, updatedThread)
            ) {
              changedThreadIds.push(updatedThread.thread_id);
              previousThreadsRef.current.set(
                currentThread.thread_id,
                updatedThread,
              );
            }
          }
        } catch (error) {
          // On error, keep the current thread
          updatedThreads.push(currentThread);
        }
      });

      await Promise.allSettled(updatePromises);

      // Call onUpdate if there are changes
      if (changedThreadIds.length > 0) {
        onUpdate(updatedThreads, changedThreadIds);
      }
    } catch (error) {
      console.error("Thread polling error:", error);
    }
  }, [threads, getThread, onUpdate, enabled, isGlobalPollingEnabled]);

  // Helper function to detect thread changes (similar to ThreadPoller)
  const hasThreadChanged = useCallback(
    (current: Thread<GraphState>, updated: Thread<GraphState>): boolean => {
      const currentTaskCounts = getThreadTasks(current);
      const updatedTaskCounts = getThreadTasks(updated);
      const currentTargetRepo = current.values?.targetRepository;
      const updatedTargetRepo = updated.values?.targetRepository;

      return (
        currentTaskCounts.completedTasks !== updatedTaskCounts.completedTasks ||
        currentTaskCounts.totalTasks !== updatedTaskCounts.totalTasks ||
        current.status !== updated.status ||
        getThreadTitle(current) !== getThreadTitle(updated) ||
        currentTargetRepo?.repo !== updatedTargetRepo?.repo ||
        currentTargetRepo?.branch !== updatedTargetRepo?.branch ||
        JSON.stringify(current.values?.taskPlan) !==
          JSON.stringify(updated.values?.taskPlan)
      );
    },
    [],
  );

  // Start polling function
  const start = useCallback(() => {
    if (isPollingRef.current || !enabled) return;

    isPollingRef.current = true;
    setGlobalPolling(true);

    // Set up interval for polling (15 seconds like original ThreadPoller)
    intervalRef.current = setInterval(checkForChanges, 15000);

    // Initial check
    checkForChanges();
  }, [enabled, setGlobalPolling, checkForChanges]);

  // Stop polling function
  const stop = useCallback(() => {
    if (!isPollingRef.current) return;

    isPollingRef.current = false;
    setGlobalPolling(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [setGlobalPolling]);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }

    return stop;
  }, [enabled, start, stop]);

  return { start, stop };
}
