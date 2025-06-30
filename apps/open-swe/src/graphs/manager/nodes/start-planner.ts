import { v4 as uuidv4 } from "uuid";
import { GraphConfig } from "@open-swe/shared/open-swe/types";
import {
  ManagerGraphState,
  ManagerGraphUpdate,
} from "@open-swe/shared/open-swe/manager/types";
import { createLangGraphClient } from "../../../utils/langgraph-client.js";
import {
  GITHUB_INSTALLATION_TOKEN_COOKIE,
  GITHUB_TOKEN_COOKIE,
  GITHUB_USER_ID_HEADER,
  GITHUB_USER_LOGIN_HEADER,
} from "@open-swe/shared/constants";
import { createLogger, LogLevel } from "../../../utils/logger.js";
import { getBranchName } from "../../../utils/github/git.js";

const logger = createLogger(LogLevel.INFO, "StartPlanner");

/**
 * Start planner node.
 * This node will kickoff a new planner session using the LangGraph SDK.
 */
export async function startPlanner(
  state: ManagerGraphState,
  config: GraphConfig,
): Promise<ManagerGraphUpdate> {
  const langGraphClient = createLangGraphClient({
    defaultHeaders: {
      [GITHUB_TOKEN_COOKIE]: config.configurable?.[GITHUB_TOKEN_COOKIE] ?? "",
      [GITHUB_INSTALLATION_TOKEN_COOKIE]:
        config.configurable?.[GITHUB_INSTALLATION_TOKEN_COOKIE] ?? "",
      [GITHUB_USER_ID_HEADER]:
        config.configurable?.[GITHUB_USER_ID_HEADER] ?? "",
      [GITHUB_USER_LOGIN_HEADER]:
        config.configurable?.[GITHUB_USER_LOGIN_HEADER] ?? "",
    },
  });

  const plannerThreadId = state.plannerSession?.threadId ?? uuidv4();
  try {
    const run = await langGraphClient.runs.create(plannerThreadId, "planner", {
      input: {
        // github issue ID & target repo so the planning agent can fetch the user's request, and clone the repo.
        githubIssueId: state.githubIssueId,
        targetRepository: state.targetRepository,
        // Include the existing task plan, so the agent can use it as context when generating followup tasks.
        taskPlan: state.taskPlan,
        branchName: state.branchName ?? getBranchName(config),
      },
      config: {
        recursion_limit: 400,
      },
      ifNotExists: "create",
      multitaskStrategy: "enqueue",
      streamResumable: true,
      streamMode: ["values", "messages", "custom"],
    });

    return {
      plannerSession: {
        threadId: plannerThreadId,
        runId: run.run_id,
      },
    };
  } catch (error) {
    logger.error("Failed to start planner", {
      ...(error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : {
            error,
          }),
    });
    throw error;
  }
}
