"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { List } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanItem, TaskPlan } from "@open-swe/shared/open-swe/types";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface ProgressBarProps {
  taskPlan?: TaskPlan;
  className?: string;
  onOpenSidebar?: () => void;
}

export function ProgressBar({
  taskPlan,
  className,
  onOpenSidebar,
}: ProgressBarProps) {

  if (!taskPlan || !taskPlan.tasks.length) {
    return (
      <div
        className={cn(
          "mt-2 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 sm:mt-4 dark:border-gray-700 dark:bg-gray-800",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            No active plan
          </div>
        </div>
      </div>
    );
  }

  const currentTask = taskPlan.tasks[taskPlan.activeTaskIndex];
  if (!currentTask || !currentTask.planRevisions.length) {
    return (
      <div
        className={cn(
          "mt-2 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 sm:mt-4 dark:border-gray-700 dark:bg-gray-800",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            No active plan
          </div>
        </div>
      </div>
    );
  }

  const activeRevision =
    currentTask.planRevisions[currentTask.activeRevisionIndex];
  const planItems = [...activeRevision.plans].sort((a, b) => a.index - b.index);

  // Find the current task (lowest index among uncompleted tasks)
  const currentTaskIndex = planItems
    .filter((item) => !item.completed)
    .reduce(
      (min, item) => (item.index < min ? item.index : min),
      Number.POSITIVE_INFINITY,
    );

  const getItemState = (
    item: PlanItem,
  ): "completed" | "current" | "remaining" => {
    if (item.completed) return "completed";
    if (item.index === currentTaskIndex) return "current";
    return "remaining";
  };

  const completedCount = planItems.filter((item) => item.completed).length;
  const progressPercentage =
    planItems.length > 0 ? (completedCount / planItems.length) * 100 : 0;

  const getSegmentColor = (state: string) => {
    switch (state) {
      case "completed":
        return "bg-green-400";
      case "current":
        return "bg-blue-400";
      default:
        return "bg-gray-200";
    }
  };

  return (
    <div
      className={cn(
        "w-96 rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900",
        className,
      )}
    >
      {/* Compact header - 2 rows instead of 3 */}
      <div className="overflow-hidden px-2 py-1">
        {/* Row 1: Title, progress stats, and Tasks button */}
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
              Plan Progress
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {completedCount} of {planItems.length} completed
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSidebar}
            className="h-6 border-blue-200 text-xs hover:bg-blue-50"
          >
            <List className="size-3" />
            <span className="hidden sm:inline">Tasks</span>
            <span className="sm:hidden">View</span>
          </Button>
        </div>

        {/* Row 2: Progress Bar */}
        <div>
          <div
            className="flex h-4 cursor-pointer touch-manipulation gap-[1px] overflow-hidden rounded-sm bg-gray-100 transition-all dark:bg-gray-700"
            onClick={onOpenSidebar}
            aria-label="Click to view all tasks"
            title="Click to view all tasks"
          >
            {planItems.map((item) => {
              const state = getItemState(item);
              const segmentWidth = `${100 / planItems.length}%`;

              return (
                <HoverCard key={item.index}>
                  <HoverCardTrigger asChild>
                    <div
                      className={cn(
                        "transition-all hover:opacity-80",
                        getSegmentColor(state),
                        state === "current" && "animate-pulse",
                      )}
                      style={{ width: segmentWidth }}
                    />
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="bottom"
                    className="min-w-xs p-2 text-xs sm:max-w-sm md:max-w-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1">
                        <span className="font-medium">
                          Task #{item.index + 1}
                        </span>
                        <span className="text-xs text-gray-500">
                          {state === "completed"
                            ? "Completed"
                            : state === "current"
                              ? "Current"
                              : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs break-words">{item.plan}</p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
