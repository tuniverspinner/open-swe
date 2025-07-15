import { Thread } from "@langchain/langgraph-sdk";
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
  taskPlan?: any;
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

export class StatusResolver {
  resolve(
    manager: StatusResult,
    planner?: StatusResult,
    programmer?: StatusResult,
  ): ThreadStatusData {
    if (manager.status === "running" || manager.status === "error") {
      return manager;
    }

    if (!planner) {
      return manager;
    }

    if (planner.status === "running" || planner.status === "paused") {
      return planner;
    }

    if (planner.status === "error") {
      return planner;
    }

    if (!programmer) {
      return planner;
    }

    return programmer;
  }
}

const sessionDataCache = new Map<
  string,
  {
    data: any;
    timestamp: number;
    type: "planner" | "programmer";
  }
>();

const CACHE_TTL = 30 * 1000;

function getCachedSessionData(sessionKey: string): any | null {
  const cached = sessionDataCache.get(sessionKey);
  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
  if (isExpired) {
    sessionDataCache.delete(sessionKey);
    return null;
  }

  return cached.data;
}

function setCachedSessionData(
  sessionKey: string,
  data: any,
  type: "planner" | "programmer",
): void {
  sessionDataCache.set(sessionKey, {
    data,
    timestamp: Date.now(),
    type,
  });
}

