import { Thread, Run } from "@langchain/langgraph-sdk";
import { createClient } from "@/providers/client";
import {
  ThreadUIStatus,
  ThreadStatusData,
  mapLangGraphToUIStatus,
} from "@/lib/schemas/thread-status";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import { PlannerGraphState } from "@open-swe/shared/open-swe/planner/types";

interface StatusResult {
  graph: "manager" | "planner" | "programmer";
  runId: string;
  threadId: string;
  status: ThreadUIStatus;
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
function mapLangGraphStatusToDisplay(status: string): ThreadUIStatus {
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
 * Fetches manager thread status
 */
async function getManagerStatus(
  client: ReturnType<typeof createClient>,
  threadId: string,
): Promise<StatusResult> {
  const managerThread = await client.threads.get<ManagerGraphState>(threadId);
  const status = mapLangGraphStatusToDisplay(managerThread.status);

  return {
    graph: "manager",
    runId: "",
    threadId,
    status,
  };
}

/**
 * Fetches planner run and thread status
 */
async function getPlannerStatus(
  client: ReturnType<typeof createClient>,
  plannerSession: {
    threadId: string;
    runId: string;
  },
): Promise<StatusResult> {
  const [plannerRun, plannerThread] = await Promise.all([
    client.runs.get(plannerSession.threadId, plannerSession.runId),
    client.threads.get<PlannerGraphState>(plannerSession.threadId),
  ]);

  let status: ThreadUIStatus;

  // First check if the thread itself is interrupted (plan waiting for approval)
  if (plannerThread.status === "interrupted") {
    status = "paused";
  }
  // Then check if the thread has interrupts (plan waiting for approval)
  else if (
    plannerThread.interrupts &&
    Array.isArray(plannerThread.interrupts) &&
    plannerThread.interrupts.length > 0
  ) {
    status = "paused";
  } else if (plannerRun.status === "running") {
    status = "running";
  } else if (plannerRun.status === "interrupted") {
    status = "paused";
  } else if (plannerRun.status === "timeout") {
    status = "error";
  } else if (
    plannerRun.status === "success" &&
    !plannerThread.values?.programmerSession
  ) {
    status = "idle";
  } else {
    status = "idle";
  }

  return {
    graph: "planner",
    runId: plannerSession.runId,
    threadId: plannerSession.threadId,
    status,
  };
}

/**
 * Fetches programmer run and thread status
 */
async function getProgrammerStatus(
  client: ReturnType<typeof createClient>,
  programmerSession: {
    threadId: string;
    runId: string;
  },
): Promise<StatusResult> {
  const [programmerRun, programmerThread] = await Promise.all([
    client.runs.get(programmerSession.threadId, programmerSession.runId),
    client.threads.get<GraphState>(programmerSession.threadId),
  ]);

  let status: ThreadUIStatus;
  if (programmerRun.status === "running") {
    status = "running";
  } else if (programmerRun.status === "timeout") {
    status = "error";
  } else if (
    programmerRun.status === "success" &&
    areAllTasksCompleted(programmerThread.values?.taskPlan)
  ) {
    status = "completed";
  } else {
    status = "idle";
  }

  return {
    graph: "programmer",
    runId: programmerSession.runId,
    threadId: programmerSession.threadId,
    status,
  };
}

/**
 * Status resolver using priority logic:
 * manager running > planner running > planner interrupted (paused) > programmer running > completed/idle/error
 */
export class StatusResolver {
  resolve(
    manager: StatusResult,
    planner?: StatusResult,
    programmer?: StatusResult,
  ): ThreadStatusData {
    // Priority 1: Manager is running or has error
    if (manager.status === "running" || manager.status === "error") {
      const result = manager;
      return result;
    }

    // Priority 2: No planner session - manager is idle
    if (!planner) {
      const result = manager;
      return result;
    }

    // Priority 3: Planner is running or paused (interrupted)
    if (planner.status === "running" || planner.status === "paused") {
      const result = planner;
      return result;
    }

    // Priority 4: Planner has error
    if (planner.status === "error") {
      const result = planner;
      return result;
    }

    // Priority 5: No programmer session - planner is idle
    if (!programmer) {
      const result = planner;
      return result;
    }

    // Priority 6: Return programmer status (running, completed, idle, or error)
    const result = programmer;
    return result;
  }
}

/**
 * Main service function to fetch thread status
 * Uses lastPollingState to optimize API calls by checking the previously active graph first
 */
export async function fetchThreadStatus(
  threadId: string,
  lastPollingState: ThreadStatusData | null = null,
): Promise<ThreadStatusData> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    if (!apiUrl) {
      console.error("[fetchThreadStatus] Missing API URL");
      throw new Error("API URL not configured");
    }

    const client = createClient(apiUrl);
    const resolver = new StatusResolver();

    // Optimization: If we have lastPollingState, check that graph first
    if (lastPollingState) {
      try {
        const optimizedResult = await checkLastKnownGraph(
          client,
          lastPollingState,
          resolver,
        );
        if (optimizedResult) {
          return optimizedResult;
        }
        // If optimization failed, fall through to full check
      } catch (error) {
        console.warn(
          "Optimization check failed, falling back to full status check:",
          error,
        );
        // Fall through to full check
      }
    }

    // Full status check - same logic as before but more efficient
    return await performFullStatusCheck(client, threadId, resolver);
  } catch (error) {
    console.error(`[fetchThreadStatus] Error for thread ${threadId}:`, error);

    // Return error status with fallback information
    const graph = lastPollingState?.graph || "manager";
    const runId = lastPollingState?.runId || "";
    const errorThreadId = lastPollingState?.threadId || threadId;

    return {
      graph,
      runId,
      threadId: errorThreadId,
      status: "error",
    };
  }
}

