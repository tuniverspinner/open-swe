import { TaskPlan } from "@open-swe/shared/open-swe/types";
import { useEffect, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { PROGRAMMER_GRAPH_ID } from "@open-swe/shared/constants";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";

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

// Hook that gets the active task plan from the correct source (programmer thread when active, fallback to display thread)
export function useActiveTaskPlan(
  displayThreadTaskPlan?: TaskPlan,
  programmerSession?: ManagerGraphState["programmerSession"],
) {
  const [activeTaskPlan, setActiveTaskPlan] = useState<TaskPlan>();

  // Connect to programmer thread when session exists
  const programmerStream = useStream<GraphState>({
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
    assistantId: PROGRAMMER_GRAPH_ID,
    threadId: programmerSession?.threadId ?? null,
    reconnectOnMount: true,
    fetchStateHistory: false,
  });

  useEffect(() => {
    let newTaskPlan: TaskPlan | undefined;

    // Priority 1: Use programmer thread task plan if programmer is active and has data
    if (programmerSession && programmerStream.values?.taskPlan) {
      newTaskPlan = programmerStream.values.taskPlan;
    }
    // Priority 2: Fall back to display thread task plan
    else if (displayThreadTaskPlan) {
      newTaskPlan = displayThreadTaskPlan;
    }

    // Only update if the task plan actually changed
    const currentPlanStr = JSON.stringify(activeTaskPlan, null, 2);
    const newPlanStr = JSON.stringify(newTaskPlan, null, 2);
    if (currentPlanStr !== newPlanStr) {
      setActiveTaskPlan(newTaskPlan);
    }
  }, [
    displayThreadTaskPlan,
    programmerSession,
    programmerStream.values?.taskPlan,
    activeTaskPlan,
  ]);

  return {
    taskPlan: activeTaskPlan,
    isProgrammerActive: !!programmerSession,
    programmerStream,
  };
}
