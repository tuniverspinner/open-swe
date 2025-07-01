import { Thread } from "@langchain/langgraph-sdk";
import { getMessageContentString } from "@open-swe/shared/messages";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { getActivePlanItems, getActiveTask } from "@open-swe/shared/open-swe/tasks";

export function getThreadTitle<State extends Record<string, any> = GraphState>(
  thread: Thread<State>,
): string {
  // First, try to get the title from the active task in the task plan
  if (thread?.values?.taskPlan?.tasks?.length) {
    try {
      const activeTask = getActiveTask(thread.values.taskPlan);
      if (activeTask?.title?.trim()) {
        return activeTask.title;
      }
    } catch (error) {
      // Fall back to message-based title if there's an error getting the active task
    }
  }

  // Fall back to the original logic: extract from first message
  const messages = thread?.values?.messages;
  if (!messages?.length || !messages[0]?.content) {
    return `Thread ${thread.thread_id.substring(0, 8)}`;
  }
  const threadTitle = getMessageContentString(messages[0].content);
  return threadTitle;
}

export function getThreadTasks<State extends Record<string, any> = GraphState>(
  thread: Thread<State>,
): {
  totalTasks: number;
  completedTasks: number;
} {
  if (!thread.values || !thread.values?.taskPlan) {
    return {
      totalTasks: 0,
      completedTasks: 0,
    };
  }
  const activePlanItems = getActivePlanItems(thread.values.taskPlan);
  const totalTasks = activePlanItems.length;
  const completedTasks = activePlanItems.filter((p) => p.completed).length;
  return {
    totalTasks,
    completedTasks,
  };
}
