import { Thread } from "@langchain/langgraph-sdk";
import { createClient } from "@/providers/client";
import { ThreadUIStatus, ThreadStatusData } from "@/lib/schemas/thread-status";
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
        const [programmerRun, programmerThread] = await Promise.all([
          client.runs.get(lastState.threadId, lastState.runId),
          client.threads.get<GraphState>(lastState.threadId),
        ]);

        let programmerStatusValue: ThreadUIStatus;
        if (programmerRun.status === "running") {
          programmerStatusValue = "running";
        } else if (programmerRun.status === "timeout") {
          programmerStatusValue = "error";
        } else if (
          programmerRun.status === "success" &&
          areAllTasksCompleted(programmerThread.values?.taskPlan)
        ) {
          programmerStatusValue = "completed";
        } else {
          programmerStatusValue = "idle";
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

        let plannerStatusValue: ThreadUIStatus;
        if (plannerThread.status === "interrupted") {
          plannerStatusValue = "paused";
        } else if (
          plannerThread.interrupts &&
          Array.isArray(plannerThread.interrupts) &&
          plannerThread.interrupts.length > 0
        ) {
          plannerStatusValue = "paused";
        } else {
          const plannerRun = await client.runs.get(
            lastState.threadId,
            lastState.runId,
          );

          if (plannerRun.status === "running") {
            plannerStatusValue = "running";
          } else if (plannerRun.status === "interrupted") {
            plannerStatusValue = "paused";
          } else if (plannerRun.status === "timeout") {
            plannerStatusValue = "error";
          } else {
            plannerStatusValue = "idle";
          }
        }

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
          const [programmerRun, programmerThread] = await Promise.all([
            client.runs.get(
              programmerSession.threadId,
              programmerSession.runId,
            ),
            client.threads.get<GraphState>(programmerSession.threadId),
          ]);

          let programmerStatusValue: ThreadUIStatus;
          if (programmerRun.status === "running") {
            programmerStatusValue = "running";
          } else if (programmerRun.status === "timeout") {
            programmerStatusValue = "error";
          } else if (
            programmerRun.status === "success" &&
            areAllTasksCompleted(programmerThread.values?.taskPlan)
          ) {
            programmerStatusValue = "completed";
          } else {
            programmerStatusValue = "idle";
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
        status: mapLangGraphStatusToDisplay(managerThread.status),
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
    status: mapLangGraphStatusToDisplay(managerThread.status),
  };

  if (managerStatus.status === "running" || managerStatus.status === "error") {
    return resolver.resolve(managerStatus);
  }

  if (!managerThread.values?.plannerSession) {
    return resolver.resolve(managerStatus);
  }

  const plannerSession = managerThread.values.plannerSession;
  const plannerCacheKey = `planner:${plannerSession.threadId}:${plannerSession.runId}`;

  let plannerThread: any;
  let plannerRun: any;
  let plannerStatusValue: ThreadUIStatus = "idle";
  const cachedPlannerData = getCachedSessionData(plannerCacheKey);

  if (cachedPlannerData) {
    plannerThread = cachedPlannerData.thread;
    plannerRun = cachedPlannerData.run;

    if (plannerThread.status === "interrupted") {
      plannerStatusValue = "paused";
    } else if (
      plannerThread.interrupts &&
      Array.isArray(plannerThread.interrupts) &&
      plannerThread.interrupts.length > 0
    ) {
      plannerStatusValue = "paused";
    } else if (plannerThread.status === "busy") {
      plannerStatusValue = "running";
    } else if (plannerThread.status === "error") {
      plannerStatusValue = "error";
    } else if (!plannerRun) {
      plannerStatusValue = "idle";
    } else if (plannerRun.status === "running") {
      plannerStatusValue = "running";
    } else if (plannerRun.status === "interrupted") {
      plannerStatusValue = "paused";
    } else if (plannerRun.status === "timeout") {
      plannerStatusValue = "error";
    } else if (
      plannerRun.status === "success" &&
      !plannerThread.values?.programmerSession
    ) {
      plannerStatusValue = "idle";
    } else {
      plannerStatusValue = "idle";
    }
  } else {
    plannerThread = await client.threads.get<PlannerGraphState>(
      plannerSession.threadId,
    );

    let needsRunCall = false;

    if (plannerThread.status === "interrupted") {
      plannerStatusValue = "paused";
    } else if (
      plannerThread.interrupts &&
      Array.isArray(plannerThread.interrupts) &&
      plannerThread.interrupts.length > 0
    ) {
      plannerStatusValue = "paused";
    } else if (plannerThread.status === "busy") {
      plannerStatusValue = "running";
    } else if (plannerThread.status === "error") {
      plannerStatusValue = "error";
    } else if (plannerThread.status === "idle") {
      needsRunCall = true;
    } else {
      needsRunCall = true;
    }

    if (needsRunCall) {
      plannerRun = await client.runs.get(
        plannerSession.threadId,
        plannerSession.runId,
      );

      if (plannerRun.status === "running") {
        plannerStatusValue = "running";
      } else if (plannerRun.status === "interrupted") {
        plannerStatusValue = "paused";
      } else if (plannerRun.status === "timeout") {
        plannerStatusValue = "error";
      } else if (
        plannerRun.status === "success" &&
        !plannerThread.values?.programmerSession
      ) {
        plannerStatusValue = "idle";
      } else {
        plannerStatusValue = "idle";
      }
    } else {
      plannerRun = null;
    }

    setCachedSessionData(
      plannerCacheKey,
      { thread: plannerThread, run: plannerRun },
      "planner",
    );
  }

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
  let programmerRun: any;
  const cachedProgrammerData = getCachedSessionData(programmerCacheKey);

  if (cachedProgrammerData) {
    programmerThread = cachedProgrammerData.thread;
    programmerRun = cachedProgrammerData.run;
  } else {
    [programmerRun, programmerThread] = await Promise.all([
      client.runs.get(programmerSession.threadId, programmerSession.runId),
      client.threads.get<GraphState>(programmerSession.threadId),
    ]);

    setCachedSessionData(
      programmerCacheKey,
      { thread: programmerThread, run: programmerRun },
      "programmer",
    );
  }

  let programmerStatusValue: ThreadUIStatus;
  if (programmerRun.status === "running") {
    programmerStatusValue = "running";
  } else if (programmerRun.status === "timeout") {
    programmerStatusValue = "error";
  } else if (
    programmerRun.status === "success" &&
    areAllTasksCompleted(programmerThread.values?.taskPlan)
  ) {
    programmerStatusValue = "completed";
  } else {
    programmerStatusValue = "idle";
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
