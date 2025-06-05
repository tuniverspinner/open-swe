import { getApiKey } from "@/lib/api-key";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import { createClient } from "./client";
import {
  TaskContextType,
  TaskWithContext,
  TaskWithStatus,
} from "@/types/index";
import { inferTaskStatusWithContext } from "@/lib/thread-utils";

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

  // Track active threads for real-time status inference
  const [activeThreads, setActiveThreads] = useState<Set<string>>(new Set());

  // Add debounce to prevent multiple rapid calls
  const lastCallTime = useRef<number>(0);
  const DEBOUNCE_MS = 1000; // Wait 1 second between calls

  // Add polling for real-time updates
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to add thread to active tracking
  const addActiveThread = useCallback((threadId: string) => {
    setActiveThreads((prev) => new Set(prev).add(threadId));
  }, []);

  // Function to remove thread from active tracking
  const removeActiveThread = useCallback((threadId: string) => {
    setActiveThreads((prev) => {
      const newSet = new Set(prev);
      newSet.delete(threadId);
      return newSet;
    });
  }, []);

  const getTasks = useCallback(
    async (threadId: string): Promise<TaskWithStatus[]> => {
      if (!apiUrl || !assistantId || !threadId) return [];
      const client = createClient(apiUrl, getApiKey() ?? undefined);

      try {
        const thread = await client.threads.get(threadId);
        const threadValues = thread.values as any;
        const plan = threadValues?.plan || [];

        // Convert PlanItem[] to TaskWithStatus[] using improved status inference
        return plan.map((planItem: any, index: number) => ({
          ...planItem,
          status: inferTaskStatusWithContext(
            planItem,
            index,
            threadValues,
            threadId,
            activeThreads,
          ),
          repository:
            threadValues?.targetRepository?.repo ||
            threadValues?.targetRepository?.name,
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
    [apiUrl, assistantId, activeThreads],
  );

  const getAllTasks = useCallback(async (): Promise<TaskWithContext[]> => {
    const callId = Math.random().toString(36).substring(7);

    // Add debounce check
    const now = Date.now();
    if (now - lastCallTime.current < DEBOUNCE_MS) {
      console.log(`⏰ [${callId}] Debounced getAllTasks call`);
      return []; // Return empty array for debounced calls instead of stale state
    }
    lastCallTime.current = now;

    console.log(`🚀 [${callId}] Starting getAllTasks...`);

    if (!apiUrl || !assistantId) {
      console.error(`❌ [${callId}] Missing API URL or Assistant ID`);
      return [];
    }

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

            const taskIndex = rawTasks.indexOf(rawTask);

            // Create TaskWithContext using improved status inference
            allTasksWithContext.push({
              ...taskData,
              // Use improved status inference instead of simple completed check
              status: inferTaskStatusWithContext(
                taskData,
                taskIndex,
                threadValues,
                threadSummary.thread_id,
                activeThreads,
              ),
              // Add context information (TaskWithContext specific)
              taskId: createTaskId(threadSummary.thread_id, taskIndex),
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
  }, [apiUrl, assistantId, activeThreads]);

  // Setup polling for real-time updates
  useEffect(() => {
    if (activeThreads.size > 0) {
      // Start polling when there are active threads
      pollIntervalRef.current = setInterval(async () => {
        console.log(
          `🔄 Polling for updates (${activeThreads.size} active threads)`,
        );

        try {
          const newTasks = await getAllTasks();

          // Only update state if data has actually changed to prevent unnecessary re-renders
          setAllTasks((prevTasks) => {
            // Quick comparison - if array lengths differ, update
            if (prevTasks.length !== newTasks.length) {
              return newTasks;
            }

            // Deep comparison of task statuses and IDs to see if anything meaningful changed
            const hasChanges = prevTasks.some((prevTask, index) => {
              const newTask = newTasks[index];
              return (
                !newTask ||
                prevTask.taskId !== newTask.taskId ||
                prevTask.status !== newTask.status ||
                prevTask.completed !== newTask.completed
              );
            });

            // Only update if there are actual changes
            return hasChanges ? newTasks : prevTasks;
          });
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 5000); // Poll every 5 seconds
    } else {
      // Stop polling when no active threads
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeThreads.size]); // Remove getAllTasks from dependencies

  // Initialize data on mount and detect active threads
  useEffect(() => {
    if (!apiUrl || !assistantId) return;

    console.log("🚀 TaskProvider initializing...");
    setTasksLoading(true);

    getAllTasks()
      .then((tasks) => {
        setAllTasks(tasks);

        // Auto-detect threads that should be marked as active
        // (threads with running tasks or recent activity)
        const potentiallyActiveThreads = new Set<string>();
        tasks.forEach((task) => {
          if (task.status === "running" || task.status === "interrupted") {
            potentiallyActiveThreads.add(task.threadId);
          }
        });

        if (potentiallyActiveThreads.size > 0) {
          console.log(
            `🎯 Auto-detected ${potentiallyActiveThreads.size} potentially active threads`,
          );
          setActiveThreads(potentiallyActiveThreads);
        }
      })
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, [apiUrl, assistantId]); // Only run on mount or config change

  const value = {
    getTasks,
    getAllTasks,
    tasks,
    setTasks,
    allTasks,
    setAllTasks,
    tasksLoading,
    setTasksLoading,
    // Expose active thread management
    addActiveThread,
    removeActiveThread,
    activeThreads,
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
