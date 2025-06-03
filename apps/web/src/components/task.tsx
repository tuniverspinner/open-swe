"use client";
import { CheckCircle2, XCircle, Pause, Loader2 } from "lucide-react";

// Real task data structure from the agent
export interface PlanItem {
  index: number;
  plan: string;
  completed: boolean;
  summary?: string;
}

export type TaskStatus = "running" | "interrupted" | "done" | "error";

export interface TaskWithStatus extends PlanItem {
  status: TaskStatus;
  repository?: string;
  date?: string;
}

// Utility function to determine current task
export const getCurrentTask = (plan: PlanItem[]): PlanItem | null => {
  return plan.filter((p) => !p.completed).sort((a, b) => a.index - b.index)[0] || null;
};

// Utility function to compute task status
export const computeTaskStatus = (
  task: PlanItem,
  currentTask: PlanItem | null,
  isLoading: boolean,
  hasError: boolean,
  hasInterrupt: boolean
): TaskStatus => {
  // If task is completed, it's done
  if (task.completed) {
    return "done";
  }

  // If this is the current task
  const isCurrentTask = currentTask?.index === task.index;
  
  if (isCurrentTask) {
    // Check for error state first
    if (hasError) {
      return "error";
    }
    
    // Check for interrupt state
    if (hasInterrupt) {
      return "interrupted";
    }
    
    // If loading, it's running
    if (isLoading) {
      return "running";
    }
  }

  // Future tasks that aren't running are in a pending state
  // We'll show them as "interrupted" for now (could be a different status)
  return "interrupted";
};

const StatusIndicator = ({ status }: { status: TaskStatus }) => {
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

export const Task = ({ task }: { task: TaskWithStatus }) => {
  return (
    <div className="group flex items-start gap-3 border-b border-gray-100 py-3 last:border-b-0">
      <div className="mt-1 flex-shrink-0">
        <StatusIndicator status={task.status} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-medium text-gray-900">
              {task.plan}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {task.date && <span>{task.date}</span>}
              {task.date && task.repository && <span>·</span>}
              {task.repository && <span>{task.repository}</span>}
              {!task.date && !task.repository && <span>Task {task.index + 1}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
