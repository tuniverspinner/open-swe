import { getThreadTitle } from "@/lib/thread";
import { Thread } from "@langchain/langgraph-sdk";
import { getActivePlanItems } from "@open-swe/shared/open-swe/tasks";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import { ThreadDisplayStatus } from "@/lib/schemas/thread-status";

// Thread metadata without status (status comes from useThreadStatus hook)
export interface ThreadMetadata {
  id: string;
  title: string;
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

// Complete thread display info (metadata + status)
export interface ThreadDisplayInfo extends ThreadMetadata {
  status: ThreadDisplayStatus;
}

// Utility function to extract metadata from Thread (no status logic)
export function threadToMetadata(
  thread: Thread<ManagerGraphState>,
): ThreadMetadata {
  const values = thread.values;
  const activePlanItems = values?.taskPlan
    ? getActivePlanItems(values.taskPlan)
    : [];

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
    lastActivity,
    taskCount: values?.taskPlan?.tasks.length ?? 0,
    repository: values?.targetRepository
      ? `${values.targetRepository.owner}/${values.targetRepository.repo}`
      : "",
    branch: values?.targetRepository?.branch || "main",
    githubIssue: values?.githubIssueId
      ? {
          number: values?.githubIssueId,
          url: `https://github.com/${values?.targetRepository?.owner}/${values?.targetRepository?.repo}/issues/${values?.githubIssueId}`,
        }
      : undefined,
  };
}

// Legacy function for backward compatibility (DEPRECATED - use threadToMetadata + useThreadStatus)
export function threadToDisplayInfo(
  thread: Thread<ManagerGraphState>,
): ThreadDisplayInfo {
  const metadata = threadToMetadata(thread);

  // Fallback status logic for backward compatibility
  // This should be replaced with useThreadStatus hook
  let fallbackStatus: ThreadDisplayStatus = "idle";

  if (thread.status === "busy") {
    fallbackStatus = "running";
  } else if (thread.status === "error") {
    fallbackStatus = "error";
  } else if (thread.status === "interrupted") {
    fallbackStatus = "paused";
  }

  return {
    ...metadata,
    status: fallbackStatus,
  };
}
