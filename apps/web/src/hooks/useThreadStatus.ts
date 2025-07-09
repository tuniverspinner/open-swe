import useSWR from "swr";
import { useCallback, useMemo } from "react";
import { Thread, Run } from "@langchain/langgraph-sdk";
import { createClient } from "@/providers/client";
import { useThreadStore } from "@/stores/thread-store";
import {
  ThreadDisplayStatus,
  ThreadPollingResponseSchema,
  ManagerThreadStateSchema,
  PlannerThreadStateSchema,
  ProgrammerThreadStateSchema,
} from "@/lib/schemas/thread-status";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import { PlannerGraphState } from "@open-swe/shared/open-swe/planner/types";

interface UseThreadStatusOptions {
  enabled?: boolean;
  refreshInterval?: number;
}

interface ThreadStatusResult {
  status: ThreadDisplayStatus;
  isLoading: boolean;
  error: Error | null;
  taskPlan?: any;
  mutate: () => Promise<ThreadPollingResponseSchema | undefined>;
}

/**
 * Determines if all tasks in a task plan are completed
 */
function areAllTasksCompleted(taskPlan: any): boolean {
  if (!taskPlan?.tasks || !Array.isArray(taskPlan.tasks)) {
    return false;
  }

  return taskPlan.tasks.every((task: any) => task.completed === true);
}

/**
 * Maps LangGraph SDK status to display status
 */
function mapLangGraphStatusToDisplay(status: string): ThreadDisplayStatus {
  switch (status) {
    case "busy":
      return "running";
    case "idle":
      return "idle";
    case "error":
      return "error";
    case "interrupted":
      return "paused";
    default:
      return "idle";
  }
}

/**
 * Fetches thread status following the priority logic:
 * manager running > planner running > planner interrupted (paused) > programmer running > completed/idle/error
 */
