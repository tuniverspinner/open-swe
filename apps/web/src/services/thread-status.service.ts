import { Thread, Run } from "@langchain/langgraph-sdk";
import { createClient } from "@/providers/client";
import {
  ThreadDisplayStatus,
  ThreadPollingResponseSchema,
} from "@/lib/schemas/thread-status";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import { PlannerGraphState } from "@open-swe/shared/open-swe/planner/types";

interface StatusResult {
  graph: "manager" | "planner" | "programmer";
  runId: string;
  threadId: string;
  status: ThreadDisplayStatus;
  taskPlan?: any;
}

/**
 * Service class for fetching thread status information
 */
export class ThreadStatusService {
  public client;

  constructor(apiUrl: string) {
    if (!apiUrl) {
      throw new Error("API URL not configured");
    }
    this.client = createClient(apiUrl);
  }

  /**
   * Determines if all tasks in a task plan are completed
   */
  private areAllTasksCompleted(taskPlan: any): boolean {
    if (!taskPlan?.tasks || !Array.isArray(taskPlan.tasks)) {
      return false;
    }
    return taskPlan.tasks.every((task: any) => task.completed === true);
  }

  /**
   * Maps LangGraph SDK status to display status
   */
  private mapLangGraphStatusToDisplay(status: string): ThreadDisplayStatus {
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
  async getManagerStatus(threadId: string): Promise<StatusResult> {
    const managerThread =
      await this.client.threads.get<ManagerGraphState>(threadId);
    const status = this.mapLangGraphStatusToDisplay(managerThread.status);

    return {
      graph: "manager",
      runId: "",
      threadId,
      status,
      taskPlan: managerThread.values?.taskPlan,
    };
  }

  /**
   * Fetches planner run and thread status
   */
  async getPlannerStatus(plannerSession: {
    threadId: string;
    runId: string;
  }): Promise<StatusResult> {
    const [plannerRun, plannerThread] = await Promise.all([
      this.client.runs.get(plannerSession.threadId, plannerSession.runId),
      this.client.threads.get<PlannerGraphState>(plannerSession.threadId),
    ]);

    let status: ThreadDisplayStatus;
    if (plannerRun.status === "running") {
      status = "running";
    } else if (plannerRun.status === "interrupted") {
      status = "paused";
    } else if (plannerRun.status === "timeout") {
      status = "error";
    } else {
      status = "idle";
    }

    return {
      graph: "planner",
      runId: plannerSession.runId,
      threadId: plannerSession.threadId,
      status,
      taskPlan: plannerThread.values?.taskPlan,
    };
  }

  /**
   * Fetches programmer run and thread status
   */
  async getProgrammerStatus(programmerSession: {
    threadId: string;
    runId: string;
  }): Promise<StatusResult> {
    const [programmerRun, programmerThread] = await Promise.all([
      this.client.runs.get(programmerSession.threadId, programmerSession.runId),
      this.client.threads.get<GraphState>(programmerSession.threadId),
    ]);

    let status: ThreadDisplayStatus;
    if (programmerRun.status === "running") {
      status = "running";
    } else if (programmerRun.status === "timeout") {
      status = "error";
    } else if (
      programmerRun.status === "success" &&
      this.areAllTasksCompleted(programmerThread.values?.taskPlan)
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
      taskPlan: programmerThread.values?.taskPlan,
    };
  }
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
  ): ThreadPollingResponseSchema {
    // Priority 1: Manager is running or has error
    if (manager.status === "running" || manager.status === "error") {
      return manager;
    }

    // Priority 2: No planner session - manager is idle
    if (!planner) {
      return manager;
    }

    // Priority 3: Planner is running or paused
    if (planner.status === "running" || planner.status === "paused") {
      return planner;
    }

    // Priority 4: Planner has error
    if (planner.status === "error") {
      return planner;
    }

    // Priority 5: No programmer session - planner is idle
    if (!programmer) {
      return planner;
    }

    // Priority 6: Return programmer status (running, completed, idle, or error)
    return programmer;
  }
}

/**
 * Main service function to fetch thread status
 */
export async function fetchThreadStatus(
  threadId: string,
  lastPollingState: ThreadPollingResponseSchema | null = null,
): Promise<ThreadPollingResponseSchema> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    const service = new ThreadStatusService(apiUrl);
    const resolver = new StatusResolver();

    // Step 1: Get manager status
    const managerStatus = await service.getManagerStatus(threadId);
    const managerThread =
      await service.client.threads.get<ManagerGraphState>(threadId);

    // Early returns for manager-level conditions
    if (
      managerStatus.status === "running" ||
      managerStatus.status === "error"
    ) {
      return resolver.resolve(managerStatus);
    }

    if (!managerThread.values?.plannerSession) {
      return resolver.resolve(managerStatus);
    }

    // Step 2: Get planner status
    const plannerStatus = await service.getPlannerStatus(
      managerThread.values.plannerSession,
    );
    const plannerThread = await service.client.threads.get<PlannerGraphState>(
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
    const programmerStatus = await service.getProgrammerStatus(
      plannerThread.values.programmerSession,
    );

    // Return final resolved status
    return resolver.resolve(managerStatus, plannerStatus, programmerStatus);
  } catch (error) {
    // Return error status with fallback information
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
