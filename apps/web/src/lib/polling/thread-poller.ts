import { ThreadWithTasks } from "@/providers/Thread";
import { processConcurrently, ConcurrencyConfig, DEFAULT_CONCURRENCY_CONFIG } from "@/lib/concurrency-limiter";

export interface PollConfig {
  interval: number;
  onUpdate: (
    updatedThreads: ThreadWithTasks[],
    changedThreadIds: string[],
  ) => void;
  concurrency?: ConcurrencyConfig;
}

export class ThreadPoller {
  private config: PollConfig;
  private isPolling: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private threads: ThreadWithTasks[];
  private getThreadFn: (threadId: string) => Promise<ThreadWithTasks | null>;
  private concurrencyConfig: ConcurrencyConfig;

  constructor(
    config: PollConfig,
    threads: ThreadWithTasks[],
    getThreadFn: (threadId: string) => Promise<ThreadWithTasks | null>,
  ) {
    this.config = config;
    this.threads = threads;
    this.getThreadFn = getThreadFn;
    this.concurrencyConfig = { ...DEFAULT_CONCURRENCY_CONFIG, ...config.concurrency };
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
      const changedThreadIds: string[] = [];

      // Process threads with concurrency limiting
      const results = await processConcurrently(
        threadsToPool,
        async (currentThread) => {
          const updatedThread = await this.getThreadFn(currentThread.thread_id);
          return { currentThread, updatedThread };
        },
        this.concurrencyConfig
      );

      const updatedThreads: ThreadWithTasks[] = [];

      // Process results and detect changes
      results.forEach((result) => {
        if (result && result.updatedThread) {
          const { currentThread, updatedThread } = result;
          updatedThreads.push(updatedThread);

          if (this.hasThreadChanged(currentThread, updatedThread)) {
            changedThreadIds.push(updatedThread.thread_id);
          }
        } else {
          // On error or null result, keep the current thread  
          if (result && result.currentThread) {
            updatedThreads.push(result.currentThread);
          }
        }
      });

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


