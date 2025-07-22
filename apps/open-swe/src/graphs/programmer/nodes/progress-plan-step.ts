import { v4 as uuidv4 } from "uuid";
import { createLogger, LogLevel } from "../../../utils/logger.js";
import {
  GraphConfig,
  GraphState,
  GraphUpdate,
  PlanItem,
} from "@open-swe/shared/open-swe/types";
import {
  loadModel,
  supportsParallelToolCallsParam,
  Task,
} from "../../../utils/load-model.js";
import { formatPlanPrompt } from "../../../utils/plan-prompt.js";
import { Command } from "@langchain/langgraph";
import { formatUserRequestPrompt } from "../../../utils/user-request.js";
import {
  completePlanItem,
  getActivePlanItems,
  getActiveTask,
} from "@open-swe/shared/open-swe/tasks";
import {
  getCurrentPlanItem,
  getRemainingPlanItems,
} from "../../../utils/current-task.js";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { addTaskPlanToIssue } from "../../../utils/github/issue-task.js";
import {
  createMarkTaskNotCompletedToolFields,
  createMarkTaskCompletedToolFields,
} from "@open-swe/shared/open-swe/tools";
import {
  calculateConversationHistoryTokenCount,
  getMessagesSinceLastSummary,
  MAX_INTERNAL_TOKENS,
} from "../../../utils/tokens.js";
import { z } from "zod";
import {
  CacheablePromptSegment,
  convertMessagesToCacheControlledMessages,
  trackCachePerformance,
} from "../../../utils/caching.js";

const logger = createLogger(LogLevel.INFO, "ProgressPlanStep");

const systemPrompt = `<identity>
You are operating as a terminal-based agentic coding assistant built by LangChain. It wraps LLM models to enable natural language interaction with a local codebase. You are expected to be precise, safe, and helpful.
</identity>

<workflow>
In your workflow, you generate a plan, then act on said plan. It may take many actions to complete a single step, or a single action to complete the step.

Analyze the tasks you've completed, the tasks which are remaining, and the current task you just took an action on.
In addition to this, you're also provided the full conversation history between you and the user. All of the messages in this conversation are from the previous steps/actions you've taken, and any user input.
If the task you're working on is to fix a failing command (e.g. a test, build, lint, etc.), and you've made changes to fix the issue, you must re-run the command to ensure the fix was successful before you can mark the task as complete.
  For example: If you have a failing test, and you've applied an update to the file to fix the test, you MUST re-run the test before you can mark the task as complete.
</workflow>

<task>
Take all of this information, and determine if the current task is complete, or if you still have work left to do.
Once you've determined the status of the current task, call either:
- \`mark_task_completed\` if the task is complete.
- \`mark_task_not_completed\` if the task is not complete.
</task>`;

const systemPlanPrompt = `Here is the plan, along with the summaries of each completed task:
{PLAN_PROMPT}`;

const formatCacheableSystemPrompt = (
  activePlanItems: PlanItem[],
): CacheablePromptSegment[] => {
  const segments: CacheablePromptSegment[] = [
    // Cache Breakpoint 2: Static Instructions
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    },
    // Cache Breakpoint 3: Dynamic Context
    {
      type: "text",
      text: systemPlanPrompt.replace(
        "{PLAN_PROMPT}",
        formatPlanPrompt(activePlanItems, { includeSummaries: true }),
      ),
      cache_control: { type: "ephemeral" },
    },
  ];

  return segments.filter((segment) => segment.text.trim() !== "");
};

const formatCacheableUserPromptPrefix = (
  state: GraphState,
): CacheablePromptSegment[] => {
  const segments: CacheablePromptSegment[] = [
    {
      type: "text",
      text: "The following messages contain the full conversation history including the user's request(s):",
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `Here is the user's request(s):\n${formatUserRequestPrompt(state.internalMessages)}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  return segments.filter((segment) => segment.text.trim() !== "");
};

const formatCacheableUserPromptSuffix = (): CacheablePromptSegment[] => {
  const segments: CacheablePromptSegment[] = [
    {
      type: "text",
      text: `Take all of the messages above, and determine whether or not you have completed this task in the plan.

You are NOT allowed to take any action other than calling the \`mark_task_completed\` or \`mark_task_not_completed\` tool.

Once you've determined the status of the current task, call either the \`mark_task_completed\` or \`mark_task_not_completed\` tool.`,
      cache_control: { type: "ephemeral" },
    },
  ];

  return segments.filter((segment) => segment.text.trim() !== "");
};

