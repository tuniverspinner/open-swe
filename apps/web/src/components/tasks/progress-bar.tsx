"use client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, Play, List, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { PlanItem, TaskPlan } from "@open-swe/shared/open-swe/types";

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
  const [showLegend, setShowLegend] = useState(false);

  if (!taskPlan || !taskPlan.tasks.length) {
    return (
      <div
        className={cn(
          "w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">No active plan</div>
        </div>
      </div>
    );
  }

  const currentTask = taskPlan.tasks[taskPlan.activeTaskIndex];
  if (!currentTask || !currentTask.planRevisions.length) {
    return (
      <div
        className={cn(
          "w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">No active plan</div>
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

  const currentPlanItem = planItems.find(
    (item) => item.index === currentTaskIndex,
  );

  return (
    <div
      className={cn(
        "w-full rounded-md border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      {/* Compact header */}
      <div className="px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">
              Plan Progress
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => setShowLegend(!showLegend)}
                  >
                    <HelpCircle className="h-3 w-3 text-gray-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-xs p-2 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-medium">Plan Progress</p>
                    <p>
                      Shows the current progress of the AI agent's plan
                      execution.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {Math.round(progressPercentage)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSidebar}
              className="h-6 border-blue-200 px-2 text-xs hover:bg-blue-50"
            >
              <List className="mr-1 h-3 w-3" />
              Tasks
            </Button>
          </div>
        </div>

        {/* Legend - conditionally shown */}
        {showLegend && (
          <div className="mb-2 flex items-center gap-3 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-400"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-gray-200"></div>
              <span>Pending</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-4 p-0 text-xs"
              onClick={() => setShowLegend(false)}
            >
              ×
            </Button>
          </div>
        )}

        {/* Progress Stats */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            {completedCount} of {planItems.length} tasks completed
          </span>
          <span className="text-xs text-gray-500">
            Task #{currentTask.taskIndex + 1}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div
            className="flex h-2 cursor-pointer gap-[1px] overflow-hidden rounded-sm bg-gray-100 transition-all hover:h-2.5"
            onClick={onOpenSidebar}
            aria-label="Click to view all tasks"
            title="Click to view all tasks"
          >
            {planItems.map((item) => {
              const state = getItemState(item);
              const segmentWidth = `${100 / planItems.length}%`;

              return (
                <TooltipProvider key={item.index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "transition-all hover:opacity-80",
                          getSegmentColor(state),
                          state === "current" && "animate-pulse",
                        )}
                        style={{ width: segmentWidth }}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-xs p-2 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            Task #{item.index}
                          </span>
                          <span className="text-xs text-gray-500">
                            {state === "completed"
                              ? "Completed"
                              : state === "current"
                                ? "Current"
                                : "Pending"}
                          </span>
                        </div>
                        <p className="text-xs">{item.plan}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          {/* Current Task Info */}
          {currentPlanItem && (
            <div className="flex items-start gap-2 rounded border border-blue-100 bg-blue-50 px-2 py-1.5">
              <Play className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-blue-700">
                  Currently working on:
                </div>
                <p className="truncate text-xs text-gray-700">
                  {currentPlanItem.plan}
                </p>
              </div>
            </div>
          )}

          {/* All tasks completed */}
          {completedCount === planItems.length && planItems.length > 0 && (
            <div className="flex items-start gap-2 rounded border border-green-100 bg-green-50 px-2 py-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600" />
              <div className="flex-1">
                <div className="text-xs font-medium text-green-700">
                  All tasks completed
                </div>
                <p className="text-xs text-gray-700">
                  The agent has finished all planned tasks.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