async function fetchThreadStatus(
  threadId: string,
  lastPollingState: ThreadPollingResponseSchema | null,
): Promise<ThreadPollingResponseSchema> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (!apiUrl) {
    throw new Error("API URL not configured");
  }

  const client = createClient(apiUrl);

  try {
    // Step 1: Fetch manager thread status
    const managerThread = await client.threads.get<ManagerGraphState>(threadId);
    const managerStatus = managerThread.status;

    console.log("🔍 Manager thread status:", managerStatus);
    console.log("🔍 Manager thread values:", managerThread.values);
    console.log("🔍 API URL being used:", process.env.NEXT_PUBLIC_API_URL);

    // If manager is running, return early
    if (managerStatus === "busy") {
      console.log("✅ Manager is running, returning running status");
      return {
        graph: "manager",
        runId: "", // Manager threads don't have a specific run ID in metadata
        threadId,
        status: "running",
        taskPlan: managerThread.values?.taskPlan,
      };
    }

    // If manager has error, return error
    if (managerStatus === "error") {
      console.log("❌ Manager has error, returning error status");
      return {
        graph: "manager",
        runId: "", // Manager threads don't have a specific run ID in metadata
        threadId,
        status: "error",
        taskPlan: managerThread.values?.taskPlan,
      };
    }

    // If no planner session, manager is idle
    if (!managerThread.values?.plannerSession) {
      console.log("⏸️ No planner session, manager is idle");
      return {
        graph: "manager",
        runId: "", // Manager threads don't have a specific run ID in metadata
        threadId,
        status: "idle",
        taskPlan: managerThread.values?.taskPlan,
      };
    }

    // Step 2: Fetch planner run status
    const plannerSession = managerThread.values.plannerSession;
    console.log("🔍 Planner session info:", plannerSession);

    const plannerRun = await client.runs.get(
      plannerSession.threadId,
      plannerSession.runId,
    );
    const plannerRunStatus = plannerRun.status;
    console.log("🔍 Planner run status:", plannerRunStatus);
    console.log("🔍 Planner run object:", plannerRun);

    // Also get planner thread for task plan data
    const plannerThread = await client.threads.get<PlannerGraphState>(
      plannerSession.threadId,
    );
    console.log("🔍 Planner thread status:", plannerThread.status);

    // If planner run is running, return running
    if (plannerRunStatus === "running") {
      console.log("✅ Planner run is running, returning running status");
      return {
        graph: "planner",
        runId: plannerSession.runId,
        threadId: plannerSession.threadId,
        status: "running",
        taskPlan: plannerThread.values?.taskPlan,
      };
    }

    // If planner run is interrupted, return paused
    if (plannerRunStatus === "interrupted") {
      console.log("⏸️ Planner run is interrupted, returning paused status");
      return {
        graph: "planner",
        runId: plannerSession.runId,
        threadId: plannerSession.threadId,
        status: "paused",
        taskPlan: plannerThread.values?.taskPlan,
      };
    }

    // If planner run has error/timeout, return error
    if (plannerRunStatus === "timeout") {
      console.log("❌ Planner run has timeout, returning error status");
      return {
        graph: "planner",
        runId: plannerSession.runId,
        threadId: plannerSession.threadId,
        status: "error",
        taskPlan: plannerThread.values?.taskPlan,
      };
    }

    // If no programmer session, planner is idle
    if (!plannerThread.values?.programmerSession) {
      console.log("⏸️ No programmer session, planner is idle");
      return {
        graph: "planner",
        runId: plannerSession.runId,
        threadId: plannerSession.threadId,
        status: "idle",
        taskPlan: plannerThread.values?.taskPlan,
      };
    }

    // Step 3: Fetch programmer run status
    const programmerSession = plannerThread.values.programmerSession;
    console.log("🔍 Programmer session info:", programmerSession);

    const programmerRun = await client.runs.get(
      programmerSession.threadId,
      programmerSession.runId,
    );
    const programmerRunStatus = programmerRun.status;
    console.log("🔍 Programmer run status:", programmerRunStatus);
    console.log("🔍 Programmer run object:", programmerRun);

    // Also get programmer thread for task plan data
    const programmerThread = await client.threads.get<GraphState>(
      programmerSession.threadId,
    );
    console.log("🔍 Programmer thread status:", programmerThread.status);

    // If programmer run is running, return running
    if (programmerRunStatus === "running") {
      console.log("✅ Programmer run is running, returning running status");
      return {
        graph: "programmer",
        runId: programmerSession.runId,
        threadId: programmerSession.threadId,
        status: "running",
        taskPlan: programmerThread.values?.taskPlan,
      };
    }

    // If programmer run has error/timeout, return error
    if (programmerRunStatus === "timeout") {
      console.log("❌ Programmer run has timeout, returning error status");
      return {
        graph: "programmer",
        runId: programmerSession.runId,
        threadId: programmerSession.threadId,
        status: "error",
        taskPlan: programmerThread.values?.taskPlan,
      };
    }

    // Check if all tasks are completed
    const taskPlan =
      programmerThread.values?.taskPlan || plannerThread.values?.taskPlan;
    if (programmerRunStatus === "success" && areAllTasksCompleted(taskPlan)) {
      console.log("✅ Programmer run success and all tasks completed");
      return {
        graph: "programmer",
        runId: programmerSession.runId,
        threadId: programmerSession.threadId,
        status: "completed",
        taskPlan,
      };
    }

    // Default to idle if programmer is done but tasks aren't all completed
    console.log(
      "⏸️ Programmer run done but not all tasks completed, returning idle",
    );
    return {
      graph: "programmer",
      runId: programmerSession.runId,
      threadId: programmerSession.threadId,
      status: "idle",
      taskPlan,
    };
  } catch (error) {
    console.error("❌ Error fetching thread status:", error);
    console.error("❌ Error details:", {
      threadId,
      lastPollingState,
      error,
    });

    // If we have a last polling state, use that graph info for error reporting
    const graph = lastPollingState?.graph || "manager";
    const runId = lastPollingState?.runId || "";
    const errorThreadId = lastPollingState?.threadId || threadId;

    return {
      graph,
      runId,
      threadId: errorThreadId,
      status: "error",
      taskPlan: lastPollingState?.taskPlan,
    };
  }
}

/**
 * SWR-based thread status polling hook with intelligent caching
 */
export function useThreadStatus(
  threadId: string,
  options: UseThreadStatusOptions = {},
): ThreadStatusResult {
  const { enabled = true, refreshInterval = 2000 } = options;

  const {
    getThreadPollingState,
    updateThreadPollingState,
    setThreadPolling,
    isGlobalPollingEnabled,
  } = useThreadStore();

  // Get last polling state for intelligent caching
  const lastPollingState = getThreadPollingState(threadId);

  // Create SWR key that includes threadId and last polling state for cache invalidation
  const swrKey = useMemo(() => {
    if (!enabled || !isGlobalPollingEnabled) return null;
    return `thread-status-${threadId}-${lastPollingState?.runId || "initial"}`;
  }, [threadId, enabled, isGlobalPollingEnabled, lastPollingState?.runId]);

  // SWR fetcher function
  const fetcher = useCallback(async () => {
    setThreadPolling(threadId, true);
    try {
      const result = await fetchThreadStatus(threadId, lastPollingState);
      updateThreadPollingState(threadId, result);
      return result;
    } finally {
      setThreadPolling(threadId, false);
    }
  }, [threadId, lastPollingState, updateThreadPollingState, setThreadPolling]);

  // Use SWR for polling with deduplication and caching
  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    refreshInterval: enabled && isGlobalPollingEnabled ? refreshInterval : 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 1000, // Dedupe requests within 1 second
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  });

  return {
    status: data?.status || lastPollingState?.status || "idle",
    isLoading,
    error: error || null,
    taskPlan: data?.taskPlan || lastPollingState?.taskPlan,
    mutate,
  };
}