export async function progressPlanStep(
  state: GraphState,
  config: GraphConfig,
): Promise<Command> {
  const markNotCompletedTool = createMarkTaskNotCompletedToolFields();
  const markCompletedTool = createMarkTaskCompletedToolFields();
  const model = await loadModel(config, Task.SUMMARIZER);
  const modelSupportsParallelToolCallsParam = supportsParallelToolCallsParam(
    config,
    Task.SUMMARIZER,
  );
  const tools = [markNotCompletedTool, markCompletedTool];
  tools[tools.length - 1] = {
    ...tools[tools.length - 1],
    cache_control: { type: "ephemeral" },
  } as any;

  const modelWithTools = model.bindTools(tools, {
    tool_choice: "any",
    ...(modelSupportsParallelToolCallsParam
      ? {
          parallel_tool_calls: false,
        }
      : {}),
  });

  const allUserMessages = [
    new HumanMessage({
      content: formatCacheableUserPromptPrefix(state),
    }),
    ...state.internalMessages,
    new HumanMessage({
      content: formatCacheableUserPromptSuffix(),
    }),
  ];
  const allReviewerMessagesWithCache =
    convertMessagesToCacheControlledMessages(allUserMessages);

  const activePlanItems = getActivePlanItems(state.taskPlan);
  const response = await modelWithTools.invoke([
    {
      role: "system",
      content: formatCacheableSystemPrompt(activePlanItems),
    },
    ...allReviewerMessagesWithCache,
  ]);
  const toolCall = response.tool_calls?.[0];

  if (!toolCall) {
    throw new Error(
      "Failed to generate a tool call when checking task status.",
    );
  }

  const isCompleted = toolCall.name === markCompletedTool.name;
  const currentTask = getCurrentPlanItem(activePlanItems);
  const toolMessage = new ToolMessage({
    id: uuidv4(),
    tool_call_id: toolCall.id ?? "",
    content: `Saved task status as ${isCompleted ? "completed" : "not completed"} for task ${currentTask?.plan || "unknown"}`,
    name: toolCall.name,
  });

  const newMessages = [response, toolMessage];

  const newMessageList = [...state.internalMessages, ...newMessages];
  const wouldBeConversationHistoryToSummarize =
    await getMessagesSinceLastSummary(newMessageList, {
      excludeHiddenMessages: true,
      excludeCountFromEnd: 20,
    });
  const totalInternalTokenCount = calculateConversationHistoryTokenCount(
    wouldBeConversationHistoryToSummarize,
    {
      // Retain the last 20 messages from state
      excludeHiddenMessages: true,
      excludeCountFromEnd: 20,
    },
  );

  if (!isCompleted) {
    logger.info("Current task has not been completed.", {
      reasoning: toolCall.args.reasoning,
    });
    const commandUpdate: GraphUpdate = {
      messages: newMessages,
      internalMessages: newMessages,
      tokenData: trackCachePerformance(response),
    };

    // Check if we have any messages to summarize, and if we're at or above the max token limit.
    if (totalInternalTokenCount >= MAX_INTERNAL_TOKENS) {
      logger.info(
        "Internal messages list is at or above the max token limit. Routing to summarize history step.",
        {
          totalInternalTokenCount,
          maxInternalTokenCount: MAX_INTERNAL_TOKENS,
          wouldBeConversationHistoryToSummarizeLength:
            wouldBeConversationHistoryToSummarize.length,
        },
      );
      return new Command({
        goto: "summarize-history",
        update: commandUpdate,
      });
    }

    return new Command({
      goto: "generate-action",
      update: commandUpdate,
    });
  }
  const summary = (toolCall.args as z.infer<typeof markCompletedTool.schema>)
    .completed_task_summary;

  // LLM marked as completed, so we need to update the plan to reflect that.
  const updatedPlanTasks = completePlanItem(
    state.taskPlan,
    getActiveTask(state.taskPlan).id,
    currentTask.index,
    summary,
  );
  // Update the github issue to reflect this task as completed.
  await addTaskPlanToIssue(
    {
      githubIssueId: state.githubIssueId,
      targetRepository: state.targetRepository,
    },
    config,
    updatedPlanTasks,
  );

  // This should in theory never happen, but ensure we route properly if it does.
  const remainingTask = getRemainingPlanItems(activePlanItems)?.[0];
  if (!remainingTask) {
    logger.info(
      "Found no remaining tasks in the plan during the check plan step. Continuing to the conclusion generation step.",
    );
    const commandUpdate: GraphUpdate = {
      messages: newMessages,
      internalMessages: newMessages,
      // Even though there are no remaining tasks, still mark as completed so the UI reflects that the task is completed.
      taskPlan: updatedPlanTasks,
      tokenData: trackCachePerformance(response),
    };
    return new Command({
      goto: "route-to-review-or-conclusion",
      update: commandUpdate,
    });
  }

  logger.info("Task marked as completed. Routing to task summarization step.", {
    remainingTask: {
      ...remainingTask,
      completed: true,
    },
  });

  const commandUpdate: GraphUpdate = {
    messages: newMessages,
    internalMessages: newMessages,
    taskPlan: updatedPlanTasks,
    tokenData: trackCachePerformance(response),
  };

  if (totalInternalTokenCount >= MAX_INTERNAL_TOKENS) {
    logger.info(
      "Internal messages list is at or above the max token limit. Routing to summarize history step.",
      {
        totalInternalTokenCount,
        maxInternalTokenCount: MAX_INTERNAL_TOKENS,
      },
    );
    return new Command({
      goto: "summarize-history",
      update: commandUpdate,
    });
  }

  return new Command({
    goto: "generate-action",
    update: commandUpdate,
  });
}
