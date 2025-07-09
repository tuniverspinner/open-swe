import { getThreadTitle } from "@/lib/thread";
import { Thread } from "@langchain/langgraph-sdk";
import { getActivePlanItems } from "@open-swe/shared/open-swe/tasks";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";

export interface ThreadDisplayInfo {
  id: string;
  title: string;
  status:
    | "running"
    | "completed"
    | "failed"
    | "pending"
    | "error"
    | "idle"
    | "paused";
  lastActivity: string;
  taskCount: number;
  repository: string;
  branch: string;
  githubIssue?: {
    number: number;
    url: string;
  };
  pullRequest?: {
    number: number;
    url: string;
    status: "draft" | "open" | "merged" | "closed";
  };
}

// Utility functions to convert between Thread and ThreadDisplayInfo
export function threadToDisplayInfo(
  thread: Thread<ManagerGraphState>,
): ThreadDisplayInfo {
  const values = thread.values;
  const activePlanItems = values?.taskPlan
    ? getActivePlanItems(values.taskPlan)
    : [];
  const completedTasksLen = activePlanItems.filter((t) => t.completed).length;

  // Determine UI status from thread status and task completion
  let uiStatus: ThreadDisplayInfo["status"];
  // Priority 1: Manager is running
  if (thread.status === "busy") {
    uiStatus = "running";
  }
  // Priority 2: Manager has error
  else if (thread.status === "error") {
    uiStatus = "error";
  }
  // Priority 3: No planner session - manager is idle
  else if (!values?.plannerSession) {
    uiStatus = "idle";
  }
  // Priority 4: Planner session exists but we can't determine planner/programmer status synchronously
  // For synchronous operation, we need to make reasonable assumptions based on available data
  else {
    // If manager is interrupted, it likely means planner was interrupted
    if (thread.status === "interrupted") {
      uiStatus = "paused";
    }
    // If manager is idle and we have a planner session, check task completion
    else if (thread.status === "idle") {
      // Check if all tasks are completed
      const allTasksCompleted =
        activePlanItems.length > 0 &&
        completedTasksLen === activePlanItems.length;

      if (allTasksCompleted) {
        uiStatus = "completed";
      } else {
        // If we have tasks but they're not all completed, assume work is ongoing
        // This is a reasonable fallback since we can't check planner/programmer status synchronously
        uiStatus = activePlanItems.length > 0 ? "running" : "idle";
      }
    }
    // Default fallback
    else {
      uiStatus = "idle";
    }
  }

  // Calculate time since last update
  const lastUpdate = new Date(thread.updated_at);
  const now = new Date();
  const diffMs = now.getTime() - lastUpdate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let lastActivity: string;
  if (diffMins < 1) {
    lastActivity = "just now";
  } else if (diffMins < 60) {
    lastActivity = `${diffMins} min ago`;
  } else if (diffHours < 24) {
    lastActivity = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else {
    lastActivity = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  return {
    id: thread.thread_id,
    title: getThreadTitle(thread),
    status: uiStatus,
    lastActivity,
    taskCount: values?.taskPlan?.tasks.length ?? 0,
    repository: values?.targetRepository
      ? `${values.targetRepository.owner}/${values.targetRepository.repo}`
      : "",
    branch: values?.targetRepository.branch || "main",
    githubIssue: values?.githubIssueId
      ? {
          number: values?.githubIssueId,
          url: `https://github.com/${values?.targetRepository.owner}/${values?.targetRepository.repo}/issues/${values?.githubIssueId}`,
        }
      : undefined,
  };
}