/**
 * Optimized status check using last known state
 */
async function checkLastKnownGraph(
  client: ReturnType<typeof createClient>,
  lastState: ThreadStatusData,
  resolver: StatusResolver,
): Promise<ThreadStatusData | null> {
  // Check the status of the last known active graph directly
  switch (lastState.graph) {
    case "programmer":
      if (lastState.threadId && lastState.runId) {
        const programmerStatus = await getProgrammerStatus(client, {
          threadId: lastState.threadId,
          runId: lastState.runId,
        });

        // If programmer is still running or has error, we can return early
        if (
          programmerStatus.status === "running" ||
          programmerStatus.status === "error"
        ) {
          return programmerStatus;
        }

        // If programmer finished, we need to do a full check to see final state
        return null;
      }
      break;

    case "planner":
      if (lastState.threadId && lastState.runId) {
        const plannerStatus = await getPlannerStatus(client, {
          threadId: lastState.threadId,
          runId: lastState.runId,
        });

        // If planner is still running, paused, or has error, return early
        if (
          plannerStatus.status === "running" ||
          plannerStatus.status === "paused" ||
          plannerStatus.status === "error"
        ) {
          return plannerStatus;
        }

        // If planner finished, need to check if programmer started
        const plannerThread = await client.threads.get<PlannerGraphState>(
          lastState.threadId,
        );
        if (plannerThread.values?.programmerSession) {
          // Programmer started, check programmer status
          const programmerStatus = await getProgrammerStatus(
            client,
            plannerThread.values.programmerSession,
          );
          return resolver.resolve(
            {
              graph: "manager",
              runId: "",
              threadId: lastState.threadId,
              status: "idle",
            },
            plannerStatus,
            programmerStatus,
          );
        }

        // No programmer session, planner is idle
        return plannerStatus;
      }
      break;

    case "manager": {
      // Manager was last active, check manager first
      const managerStatus = await getManagerStatus(client, lastState.threadId);
      if (
        managerStatus.status === "running" ||
        managerStatus.status === "error"
      ) {
        return managerStatus;
      }
      // Manager not running, need full check
      return null;
    }
  }

  return null;
}

/**
 * Full status check - performs complete hierarchy check
 */
async function performFullStatusCheck(
  client: ReturnType<typeof createClient>,
  threadId: string,
  resolver: StatusResolver,
): Promise<ThreadStatusData> {
  // Step 1: Get manager status
  const managerStatus = await getManagerStatus(client, threadId);
  const managerThread = await client.threads.get<ManagerGraphState>(threadId);

  // Early returns for manager-level conditions
  if (managerStatus.status === "running" || managerStatus.status === "error") {
    return resolver.resolve(managerStatus);
  }

  if (!managerThread.values?.plannerSession) {
    return resolver.resolve(managerStatus);
  }

  // Step 2: Get planner status
  const plannerStatus = await getPlannerStatus(
    client,
    managerThread.values.plannerSession,
  );
  const plannerThread = await client.threads.get<PlannerGraphState>(
    managerThread.values.plannerSession.threadId,
  );

  // Early returns for planner-level conditions
  if (
    plannerStatus.status === "running" ||
    plannerStatus.status === "paused" ||
    plannerStatus.status === "error"
  ) {
    return resolver.resolve(managerStatus, plannerStatus);
  }

  if (!plannerThread.values?.programmerSession) {
    return resolver.resolve(managerStatus, plannerStatus);
  }

  // Step 3: Get programmer status
  const programmerStatus = await getProgrammerStatus(
    client,
    plannerThread.values.programmerSession,
  );

  // Return final resolved status
  return resolver.resolve(managerStatus, plannerStatus, programmerStatus);
}
