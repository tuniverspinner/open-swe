import { GraphConfig, GraphState } from "@open-swe/shared/open-swe/types";
import {
  ManagerGraphState,
  ManagerGraphUpdate,
} from "@open-swe/shared/open-swe/manager/types";
import { createLangGraphClient } from "../../../../utils/langgraph-client.js";
import {
  BaseMessage,
  HumanMessage,
  isHumanMessage,
  RemoveMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import {
  loadModel,
  supportsParallelToolCallsParam,
  Task,
} from "../../../../utils/llms/index.js";
import { Command, END } from "@langchain/langgraph";
import { getMessageContentString } from "@open-swe/shared/messages";
import {
  createIssue,
  createIssueComment,
} from "../../../../utils/github/api.js";
import { getGitHubTokensFromConfig } from "../../../../utils/github-tokens.js";
import { createIssueFieldsFromMessages } from "../../utils/generate-issue-fields.js";
import {
  extractContentWithoutDetailsFromIssueBody,
  extractIssueTitleAndContentFromMessage,
  formatContentForIssueBody,
} from "../../../../utils/github/issue-messages.js";
import { getDefaultHeaders } from "../../../../utils/default-headers.js";
import { BASE_CLASSIFICATION_SCHEMA } from "./schemas.js";
import { getPlansFromIssue } from "../../../../utils/github/issue-task.js";
import { HumanResponse } from "@langchain/langgraph/prebuilt";
import { PLANNER_GRAPH_ID } from "@open-swe/shared/constants";
import { createLogger, LogLevel } from "../../../../utils/logger.js";
import { PlannerGraphState } from "@open-swe/shared/open-swe/planner/types";
import { createClassificationPromptAndToolSchema } from "./utils.js";
import { RequestSource } from "../../../../constants.js";
import { isLocalMode } from "../../../../utils/local-mode.js";

const logger = createLogger(LogLevel.INFO, "ClassifyMessage");

/**
 * Classify the latest human message to determine how to route the request.
 * Requests can be routed to:
 * 1. reply - dont need to plan, just reply. This could be if the user sends a message which is not classified as a request, or if the programmer/planner is already running.
 *   a. if the planner/programmer is already running, we'll simply reply with
 */
export async function classifyMessage(
  state: ManagerGraphState,
  config: GraphConfig,
): Promise<Command> {
  const userMessage = state.messages.findLast(isHumanMessage);
  if (!userMessage) {
    throw new Error("No human message found.");
  }

  // In local mode, skip LangGraph client creation since we don't need external API calls
  let plannerThread: any = undefined;
  let programmerThread: any = undefined;
  
  if (!isLocalMode(config)) {
    const langGraphClient = createLangGraphClient({
      defaultHeaders: getDefaultHeaders(config),
    });

    plannerThread = state.plannerSession?.threadId
      ? await langGraphClient.threads.get<PlannerGraphState>(
          state.plannerSession.threadId,
        )
      : undefined;
    const plannerThreadValues = plannerThread?.values;
    programmerThread = plannerThreadValues?.programmerSession?.threadId
      ? await langGraphClient.threads.get<GraphState>(
          plannerThreadValues.programmerSession.threadId,
        )
      : undefined;
  }

  const programmerStatus = programmerThread?.status ?? "not_started";
  const plannerStatus = plannerThread?.status ?? "not_started";

  // If the githubIssueId is defined, fetch the most recent task plan (if exists). Otherwise fallback to state task plan
  const issuePlans = state.githubIssueId
    ? await getPlansFromIssue(state, config)
    : null;
  const taskPlan = issuePlans?.taskPlan ?? state.taskPlan;

  const { prompt, schema } = createClassificationPromptAndToolSchema({
    programmerStatus,
    plannerStatus,
    messages: state.messages,
    taskPlan,
    proposedPlan: issuePlans?.proposedPlan ?? undefined,
    requestSource: userMessage.additional_kwargs?.requestSource as
      | RequestSource
      | undefined,
  });
  const respondAndRouteTool = {
    name: "respond_and_route",
    description: "Respond to the user's message and determine how to route it.",
    schema,
  };
  const model = await loadModel(config, Task.ROUTER);
  const modelSupportsParallelToolCallsParam = supportsParallelToolCallsParam(
    config,
    Task.ROUTER,
  );
  const modelWithTools = model.bindTools([respondAndRouteTool], {
    tool_choice: respondAndRouteTool.name,
    ...(modelSupportsParallelToolCallsParam
      ? {
          parallel_tool_calls: false,
        }
      : {}),
  });

  const response = await modelWithTools.invoke([
    {
      role: "system",
      content: prompt,
    },
    {
      role: "user",
      content: extractContentWithoutDetailsFromIssueBody(
        getMessageContentString(userMessage.content),
      ),
    },
  ]);

  const toolCall = response.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("No tool call found.");
  }
  const toolCallArgs = toolCall.args as z.infer<
    typeof BASE_CLASSIFICATION_SCHEMA
  >;

  if (toolCallArgs.route === "no_op") {
    // If it's a no_op, just add the message to the state and return.
    const commandUpdate: ManagerGraphUpdate = {
      messages: [response],
    };
    return new Command({
      update: commandUpdate,
      goto: END,
    });
  }

  if ((toolCallArgs.route as string) === "create_new_issue") {
    // Route to node which kicks off new manager run, passing in the full conversation history.
    const commandUpdate: ManagerGraphUpdate = {
      messages: [response],
    };
    return new Command({
      update: commandUpdate,
      goto: "create-new-session",
    });
  }

  // Skip GitHub token requirements in local mode
  if (!isLocalMode(config)) {
    const { githubAccessToken } = getGitHubTokensFromConfig(config);
    let githubIssueId = state.githubIssueId;

    // If the route is "new_issue", create a new issue
    if ((toolCallArgs.route as string) === "new_issue") {
      const titleAndContent = await createIssueFieldsFromMessages(
        state.messages,
        config.configurable,
      );
      const newIssue = await createIssue({
        owner: state.targetRepository.owner,
        repo: state.targetRepository.repo,
        title: titleAndContent.title,
        body: formatContentForIssueBody(titleAndContent.body),
        githubAccessToken,
      });
      if (!newIssue) {
        throw new Error("Failed to create new issue");
      }
      githubIssueId = newIssue.number;
    }

    const newMessages: BaseMessage[] = [response];
    const commandUpdate: ManagerGraphUpdate = {
      messages: newMessages,
      githubIssueId,
    };
    return new Command({
      update: commandUpdate,
      goto: "start-planner",
    });
  } else {
    // In local mode, just route to planner without GitHub issue creation
    const newMessages: BaseMessage[] = [response];
    const commandUpdate: ManagerGraphUpdate = {
      messages: newMessages,
    };
    return new Command({
      update: commandUpdate,
      goto: "start-planner",
    });
  }
}
