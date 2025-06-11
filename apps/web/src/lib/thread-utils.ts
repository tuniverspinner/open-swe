import { ThreadWithTasks } from "@/providers/Thread";

/**
 * Determines if a thread is currently busy (has incomplete tasks)
 */
export const isThreadBusy = (thread: ThreadWithTasks): boolean => {
  // Check if thread has active tasks that aren't completed
  if (thread.tasks) {
    const activeTask = thread.tasks.tasks.find(
      (t) => t.taskIndex === thread.tasks!.activeTaskIndex,
    );

    if (activeTask) {
      const activeRevision = activeTask.planRevisions.find(
        (p) => p.revisionIndex === activeTask.activeRevisionIndex,
      );

      if (activeRevision) {
        // Thread is busy if it has incomplete plans
        return activeRevision.plans.some((p) => !p.completed);
      }
    }
  }

  // If we have proposed plans but no tasks yet, it might be busy
  if (thread.proposedPlan && thread.proposedPlan.length > 0 && !thread.tasks) {
    return true;
  }

  return false;
};


/**
 * Compares two threads and returns an updated thread with only changed properties
 */
export const updateThreadSelectively = (
  currentThread: ThreadWithTasks,
  updatedThread: ThreadWithTasks,
): ThreadWithTasks => {
  const changes: Partial<ThreadWithTasks> = {};

  // Compare key properties that might change
  if (currentThread.completedTasksCount !== updatedThread.completedTasksCount) {
    changes.completedTasksCount = updatedThread.completedTasksCount;
  }

  if (currentThread.totalTasksCount !== updatedThread.totalTasksCount) {
    changes.totalTasksCount = updatedThread.totalTasksCount;
  }

  if (
    JSON.stringify(currentThread.tasks) !== JSON.stringify(updatedThread.tasks)
  ) {
    changes.tasks = updatedThread.tasks;
  }

  if (
    JSON.stringify(currentThread.proposedPlan) !==
    JSON.stringify(updatedThread.proposedPlan)
  ) {
    changes.proposedPlan = updatedThread.proposedPlan;
  }

  // Also check thread status - this might be important for interrupted threads
  if (currentThread.status !== updatedThread.status) {
    changes.status = updatedThread.status;
  }

  // Check thread title changes
  if (currentThread.threadTitle !== updatedThread.threadTitle) {
    changes.threadTitle = updatedThread.threadTitle;
  }

  // Check repository changes
  if (currentThread.repository !== updatedThread.repository) {
    changes.repository = updatedThread.repository;
  }

  // Check branch changes
  if (currentThread.branch !== updatedThread.branch) {
    changes.branch = updatedThread.branch;
  }

  // Log what changes are being made
  const changeCount = Object.keys(changes).length;
  if (changeCount > 0) {
    console.log(`🔄 Updating thread ${currentThread.thread_id.slice(-8)} with ${changeCount} changes:`, {
      changedFields: Object.keys(changes),
      currentStatus: currentThread.status,
      newStatus: updatedThread.status,
      currentTitle: currentThread.threadTitle?.slice(0, 30),
      newTitle: updatedThread.threadTitle?.slice(0, 30)
    });
    return { ...currentThread, ...changes };
  }

  return currentThread;
};