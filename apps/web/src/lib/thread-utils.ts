import { ThreadSummary, TaskWithContext } from "@/types/index";

/**
 * Determines the overall status of a thread based on its constituent tasks
 * Priority: error > running > done > interrupted
 */
export function determineThreadStatus(
  tasks: TaskWithContext[],
): "running" | "interrupted" | "done" | "error" {
  const hasRunning = tasks.some((t) => t.status === "running");
  const hasError = tasks.some((t) => t.status === "error");
  const allDone = tasks.every((t) => t.status === "done");

  if (hasError) {
    return "error";
  } else if (hasRunning) {
    return "running";
  } else if (allDone) {
    return "done";
  } else {
    return "interrupted";
  }
}

/**
 * Groups an array of tasks into ThreadSummary objects
 * Each thread contains aggregated information about its tasks
 */
export function groupTasksIntoThreads(
  allTasks: TaskWithContext[],
): ThreadSummary[] {
  const threadSummaries: ThreadSummary[] = allTasks.reduce((acc, task) => {
    const existingThread = acc.find((t) => t.threadId === task.threadId);

    if (existingThread) {
      existingThread.tasks.push(task);
      existingThread.totalTasksCount += 1;
      if (task.status === "done") {
        existingThread.completedTasksCount += 1;
      }
    } else {
      acc.push({
        threadId: task.threadId,
        threadTitle:
          task.threadTitle || `Thread ${task.threadId.substring(0, 8)}`,
        repository: task.repository || "Unknown Repository",
        branch: task.branch || "main",
        date:
          task.date ||
          new Date(task.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        createdAt: task.createdAt,
        tasks: [task],
        completedTasksCount: task.status === "done" ? 1 : 0,
        totalTasksCount: 1,
        status: task.status, // Will be overridden below
      });
    }

    return acc;
  }, [] as ThreadSummary[]);

  // Determine overall thread status for each thread
  threadSummaries.forEach((thread) => {
    thread.status = determineThreadStatus(thread.tasks);
  });

  return threadSummaries;
}

/**
 * Sorts threads by creation date (newest first)
 */
export function sortThreadsByDate(threads: ThreadSummary[]): ThreadSummary[] {
  return threads.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
