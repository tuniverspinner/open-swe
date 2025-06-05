import { getApiKey } from "@/lib/api-key";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  useRef,
} from "react";
import { createClient } from "./client";
import {
  TaskContextType,
  TaskWithContext,
  TaskWithStatus,
} from "@/types/index";

// Function to create simple, predictable task ID
function createTaskId(threadId: string, taskIndex: number): string {
  return `${threadId}-${taskIndex}`;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL ?? "";
  const assistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID ?? "";

  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [allTasks, setAllTasks] = useState<TaskWithContext[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Add debounce to prevent multiple rapid calls
  const lastCallTime = useRef<number>(0);
  const DEBOUNCE_MS = 1000; // Wait 1 second between calls

  const getTasks = useCallback(
    async (threadId: string): Promise<TaskWithStatus[]> => {
      if (!apiUrl || !assistantId || !threadId) return [];
      const client = createClient(apiUrl, getApiKey() ?? undefined);

      try {
        const thread = await client.threads.get(threadId);
        const plan = (thread.values as any)?.plan || [];

        // Convert PlanItem[] to TaskWithStatus[] by adding status information
        return plan.map((planItem: any) => ({
          ...planItem,
          status: planItem.completed ? "done" : "interrupted",
          repository:
            (thread.values as any)?.targetRepository?.repo ||
            (thread.values as any)?.targetRepository?.name,
          date: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        }));
      } catch (error) {
        console.error("Failed to fetch tasks for thread:", threadId, error);
        return [];
      }
    },
    [apiUrl, assistantId],
  );

  const getAllTasks = useCallback(async (): Promise<TaskWithContext[]> => {
    const callId = Math.random().toString(36).substring(7);
    const now = Date.now();

    // Debounce rapid calls
    if (now - lastCallTime.current < DEBOUNCE_MS) {
      console.log(
        `⏸️ [${callId}] Debounced call (${now - lastCallTime.current}ms since last)`,
      );
      return allTasks; // Return cached results
    }
    lastCallTime.current = now;

    console.log(
      `🔄 [${callId}] getAllTasks() called at ${new Date().toISOString()}`,
    );

    if (!apiUrl || !assistantId) {
      console.warn(`❌ [${callId}] Missing apiUrl or assistantId:`, {
        apiUrl: !!apiUrl,
        assistantId: !!assistantId,
      });
      return [];
    }

    console.log(`🔧 [${callId}] Config:`, {
      apiUrl,
      assistantId,
      hasApiKey: !!getApiKey(),
      apiKeyPrefix: getApiKey()?.substring(0, 10) + "...",
    });

    const client = createClient(apiUrl, getApiKey() ?? undefined);

    try {
      // Search for all threads
      const searchParams = {
        limit: 200, // Increased from 50 to handle more threads
        metadata: assistantId.includes("-")
          ? { graph_id: assistantId }
          : { assistant_id: assistantId },
      };

      console.log(
        `🔍 [${callId}] Searching threads with params:`,
        JSON.stringify(searchParams, null, 2),
      );

      let threadsResponse: any[] = [];
      let alternativeResponse: any[] = [];
      let noMetadataResponse: any[] = [];

      try {
        threadsResponse = await client.threads.search(searchParams);
        console.log(
          `📋 [${callId}] Found ${threadsResponse.length} threads from search`,
        );
      } catch (error) {
        console.error(`❌ [${callId}] Primary search failed:`, error);
        threadsResponse = [];
      }

      // Let's also try both search criteria to see if there's a mismatch
      const alternativeSearchParams = {
        limit: 200,
        metadata: assistantId.includes("-")
          ? { assistant_id: assistantId } // Try the opposite
          : { graph_id: assistantId },
      };

      console.log(
        `🔍 [${callId}] Also trying alternative search:`,
        JSON.stringify(alternativeSearchParams, null, 2),
      );

      try {
        alternativeResponse = await client.threads.search(
          alternativeSearchParams,
        );
        console.log(
          `📋 [${callId}] Alternative search found ${alternativeResponse.length} threads`,
        );
      } catch (error) {
        console.error(`❌ [${callId}] Alternative search failed:`, error);
        alternativeResponse = [];
      }

      // Let's also try searching without metadata to see if there are ANY threads
      console.log(
        `🔍 [${callId}] Trying search without metadata (showing any threads)...`,
      );

      try {
        noMetadataResponse = await client.threads.search({ limit: 10 });
        console.log(
          `📋 [${callId}] No-metadata search found ${noMetadataResponse.length} threads`,
        );
        if (noMetadataResponse.length > 0) {
          console.log(
            `📝 [${callId}] Sample threads found:`,
            noMetadataResponse.slice(0, 3).map((t) => ({
              id: t.thread_id,
              metadata: t.metadata,
              created_at: t.created_at,
            })),
          );
        }
      } catch (error) {
        console.error(`❌ [${callId}] No-metadata search failed:`, error);
        noMetadataResponse = [];
      }

      // Use whichever search returned more results
      const bestResponse =
        threadsResponse.length >= alternativeResponse.length
          ? threadsResponse
          : alternativeResponse;
      console.log(
        `✅ [${callId}] Using search that returned ${bestResponse.length} threads`,
      );

      const allTasksWithContext: TaskWithContext[] = [];
      const failedThreads: string[] = [];
      const threadsWithNoTasks: string[] = [];

      // Process each thread to extract tasks
      for (const threadSummary of bestResponse) {
        try {
          const thread = await client.threads.get(threadSummary.thread_id);
          const threadValues = thread.values as any;

          // Check both plan and proposedPlan fields
          const plan: any[] = threadValues?.plan || [];
          const proposedPlan: any[] = threadValues?.proposedPlan || [];

          // Use proposedPlan if plan is empty, otherwise use plan
          const rawTasks = plan.length > 0 ? plan : proposedPlan;

          // Skip threads with no tasks
          if (rawTasks.length === 0) {
            threadsWithNoTasks.push(threadSummary.thread_id);
            continue;
          }

          const targetRepository = threadValues?.targetRepository;

          // Extract thread title from first human message or fallback
          const messages = (threadValues as any)?.messages;
          const threadTitle =
            messages?.[0]?.content?.[0]?.text?.substring(0, 50) + "..." ||
            `Thread ${threadSummary.thread_id.substring(0, 8)}`;

          // Convert each raw task to TaskWithContext (which extends TaskWithStatus)
          rawTasks.forEach((rawTask) => {
            // Handle both string tasks and PlanItem objects
            const taskDescription =
              typeof rawTask === "string"
                ? rawTask
                : rawTask.plan || "No description";

            const taskData =
              typeof rawTask === "string"
                ? {
                    index: rawTasks.indexOf(rawTask),
                    plan: rawTask,
                    completed: false,
                    summary: undefined,
                  }
                : rawTask;

            // Create TaskWithContext which includes status from TaskWithStatus
            allTasksWithContext.push({
              ...taskData,
              // Add status information (from TaskWithStatus)
              status: taskData.completed ? "done" : "interrupted",
              // Add context information (TaskWithContext specific)
              taskId: createTaskId(
                threadSummary.thread_id,
                rawTasks.indexOf(rawTask),
              ),
              threadId: threadSummary.thread_id,
              threadTitle,
              repository:
                targetRepository?.repo ||
                targetRepository?.name ||
                "Unknown Repository",
              branch: targetRepository?.branch || "main",
              date: new Date(threadSummary.created_at).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                },
              ),
              createdAt: threadSummary.created_at,
            });
          });
        } catch (error) {
          console.error(
            `Failed to fetch thread ${threadSummary.thread_id}:`,
            error,
          );
          failedThreads.push(threadSummary.thread_id);
        }
      }

      // Log summary of results for debugging
      console.log(
        `✅ [${callId}] Successfully loaded ${allTasksWithContext.length} tasks from ${bestResponse.length - failedThreads.length} threads`,
      );
      if (failedThreads.length > 0) {
        console.warn(
          `⚠️ [${callId}] Failed to load ${failedThreads.length} threads:`,
          failedThreads,
        );
      }
      if (threadsWithNoTasks.length > 0) {
        console.log(
          `📝 [${callId}] Found ${threadsWithNoTasks.length} threads with no tasks:`,
          threadsWithNoTasks,
        );
      }

      // Sort by repository, then by creation date (newest first)
      return allTasksWithContext.sort((a, b) => {
        const repoCompare = a.repository!.localeCompare(b.repository!);
        if (repoCompare !== 0) return repoCompare;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    } catch (error) {
      console.error("Failed to fetch all tasks:", error);
      return [];
    }
  }, [apiUrl, assistantId]);

  const value = {
    getTasks,
    getAllTasks,
    tasks,
    setTasks,
    allTasks,
    setAllTasks,
    tasksLoading,
    setTasksLoading,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error("useTasks must be used within a TaskProvider");
  }
  return context;
}
