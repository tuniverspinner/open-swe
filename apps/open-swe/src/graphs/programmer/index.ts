import { END, Send, START, StateGraph } from "@langchain/langgraph";
import {
  GraphAnnotation,
  GraphConfiguration,
  GraphState,
} from "@open-swe/shared/open-swe/types";
import {
  generateAction,
  takeAction,
  progressPlanStep,
  generateConclusion,
  openPullRequest,
  diagnoseError,
  requestHelp,
  updatePlan,
  summarizeHistory,
} from "./nodes/index.js";
import { isAIMessage } from "@langchain/core/messages";
import { initializeSandbox } from "../shared/initialize-sandbox.js";
import { getRemainingPlanItems } from "../../utils/current-task.js";
import { getActivePlanItems } from "@open-swe/shared/open-swe/tasks";

/**
 * Routes to the next appropriate node after taking action.
 * If the last message is an AI message with tool calls, it routes to "take-action".
 * Otherwise, it ends the process.
 *
 * @param {GraphState} state - The current graph state.
 * @returns {"generate-conclusion" | "take-action" | "request-help" | "generate-action" | Send} The next node to execute, or END if the process should stop.
 */
async function routeGeneratedAction(
  state: GraphState,
): Promise<
  | "generate-conclusion"
  | "take-action"
  | "request-help"
  | "generate-action"
  | Send
> {
  const { internalMessages } = state;
  const lastMessage = internalMessages[internalMessages.length - 1];

  // If the message is an AI message, and it has tool calls, we should take action.
  if (isAIMessage(lastMessage) && lastMessage.tool_calls?.length) {
    const toolCall = lastMessage.tool_calls[0];
    if (toolCall.name === "request_human_help") {
      return "request-help";
    }

    if (
      toolCall.name === "update_plan" &&
      "update_plan_reasoning" in toolCall.args &&
      typeof toolCall.args?.update_plan_reasoning === "string"
    ) {
      // Need to return a `Send` here so that we can update the state to include the plan change request.
      return new Send("update-plan", {
        planChangeRequest: toolCall.args?.update_plan_reasoning,
      });
    }

    return "take-action";
  }

  const activePlanItems = getActivePlanItems(state.taskPlan);
  const hasRemainingTasks = getRemainingPlanItems(activePlanItems).length > 0;
  // If the model did not generate a tool call, but there are remaining tasks, we should route back to the generate action step.
  if (hasRemainingTasks) {
    return "generate-action";
  }

  // No tool calls, generate a conclusion.
  return "generate-conclusion";
}

const workflow = new StateGraph(GraphAnnotation, GraphConfiguration)
  .addNode("initialize", initializeSandbox)
  .addNode("generate-action", generateAction)
  .addNode("take-action", takeAction, {
    ends: ["progress-plan-step", "diagnose-error"],
  })
  .addNode("update-plan", updatePlan)
  .addNode("progress-plan-step", progressPlanStep, {
    ends: ["summarize-history", "generate-action", "generate-conclusion"],
  })
  .addNode("generate-conclusion", generateConclusion)
  .addNode("request-help", requestHelp, {
    ends: ["generate-action", END],
  })
  .addNode("open-pr", openPullRequest)
  .addNode("diagnose-error", diagnoseError)
  .addNode("summarize-history", summarizeHistory)
  .addEdge(START, "initialize")
  .addEdge("initialize", "generate-action")
  .addConditionalEdges("generate-action", routeGeneratedAction, [
    "take-action",
    "request-help",
    "generate-conclusion",
    "update-plan",
    "generate-action",
  ])
  .addEdge("update-plan", "generate-action")
  .addEdge("generate-conclusion", "open-pr")
  .addEdge("diagnose-error", "generate-action")
  .addEdge("summarize-history", "generate-action")
  .addEdge("open-pr", END);

// Zod types are messed up
export const graph = workflow.compile() as any;
graph.name = "Open SWE - Programmer";