export async function fetchThreadStatus(
  threadId: string,
  lastPollingState: ThreadStatusData | null = null,
  managerThreadData?: Thread<ManagerGraphState> | null,
  sessionCache?: Map<string, any>,
): Promise<ThreadStatusData> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    if (!apiUrl) {
      throw new Error("API URL not configured");
    }

    const client = createClient(apiUrl);
    const resolver = new StatusResolver();

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
      } catch (error) {
        console.warn(
          "Optimization check failed, falling back to full status check:",
          error,
        );
      }
    }

    return await performFullStatusCheck(
      client,
      threadId,
      resolver,
      managerThreadData,
    );
  } catch (error) {
    console.error(`Error fetching thread status for ${threadId}:`, error);

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

async function checkLastKnownGraph(
  client: ReturnType<typeof createClient>,
  lastState: ThreadStatusData,
  resolver: StatusResolver,
): Promise<ThreadStatusData | null> {
  switch (lastState.graph) {
    case "programmer":
      if (lastState.threadId && lastState.runId) {
        const programmerThread = await client.threads.get<GraphState>(
          lastState.threadId,
        );

        // Use thread status directly for most cases
        let programmerStatusValue = mapLangGraphToUIStatus(
          programmerThread.status,
        );

        // Only check run status if thread is idle and we need to determine completed vs idle
        if (programmerThread.status === "idle") {
          const programmerRun = await client.runs.get(
            lastState.threadId,
            lastState.runId,
          );

          if (
            programmerRun.status === "success" &&
            areAllTasksCompleted(programmerThread.values?.taskPlan)
          ) {
            programmerStatusValue = "completed";
          }
          // else keep the mapped thread status (idle)
        }

        const programmerStatus: StatusResult = {
          graph: "programmer",
          runId: lastState.runId,
          threadId: lastState.threadId,
          status: programmerStatusValue,
          taskPlan: programmerThread.values?.taskPlan,
        };

        if (
          programmerStatus.status === "running" ||
          programmerStatus.status === "error"
        ) {
          return programmerStatus;
        }

        return null;
      }
      break;

    case "planner":
      if (lastState.threadId && lastState.runId) {
        const plannerThread = await client.threads.get<PlannerGraphState>(
          lastState.threadId,
        );

        // Use thread status directly for most cases
        let plannerStatusValue = mapLangGraphToUIStatus(plannerThread.status);

        // Special case: check for interrupts even if thread status doesn't show interrupted
        if (
          plannerThread.interrupts &&
          Array.isArray(plannerThread.interrupts) &&
          plannerThread.interrupts.length > 0
        ) {
          plannerStatusValue = "paused";
        }

        // No need to check run status for planners - thread status is sufficient

        const plannerStatus: StatusResult = {
          graph: "planner",
          runId: lastState.runId,
          threadId: lastState.threadId,
          status: plannerStatusValue,
        };

        if (
          plannerStatus.status === "running" ||
          plannerStatus.status === "paused" ||
          plannerStatus.status === "error"
        ) {
          return plannerStatus;
        }

        if (plannerThread.values?.programmerSession) {
          const programmerSession = plannerThread.values.programmerSession;
          const programmerThread = await client.threads.get<GraphState>(
            programmerSession.threadId,
          );

          // Use thread status directly for most cases
          let programmerStatusValue = mapLangGraphToUIStatus(
            programmerThread.status,
          );

          // Only check run status if thread is idle and we need to determine completed vs idle
          if (programmerThread.status === "idle") {
            const programmerRun = await client.runs.get(
              programmerSession.threadId,
              programmerSession.runId,
            );

            if (
              programmerRun.status === "success" &&
              areAllTasksCompleted(programmerThread.values?.taskPlan)
            ) {
              programmerStatusValue = "completed";
            }
            // else keep the mapped thread status (idle)
          }

          const programmerStatus: StatusResult = {
            graph: "programmer",
            runId: programmerSession.runId,
            threadId: programmerSession.threadId,
            status: programmerStatusValue,
            taskPlan: programmerThread.values?.taskPlan,
          };

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

        return plannerStatus;
      }
      break;

    case "manager": {
      const managerThread = await client.threads.get<ManagerGraphState>(
        lastState.threadId,
      );
      const managerStatus: StatusResult = {
        graph: "manager",
        runId: "",
        threadId: lastState.threadId,
        status: mapLangGraphToUIStatus(managerThread.status),
      };

      if (
        managerStatus.status === "running" ||
        managerStatus.status === "error"
      ) {
        return managerStatus;
      }

      return null;
    }
  }

  return null;
}

async function performFullStatusCheck(
  client: ReturnType<typeof createClient>,
  threadId: string,
  resolver: StatusResolver,
  managerThreadData?: Thread<ManagerGraphState> | null,
): Promise<ThreadStatusData> {
  let managerThread: Thread<ManagerGraphState>;

  if (managerThreadData) {
    managerThread = managerThreadData;
  } else {
    managerThread = await client.threads.get<ManagerGraphState>(threadId);
  }

  const managerStatus: StatusResult = {
    graph: "manager",
    runId: "",
    threadId,
    status: mapLangGraphToUIStatus(managerThread.status),
  };

  // If manager is running or has error, return immediately without checking sub-sessions
  if (managerStatus.status === "running" || managerStatus.status === "error") {
    return resolver.resolve(managerStatus);
  }

  if (!managerThread.values?.plannerSession) {
    return resolver.resolve(managerStatus);
  }

  const plannerSession = managerThread.values.plannerSession;
  const plannerCacheKey = `planner:${plannerSession.threadId}:${plannerSession.runId}`;

  let plannerThread: any;
  let plannerRun: any = null;
  const cachedPlannerData = getCachedSessionData(plannerCacheKey);

  if (cachedPlannerData) {
    plannerThread = cachedPlannerData.thread;
    plannerRun = cachedPlannerData.run;
  } else {
    plannerThread = await client.threads.get<PlannerGraphState>(
      plannerSession.threadId,
    );

    // No run fetch needed for planners - thread status is sufficient

    setCachedSessionData(
      plannerCacheKey,
      { thread: plannerThread, run: plannerRun },
      "planner",
    );
  }

  // Use thread status directly for most cases
  let plannerStatusValue = mapLangGraphToUIStatus(plannerThread.status);

  // Special case: check for interrupts even if thread status doesn't show interrupted
  if (
    plannerThread.interrupts &&
    Array.isArray(plannerThread.interrupts) &&
    plannerThread.interrupts.length > 0
  ) {
    plannerStatusValue = "paused";
  }

  // No run status check needed for planners

  const plannerStatus: StatusResult = {
    graph: "planner",
    runId: plannerSession.runId,
    threadId: plannerSession.threadId,
    status: plannerStatusValue,
  };

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

  const programmerSession = plannerThread.values.programmerSession;
  const programmerCacheKey = `programmer:${programmerSession.threadId}:${programmerSession.runId}`;

  let programmerThread: any;
  let programmerRun: any = null;
  const cachedProgrammerData = getCachedSessionData(programmerCacheKey);

  if (cachedProgrammerData) {
    programmerThread = cachedProgrammerData.thread;
    programmerRun = cachedProgrammerData.run;
  } else {
    programmerThread = await client.threads.get<GraphState>(
      programmerSession.threadId,
    );

    // Only fetch run if thread is idle and we need to check for completion/timeout
    if (programmerThread.status === "idle") {
      programmerRun = await client.runs.get(
        programmerSession.threadId,
        programmerSession.runId,
      );
    }

    setCachedSessionData(
      programmerCacheKey,
      { thread: programmerThread, run: programmerRun },
      "programmer",
    );
  }

  // Use thread status directly for most cases
  let programmerStatusValue = mapLangGraphToUIStatus(programmerThread.status);

  // Only check run status if thread is idle and we need to determine completed vs idle
  if (programmerThread.status === "idle" && programmerRun) {
    if (
      programmerRun.status === "success" &&
      areAllTasksCompleted(programmerThread.values?.taskPlan)
    ) {
      programmerStatusValue = "completed";
    }
    // else keep the mapped thread status (idle)
  }

  const programmerStatus: StatusResult = {
    graph: "programmer",
    runId: programmerSession.runId,
    threadId: programmerSession.threadId,
    status: programmerStatusValue,
    taskPlan: programmerThread.values?.taskPlan,
  };

  return resolver.resolve(managerStatus, plannerStatus, programmerStatus);
}
