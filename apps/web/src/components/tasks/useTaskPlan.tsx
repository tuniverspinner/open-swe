import { TaskPlan } from "@open-swe/shared/open-swe/types";
import { useEffect, useState } from "react";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import { useThreadStatusData } from "@/hooks/useThreadStatus";

// Hook that works with task plan data directly
export function useTaskPlan(taskPlan?: TaskPlan) {
  const [currentTaskPlan, setCurrentTaskPlan] = useState<TaskPlan>();

  useEffect(() => {
    const currentPlanStr = JSON.stringify(currentTaskPlan, null, 2);
    const newPlanStr = JSON.stringify(taskPlan, null, 2);
    if (currentPlanStr !== newPlanStr) {
      setCurrentTaskPlan(taskPlan);
    }
  }, [taskPlan]);

  return {
    taskPlan: currentTaskPlan,
  };
}

// Helper function to deeply compare task plans
function taskPlansEqual(a?: TaskPlan, b?: TaskPlan): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  // Compare key properties that matter for UI updates
  if (a.activeTaskIndex !== b.activeTaskIndex) return false;
  if (a.tasks.length !== b.tasks.length) return false;

  // Compare active task details
  const activeTaskA = a.tasks[a.activeTaskIndex];
  const activeTaskB = b.tasks[b.activeTaskIndex];

  if (!activeTaskA || !activeTaskB) return false;
  if (activeTaskA.activeRevisionIndex !== activeTaskB.activeRevisionIndex)
    return false;

  // Compare plan items completion status in the active revision
  const activeRevA = activeTaskA.planRevisions[activeTaskA.activeRevisionIndex];
  const activeRevB = activeTaskB.planRevisions[activeTaskB.activeRevisionIndex];

  if (!activeRevA || !activeRevB) return false;
  if (activeRevA.plans.length !== activeRevB.plans.length) return false;

  // Check if any plan item completion status changed
  for (let i = 0; i < activeRevA.plans.length; i++) {
    if (activeRevA.plans[i].completed !== activeRevB.plans[i].completed) {
      return false;
    }
  }

  return true;
}

// Hook that gets the active task plan from the thread status polling system
export function useActiveTaskPlan(
  displayThreadTaskPlan?: TaskPlan,
  programmerSession?: ManagerGraphState["programmerSession"],
  displayThreadId?: string,
) {
  const [activeTaskPlan, setActiveTaskPlan] = useState<TaskPlan>();

  // Use the existing thread status polling for the display thread
  const { statusData: displayThreadStatusData } = useThreadStatusData(
    displayThreadId || "",
  );

  // Use the existing thread status polling for the programmer thread when active
  const { statusData: programmerStatusData } = useThreadStatusData(
    programmerSession?.threadId || "",
    { enabled: !!programmerSession?.threadId },
  );

  useEffect(() => {
    let newTaskPlan: TaskPlan | undefined;

    // Priority 1: Use programmer thread task plan if programmer is active and has data
    if (programmerSession?.threadId && programmerStatusData?.taskPlan) {
      newTaskPlan = programmerStatusData.taskPlan;
    }
    // Priority 2: Use planner/manager task plan from display thread status data
    else if (displayThreadStatusData?.taskPlan) {
      newTaskPlan = displayThreadStatusData.taskPlan;
    }
    // Priority 3: Fall back to display thread task plan passed as prop
    else if (displayThreadTaskPlan) {
      newTaskPlan = displayThreadTaskPlan;
    }

    // Only update if the task plan actually changed
    if (!taskPlansEqual(activeTaskPlan, newTaskPlan)) {
      setActiveTaskPlan(newTaskPlan);
    }
  }, [
    displayThreadTaskPlan,
    programmerSession?.threadId,
    programmerSession?.runId,
    displayThreadStatusData?.taskPlan,
    programmerStatusData?.taskPlan,
  ]);

  return {
    taskPlan: activeTaskPlan,
    isProgrammerActive: !!programmerSession,
  };
}
