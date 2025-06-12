import { ThreadWithTasks } from "@/providers/Thread";

export interface PollConfig {
  interval: number;
  onUpdate: (
    updatedThreads: ThreadWithTasks[],
    changedThreadIds: string[],
  ) => void;
}

export class ThreadPoller {
  private config: PollConfig;
  private isPolling: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private threads: ThreadWithTasks[];
  private getThreadFn: (threadId: string) => Promise<ThreadWithTasks | null>;

  constructor(
    config: PollConfig,
    threads: ThreadWithTasks[],
    getThreadFn: (threadId: string) => Promise<ThreadWithTasks | null>,
  ) {
    this.config = config;
    this.threads = threads;
    this.getThreadFn = getThreadFn;
  }

  start(): void {
    if (this.isPolling) return;

    this.isPolling = true;
    this.intervalId = setInterval(() => {
      this.pollThreads();
    }, this.config.interval);
  }

  stop(): void {
    if (!this.isPolling) return;

    this.isPolling = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async pollThreads(): Promise<void> {
    try {
      const currentThreads = this.threads;

      const threadsToPool = currentThreads.slice(0, 10);
      const updatedThreads: ThreadWithTasks[] = [];
      const changedThreadIds: string[] = [];
      const errors: string[] = [];

      // Fetch all thread updates in parallel
      const threadUpdatePromises = threadsToPool.map(async (currentThread) => {
        try {
          const updatedThread = await this.getThreadFn(currentThread.thread_id);
          return { currentThread, updatedThread, error: null };
        } catch (error) {
          return { currentThread, updatedThread: null, error };
        }
      });

      const results = await Promise.all(threadUpdatePromises);

      // Process results
      for (const { currentThread, updatedThread, error } of results) {
        if (error) {
          errors.push(`Thread ${currentThread.thread_id}: ${error}`);
          updatedThreads.push(currentThread);
        } else if (updatedThread) {
          updatedThreads.push(updatedThread);

          if (this.hasThreadChanged(currentThread, updatedThread)) {
            changedThreadIds.push(updatedThread.thread_id);
          }
        }
      }

      if (changedThreadIds.length > 0) {
        this.config.onUpdate(updatedThreads, changedThreadIds);
      }
    } catch (error) {
      console.error("Thread polling error:", error);
    }
  }

  private hasThreadChanged(
    current: ThreadWithTasks,
    updated: ThreadWithTasks,
  ): boolean {
    return (
      current.completedTasksCount !== updated.completedTasksCount ||
      current.totalTasksCount !== updated.totalTasksCount ||
      current.status !== updated.status ||
      current.threadTitle !== updated.threadTitle ||
      current.repository !== updated.repository ||
      current.branch !== updated.branch ||
      JSON.stringify(current.tasks) !== JSON.stringify(updated.tasks) ||
      JSON.stringify(current.proposedPlan) !==
        JSON.stringify(updated.proposedPlan)
    );
  }
}

