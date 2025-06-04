"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  Pause,
  CheckCircle2,
  XCircle,
  Github,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStreamContext } from "@/providers/Stream";
import { useTasks, TaskWithContext } from "@/providers/Task";
import { useQueryState, parseAsInteger } from "nuqs";
import { useEffect, useState } from "react";
import {
  Task,
  type TaskWithStatus,
  type PlanItem,
  getCurrentTask,
  computeTaskStatus,
} from "./task";

const TASKS_PER_PAGE = 5;

// Import StatusIndicator component to use in dashboard
const StatusIndicator = ({
  status,
}: {
  status: "running" | "interrupted" | "done" | "error";
}) => {
  switch (status) {
    case "running":
      return <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" />;
    case "interrupted":
      return <Pause className="h-4 w-4 text-yellow-500" />;
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
};

export default function TaskList() {
  const stream = useStreamContext();
  const [threadId, setThreadId] = useQueryState("threadId");
  const [taskId, setTaskId] = useQueryState("taskId", parseAsInteger);
  const [currentPage, setCurrentPage] = useState(0);
  const {
    getTasks,
    getAllTasks,
    tasks,
    setTasks,
    allTasks,
    setAllTasks,
    tasksLoading,
    setTasksLoading,
  } = useTasks();

  // Determine if we're in dashboard mode (no threadId) or thread-specific mode
  const isDashboardMode = !threadId;

  // Fetch tasks based on mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    setTasksLoading(true);

    if (isDashboardMode) {
      // Dashboard mode: fetch all tasks
      getAllTasks()
        .then(setAllTasks)
        .catch(console.error)
        .finally(() => setTasksLoading(false));
    } else {
      // Thread mode: fetch specific thread tasks
      getTasks(threadId!)
        .then(setTasks)
        .catch(console.error)
        .finally(() => setTasksLoading(false));
    }
  }, [
    threadId,
    isDashboardMode,
    getTasks,
    getAllTasks,
    setTasks,
    setAllTasks,
    setTasksLoading,
  ]);

  // Sync tasks when stream receives new plan data (real-time updates)
  useEffect(() => {
    const streamPlan = (stream.values as any)?.plan;
    if (
      streamPlan &&
      Array.isArray(streamPlan) &&
      streamPlan.length > 0 &&
      !isDashboardMode
    ) {
      setTasks(streamPlan);
    }
  }, [stream.values, setTasks, isDashboardMode]);

  // Handle task navigation
  const handleTaskClick = (taskWithContext: TaskWithContext) => {
    setThreadId(taskWithContext.threadId);
    setTaskId(taskWithContext.index);
  };

  if (isDashboardMode) {
    // Dashboard Mode: Show all tasks with pagination
    const totalTasks = allTasks.length;
    const totalPages = Math.ceil(totalTasks / TASKS_PER_PAGE);
    const startIndex = currentPage * TASKS_PER_PAGE;
    const endIndex = startIndex + TASKS_PER_PAGE;
    const paginatedTasks = allTasks.slice(startIndex, endIndex);

    // Group tasks by repository
    const tasksByRepository = paginatedTasks.reduce(
      (acc, task) => {
        const repo = task.repository || "Unknown Repository";
        const branch = task.branch || "main";
        const repoKey = `${repo}:::${branch}`; // Use separator to distinguish repo+branch combinations
        if (!acc[repoKey]) acc[repoKey] = [];
        acc[repoKey].push(task);
        return acc;
      },
      {} as Record<string, TaskWithContext[]>,
    );

    return (
      <div className="flex h-full w-full flex-col">
        <div className="mx-auto w-full max-w-3xl p-4">
          <Tabs
            defaultValue="tasks"
            className="flex h-full flex-col"
          >
            <TabsList className="mb-4 grid h-auto w-fit grid-cols-2 bg-transparent p-0">
              <TabsTrigger
                value="tasks"
                className="px-0 font-medium data-[state=active]:rounded-none data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                All Tasks ({totalTasks})
              </TabsTrigger>
              <TabsTrigger
                value="archive"
                disabled
                className="ml-6 px-0 pb-3 font-medium text-gray-500 data-[state=active]:rounded-none data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Plan{" "}
                <Badge
                  variant="outline"
                  className="text-xs"
                >
                  Coming Soon
                </Badge>
              </TabsTrigger>
            </TabsList>

            <div className="mb-4 border-b border-gray-200"></div>

            <TabsContent
              value="tasks"
              className="mt-0 flex-1 overflow-hidden"
            >
              {tasksLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-gray-500">
                    <Archive className="mx-auto mb-2 h-6 w-6 animate-pulse opacity-50" />
                    <p className="text-sm">Loading tasks...</p>
                  </div>
                </div>
              ) : paginatedTasks.length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(tasksByRepository).map(
                    ([repoKey, repoTasks]: [string, TaskWithContext[]]) => {
                      const [repository, branch] = repoKey.split(":::");
                      return (
                        <div
                          key={repoKey}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <Github className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                {repository}
                              </span>
                              <span className="text-sm font-medium text-gray-700">
                                /
                              </span>
                              <GitBranch className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                {branch}
                              </span>
                            </Badge>
                            <Badge
                              variant="outline"
                              className="ml-auto text-xs"
                            >
                              {repoTasks.length} tasks
                            </Badge>
                          </div>
                          <div className="space-y-0">
                            {repoTasks.map((taskWithContext) => (
                              <div
                                key={`${taskWithContext.threadId}-${taskWithContext.index}`}
                                className="group cursor-pointer rounded-lg p-2 transition-colors hover:bg-gray-50"
                                onClick={() => handleTaskClick(taskWithContext)}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-1 flex-shrink-0">
                                    <StatusIndicator
                                      status={taskWithContext.status}
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className="truncate text-sm font-medium text-gray-900">
                                      {taskWithContext.plan}
                                    </h4>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                                      <span>{taskWithContext.date}</span>
                                    </div>
                                  </div>
                                  <ExternalLink className="h-4 w-4 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    },
                  )}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                      <div className="text-sm text-gray-500">
                        Showing {startIndex + 1}-
                        {Math.min(endIndex, totalTasks)} of {totalTasks} tasks
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(0, p - 1))
                          }
                          disabled={currentPage === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm text-gray-500">
                          Page {currentPage + 1} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(totalPages - 1, p + 1),
                            )
                          }
                          disabled={currentPage === totalPages - 1}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-gray-500">
                    <Archive className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    <p className="text-sm">No tasks yet</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Tasks will appear here when you start conversations
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Thread Mode: Show tasks for specific thread (existing logic)
  const plan: PlanItem[] =
    tasks.length > 0 ? tasks : (stream.values as any)?.plan || [];
  const isLoading = stream.isLoading;
  const hasError = !!stream.error;
  const hasInterrupt = !!stream.interrupt;

  const currentTask = getCurrentTask(plan);

  const tasksWithStatus: TaskWithStatus[] = plan.map((planItem) => ({
    ...planItem,
    status: computeTaskStatus(
      planItem,
      currentTask,
      isLoading,
      hasError,
      hasInterrupt,
    ),
    repository:
      (stream.values as any)?.targetRepository?.repo ||
      stream.values?.targetRepository?.repo,
    date: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto w-full max-w-3xl p-4">
        <Tabs
          defaultValue="tasks"
          className="flex h-full flex-col"
        >
          <TabsList className="mb-4 grid h-auto w-fit grid-cols-2 bg-transparent p-0">
            <TabsTrigger
              value="tasks"
              className="px-0 font-medium data-[state=active]:rounded-none data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Tasks ({tasksWithStatus.length})
            </TabsTrigger>
            <TabsTrigger
              value="archive"
              disabled
              className="ml-6 px-0 pb-3 font-medium text-gray-500 data-[state=active]:rounded-none data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Plan{" "}
              <Badge
                variant="outline"
                className="text-xs"
              >
                Coming Soon
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="mb-4 border-b border-gray-200"></div>

          <TabsContent
            value="tasks"
            className="mt-0 flex-1 overflow-hidden"
          >
            {tasksLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-gray-500">
                  <Archive className="mx-auto mb-2 h-6 w-6 animate-pulse opacity-50" />
                  <p className="text-sm">Loading tasks...</p>
                </div>
              </div>
            ) : tasksWithStatus.length > 0 ? (
              <div className="h-full space-y-0 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
                {tasksWithStatus.map((task) => (
                  <div
                    key={task.index}
                    className={
                      task.index === taskId
                        ? "border-l-4 border-l-blue-500 bg-blue-50"
                        : ""
                    }
                  >
                    <Task task={task} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-gray-500">
                  <Archive className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  <p className="text-sm">No tasks yet</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Tasks will appear here when you start a conversation
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
