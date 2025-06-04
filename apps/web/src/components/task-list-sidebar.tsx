"use client";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  Pause,
  Github,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTasks, TaskWithContext } from "@/providers/Task";
import { useQueryState, parseAsString } from "nuqs";
import { useEffect, useState } from "react";

const TASKS_PER_PAGE = 10; // More tasks per page in sidebar

// StatusIndicator component for sidebar
const StatusIndicator = ({
  status,
}: {
  status: "running" | "interrupted" | "done" | "error";
}) => {
  switch (status) {
    case "running":
      return <LoaderCircle className="h-3 w-3 animate-spin text-blue-500" />;
    case "interrupted":
      return <Pause className="h-3 w-3 text-yellow-500" />;
    case "done":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-500" />;
    default:
      return null;
  }
};

export default function TaskListSidebar() {
  const [taskId, setTaskId] = useQueryState("taskId", parseAsString);
  const [currentPage, setCurrentPage] = useState(0);
  const { getAllTasks, allTasks, setAllTasks, tasksLoading, setTasksLoading } =
    useTasks();

  // Fetch all tasks for sidebar
  useEffect(() => {
    if (typeof window === "undefined") return;
    setTasksLoading(true);
    getAllTasks()
      .then(setAllTasks)
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, [getAllTasks, setAllTasks, setTasksLoading]);

  // Handle task navigation
  const handleTaskClick = (taskWithContext: TaskWithContext) => {
    setTaskId(taskWithContext.taskId);
  };

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
      const repoKey = `${repo}:::${branch}`;
      if (!acc[repoKey]) acc[repoKey] = [];
      acc[repoKey].push(task);
      return acc;
    },
    {} as Record<string, TaskWithContext[]>,
  );

  return (
    <div className="flex h-full w-full flex-col border-r bg-white">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
        <p className="text-sm text-gray-500">{totalTasks} total tasks</p>
      </div>

      <div className="flex-1 overflow-hidden">
        {tasksLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-500">
              <Archive className="mx-auto mb-2 h-5 w-5 animate-pulse opacity-50" />
              <p className="text-sm">Loading tasks...</p>
            </div>
          </div>
        ) : paginatedTasks.length > 0 ? (
          <div className="h-full space-y-4 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
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
                        className="flex items-center gap-1 text-xs"
                      >
                        <Github className="h-3 w-3 text-gray-500" />
                        <span className="font-medium text-gray-700">
                          {repository}
                        </span>
                        <span className="text-gray-700">/</span>
                        <GitBranch className="h-3 w-3 text-gray-500" />
                        <span className="font-medium text-gray-700">
                          {branch}
                        </span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="ml-auto text-xs"
                      >
                        {repoTasks.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {repoTasks.map((taskWithContext) => (
                        <div
                          key={taskWithContext.taskId}
                          className={`group cursor-pointer rounded-md p-2 text-sm transition-colors hover:bg-gray-50 ${
                            taskWithContext.taskId === taskId
                              ? "border-l-2 border-l-blue-500 bg-blue-50"
                              : ""
                          }`}
                          onClick={() => handleTaskClick(taskWithContext)}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 flex-shrink-0">
                              <StatusIndicator
                                status={taskWithContext.status}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-gray-900">
                                {taskWithContext.plan}
                              </p>
                              <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                                <span>{taskWithContext.date}</span>
                              </div>
                            </div>
                            <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
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
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="text-gray-500">
                    {startIndex + 1}-{Math.min(endIndex, totalTasks)} of{" "}
                    {totalTasks}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="px-2 text-gray-500">
                      {currentPage + 1}/{totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={currentPage === totalPages - 1}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <div className="text-center text-gray-500">
              <Archive className="mx-auto mb-2 h-5 w-5 opacity-50" />
              <p className="text-sm">No tasks yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
