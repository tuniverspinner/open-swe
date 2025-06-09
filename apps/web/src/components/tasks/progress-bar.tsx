"use client"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle2, Play, List, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { PlanItem, TaskPlan } from "@open-swe/shared/open-swe/types"

interface ProgressBarProps {
  taskPlan?: TaskPlan
  className?: string
  onOpenSidebar?: () => void
}

export function ProgressBar({ taskPlan, className, onOpenSidebar }: ProgressBarProps) {
  const [showLegend, setShowLegend] = useState(false)

  if (!taskPlan || !taskPlan.tasks.length) {
    return (
      <div className={cn("w-full border border-gray-200 rounded-md bg-gray-50 px-3 py-2", className)}>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">No active plan</div>
        </div>
      </div>
    )
  }

  const currentTask = taskPlan.tasks[taskPlan.activeTaskIndex]
  if (!currentTask || !currentTask.planRevisions.length) {
    return (
      <div className={cn("w-full border border-gray-200 rounded-md bg-gray-50 px-3 py-2", className)}>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">No active plan</div>
        </div>
      </div>
    )
  }

  const activeRevision = currentTask.planRevisions[currentTask.activeRevisionIndex]
  const planItems = [...activeRevision.plans].sort((a, b) => a.index - b.index)

  // Find the current task (lowest index among uncompleted tasks)
  const currentTaskIndex = planItems
    .filter((item) => !item.completed)
    .reduce((min, item) => (item.index < min ? item.index : min), Number.POSITIVE_INFINITY)

  const getItemState = (item: PlanItem): "completed" | "current" | "remaining" => {
    if (item.completed) return "completed"
    if (item.index === currentTaskIndex) return "current"
    return "remaining"
  }

  const completedCount = planItems.filter((item) => item.completed).length
  const progressPercentage = planItems.length > 0 ? (completedCount / planItems.length) * 100 : 0

  const getSegmentColor = (state: string) => {
    switch (state) {
      case "completed":
        return "bg-green-400"
      case "current":
        return "bg-blue-400"
      default:
        return "bg-gray-200"
    }
  }

  const currentPlanItem = planItems.find((item) => item.index === currentTaskIndex)

  return (
    <div className={cn("w-full border border-gray-200 rounded-md bg-white shadow-sm", className)}>
      {/* Compact header */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">Plan Progress</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => setShowLegend(!showLegend)}>
                    <HelpCircle className="h-3 w-3 text-gray-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs p-2 text-xs">
                  <div className="space-y-1">
                    <p className="font-medium">Plan Progress</p>
                    <p>Shows the current progress of the AI agent's plan execution.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{Math.round(progressPercentage)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSidebar}
              className="h-6 px-2 text-xs hover:bg-blue-50 border-blue-200"
            >
              <List className="h-3 w-3 mr-1" />
              Tasks
            </Button>
          </div>
        </div>

        {/* Legend - conditionally shown */}
        {showLegend && (
          <div className="flex items-center gap-3 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs mb-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-200"></div>
              <span>Pending</span>
            </div>
            <Button variant="ghost" size="sm" className="h-4 ml-auto p-0 text-xs" onClick={() => setShowLegend(false)}>
              ×
            </Button>
          </div>
        )}

        {/* Progress Stats */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-600">
            {completedCount} of {planItems.length} tasks completed
          </span>
          <span className="text-xs text-gray-500">Task #{currentTask.taskIndex}</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div
            className="flex gap-[1px] h-2 rounded-sm overflow-hidden bg-gray-100 cursor-pointer hover:h-2.5 transition-all"
            onClick={onOpenSidebar}
            aria-label="Click to view all tasks"
            title="Click to view all tasks"
          >
            {planItems.map((item) => {
              const state = getItemState(item)
              const segmentWidth = `${100 / planItems.length}%`

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
                    <TooltipContent side="bottom" className="max-w-xs p-2 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Task #{item.index}</span>
                          <span className="text-xs text-gray-500">
                            {state === "completed" ? "Completed" : state === "current" ? "Current" : "Pending"}
                          </span>
                        </div>
                        <p className="text-xs">{item.plan}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>

          {/* Current Task Info */}
          {currentPlanItem && (
            <div className="flex items-start gap-2 py-1.5 px-2 bg-blue-50 border border-blue-100 rounded">
              <Play className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-blue-700 font-medium">Currently working on:</div>
                <p className="text-xs text-gray-700 truncate">{currentPlanItem.plan}</p>
              </div>
            </div>
          )}

          {/* All tasks completed */}
          {completedCount === planItems.length && planItems.length > 0 && (
            <div className="flex items-start gap-2 py-1.5 px-2 bg-green-50 border border-green-100 rounded">
              <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-green-700 font-medium">All tasks completed</div>
                <p className="text-xs text-gray-700">The agent has finished all planned tasks.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
