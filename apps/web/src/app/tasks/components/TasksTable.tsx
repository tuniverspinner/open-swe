"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Pause,
  LoaderCircle,
  Github,
  GitBranch,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskWithContext } from "@/providers/Task";
import { formatTaskTitle } from "@/components/task";

// Status indicator component
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

interface TasksTableProps {
  tasks: TaskWithContext[];
  isLoading: boolean;
}

export default function TasksTable({ tasks, isLoading }: TasksTableProps) {
  const [sortBy, setSortBy] = useState<"date" | "status" | "repository">(
    "date",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const router = useRouter();

  // Handle task click to navigate to conversation
  const handleTaskClick = (task: TaskWithContext) => {
    router.push(`/?taskId=${task.taskId}&chatHistoryOpen=true`);
  };

  // Sort tasks based on current sort settings
  const sortedTasks = [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "date":
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
      case "repository":
        comparison = (a.repository || "").localeCompare(b.repository || "");
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Handle column header click for sorting
  const handleSort = (column: "date" | "status" | "repository") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center text-gray-500">
            <LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" />
            <p className="text-sm">Loading tasks...</p>
          </div>
        </div>
      </div>
    );
  }

  if (sortedTasks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center text-gray-500">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 opacity-50" />
            <p className="text-sm">No tasks found</p>
            <p className="mt-1 text-xs text-gray-400">
              Tasks will appear here when you start conversations
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Table Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Tasks ({sortedTasks.length})
          </h3>
          <div className="text-sm text-gray-500">
            Sorted by {sortBy} ({sortOrder})
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Task
              </th>
              <th
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:text-gray-700"
                onClick={() => handleSort("repository")}
              >
                Repository
              </th>
              <th
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase hover:text-gray-700"
                onClick={() => handleSort("date")}
              >
                Date
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedTasks.map((task) => (
              <tr
                key={task.taskId}
                className="cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => handleTaskClick(task)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={task.status} />
                    <Badge
                      variant={task.status === "done" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {task.status}
                    </Badge>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-md text-sm font-medium text-gray-900">
                    {formatTaskTitle(task.plan, 80)}
                  </div>
                  {task.summary && (
                    <div className="mt-1 max-w-md text-sm text-gray-500">
                      {task.summary.substring(0, 100)}...
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {task.repository}
                    </span>
                    <span className="text-gray-300">/</span>
                    <GitBranch className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{task.branch}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    {task.date}
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTaskClick(task);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
