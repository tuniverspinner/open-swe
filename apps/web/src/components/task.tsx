"use client";
import { CheckCircle2, XCircle, Pause, Loader2 } from "lucide-react";

export interface Task {
  id: string;
  title: string;
  status: "running" | "interrupted" | "done" | "error";
  date: string;
  repository: string;
  additions?: number;
  deletions?: number;
}

const StatusIndicator = ({ status }: { status: Task["status"] }) => {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
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

export const Task = ({ task }: { task: Task }) => {
  return (
    <div className="group flex items-start gap-3 border-b border-gray-100 py-3 last:border-b-0">
      <div className="mt-1 flex-shrink-0">
        <StatusIndicator status={task.status} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-medium text-gray-900">
              {task.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{task.date}</span>
              <span>·</span>
              <span>{task.repository}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
