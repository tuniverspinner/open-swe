"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskPlan } from "@open-swe/shared/open-swe/types";
import { getActivePlanItems, getActiveTask } from "@open-swe/shared/open-swe/tasks";

interface TaskPlanProgressProps {
  taskPlan?: TaskPlan;
  className?: string;
}

export function TaskPlanProgress({ taskPlan, className }: TaskPlanProgressProps) {
  const progressData = useMemo(() => {
    if (!taskPlan || !taskPlan.tasks.length) {
      return null;
    }

    const activeTask = getActiveTask(taskPlan);
    const activePlanItems = getActivePlanItems(taskPlan);
    
    const completedCount = activePlanItems.filter(item => item.completed).length;
    const totalCount = activePlanItems.length;
    const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    
    // Find current plan item (lowest index among uncompleted items)
    const currentPlanItemIndex = activePlanItems
      .filter(item => !item.completed)
      .reduce(
        (min, item) => (item.index < min ? item.index : min),
        Number.POSITIVE_INFINITY
      );
    
    const currentPlanItem = activePlanItems.find(item => item.index === currentPlanItemIndex);
    
    return {
      taskTitle: activeTask.title,
      completedCount,
      totalCount,
      progressPercentage,
      currentPlanItem: currentPlanItem?.plan,
      isCompleted: completedCount === totalCount && totalCount > 0
    };
  }, [taskPlan]);

  if (!progressData) {
    return null;
  }

  const { taskTitle, completedCount, totalCount, progressPercentage, currentPlanItem, isCompleted } = progressData;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Task Progress Badge */}
      <Badge 
        variant="secondary" 
        className={cn(
          "text-xs font-medium",
          isCompleted 
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400"
        )}
      >
        <div className="flex items-center gap-1">
          {isCompleted ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          <span>{completedCount}/{totalCount}</span>
        </div>
      </Badge>

      {/* Progress Info */}
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
            {taskTitle}
          </span>
          <span className="text-xs text-muted-foreground">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1.5 w-[120px] bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Current Plan Item */}
        {currentPlanItem && !isCompleted && (
          <div className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {currentPlanItem}
            </span>
          </div>
        )}
        
        {isCompleted && (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
            <span className="text-xs text-green-600 dark:text-green-400">
              Task completed
            </span>
          </div>
        )}
      </div>
    </div>
  );
} 