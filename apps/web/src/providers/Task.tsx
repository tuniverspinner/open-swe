import { getApiKey } from "@/lib/api-key";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from "./client";
import { PlanItem } from "@/components/task";

// Enhanced task type with thread context
export interface TaskWithContext extends PlanItem {
  threadId: string;
  threadTitle?: string;
  repository?: string;
  branch?: string;
  date: string;
  createdAt: string; // For chronological sorting
  status: "running" | "interrupted" | "done" | "error";
}

interface TaskContextType {
  getTasks: (threadId: string) => Promise<PlanItem[]>;
  getAllTasks: () => Promise<TaskWithContext[]>;
  tasks: PlanItem[];
  setTasks: Dispatch<SetStateAction<PlanItem[]>>;
  allTasks: TaskWithContext[];
  setAllTasks: Dispatch<SetStateAction<TaskWithContext[]>>;
  tasksLoading: boolean;
  setTasksLoading: Dispatch<SetStateAction<boolean>>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL ?? "";
  const assistantId: string | undefined =
    process.env.NEXT_PUBLIC_ASSISTANT_ID ?? "";

  const [tasks, setTasks] = useState<PlanItem[]>([]);
  const [allTasks, setAllTasks] = useState<TaskWithContext[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const getTasks = useCallback(
    async (threadId: string): Promise<PlanItem[]> => {
      if (!apiUrl || !assistantId || !threadId) return [];
      const client = createClient(apiUrl, getApiKey() ?? undefined);

      try {
        const thread = await client.threads.get(threadId);
        return (thread.values as any)?.plan || [];
      } catch (error) {
        console.error("Failed to fetch tasks for thread:", threadId, error);
        return [];
      }
    },
    [apiUrl, assistantId],
  );

  const getAllTasks = useCallback(async (): Promise<TaskWithContext[]> => {
    if (!apiUrl || !assistantId) return [];
    const client = createClient(apiUrl, getApiKey() ?? undefined);

    try {
      // Search for all threads
      const threadsResponse = await client.threads.search({
        limit: 50, // Adjust as needed
        metadata: assistantId.includes("-")
          ? { graph_id: assistantId }
          : { assistant_id: assistantId },
      });

      const allTasksWithContext: TaskWithContext[] = [];

      // Process each thread to extract tasks
      for (const threadSummary of threadsResponse) {
        try {
          const thread = await client.threads.get(threadSummary.thread_id);
          const threadValues = thread.values as any;
          const plan: PlanItem[] = threadValues?.plan || [];
          const targetRepository = threadValues?.targetRepository;

          // Extract thread title from first human message or fallback
          const messages = (threadValues as any)?.messages;
          const threadTitle =
            messages?.[0]?.content?.[0]?.text?.substring(0, 50) + "..." ||
            `Thread ${threadSummary.thread_id.substring(0, 8)}`;

          // Convert each task to TaskWithContext
          plan.forEach((planItem) => {
            allTasksWithContext.push({
              ...planItem,
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
              status: planItem.completed ? "done" : "interrupted", // Completed tasks are done, others are paused/interrupted
            });
          });
        } catch (error) {
          console.error(
            `Failed to fetch thread ${threadSummary.thread_id}:`,
            error,
          );
        }
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
