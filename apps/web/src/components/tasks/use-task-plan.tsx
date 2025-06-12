import { useStreamContext } from "@/providers/Stream";
import { TaskPlan } from "@open-swe/shared/open-swe/types";
import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";

export function useTaskPlan() {
  const stream = useStreamContext();
  const [taskPlan, setTaskPlan] = useState<TaskPlan>();
  const [isUpdating, setIsUpdating] = useState(false);
  const [threadId] = useQueryState("threadId");

  useEffect(() => {
    const currentPlanStr = JSON.stringify(taskPlan, null, 2);
    const newPlanStr = JSON.stringify(stream.values?.plan, null, 2);
    if (currentPlanStr !== newPlanStr) {
      setTaskPlan(stream.values?.plan);
    }
  }, [stream.values?.plan]);

  const updateGraphState = async (newPlanState: TaskPlan) => {
    try {
      setIsUpdating(true);
      // Update the graph state with the new plan
      if (!threadId) {
        console.error("No thread ID available");
        return false;
      }

      await stream.client.threads.updateState(threadId, {
        values: {
          plan: newPlanState,
        },
      });
      return true;
    } catch (error) {
      console.error("Failed to update plan state:", error);
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTaskChange = (taskId: string) => {
    console.log(`Switched to task: ${taskId}`);
  };

  const handleRevisionChange = (taskId: string, revisionIndex: number) => {
    console.log(`Task ${taskId} switched to revision ${revisionIndex}`);
  };

  const handleEditPlanItem = async (
    taskId: string,
    planItemIndex: number,
    newPlan: string,
  ) => {
    // Create new plan state
    const newPlanState = (() => {
      const prevTaskPlan_ = taskPlan ?? {
        tasks: [],
        activeTaskIndex: 0,
      };
      return {
        ...prevTaskPlan_,
        tasks: prevTaskPlan_.tasks.map((task) => {
          if (task.id === taskId) {
            const updatedRevisions = [...task.planRevisions];
            const activeRevision = updatedRevisions[task.activeRevisionIndex];
            updatedRevisions[task.activeRevisionIndex] = {
              ...activeRevision,
              plans: activeRevision.plans.map((item) =>
                item.index === planItemIndex
                  ? { ...item, plan: newPlan }
                  : item,
              ),
            };
            return { ...task, planRevisions: updatedRevisions };
          }
          return task;
        }),
      };
    })();

    // Update local state immediately for UI responsiveness
    setTaskPlan(newPlanState);

    // Update graph state
    const success = await updateGraphState(newPlanState);
    if (!success) {
      // Revert local state if graph update fails
      setTaskPlan(taskPlan);
      console.error("Failed to edit plan item. Changes reverted.");
    }

    console.log(
      `Edited plan item ${planItemIndex} in task ${taskId}: ${newPlan}`,
    );
  };

  const handleAddPlanItem = async (taskId: string, plan: string) => {
    // Create new plan state
    const newPlanState = (() => {
      const prevTaskPlan_ = taskPlan ?? {
        tasks: [],
        activeTaskIndex: 0,
      };
      return {
        ...prevTaskPlan_,
        tasks: prevTaskPlan_.tasks.map((task) => {
          if (task.id === taskId) {
            const updatedRevisions = [...task.planRevisions];
            const activeRevision = updatedRevisions[task.activeRevisionIndex];
            const maxIndex = Math.max(
              ...activeRevision.plans.map((item) => item.index),
              0,
            );
            const newPlanItem = {
              index: maxIndex + 1,
              plan,
              completed: false,
            };

            updatedRevisions[task.activeRevisionIndex] = {
              ...activeRevision,
              plans: [...activeRevision.plans, newPlanItem],
            };
            return { ...task, planRevisions: updatedRevisions };
          }
          return task;
        }),
      };
    })();

    // Update local state immediately for UI responsiveness
    setTaskPlan(newPlanState);

    // Update graph state
    const success = await updateGraphState(newPlanState);
    if (!success) {
      // Revert local state if graph update fails
      setTaskPlan(taskPlan);
      console.error("Failed to add plan item. Changes reverted.");
    }

    console.log(`Added new plan item to task ${taskId}: ${plan}`);
  };

  const handleDeletePlanItem = async (
    taskId: string,
    planItemIndex: number,
  ) => {
    // Create new plan state
    const newPlanState = (() => {
      const prevTaskPlan_ = taskPlan ?? {
        tasks: [],
        activeTaskIndex: 0,
      };
      return {
        ...prevTaskPlan_,
        tasks: prevTaskPlan_.tasks.map((task) => {
          if (task.id === taskId) {
            const updatedRevisions = [...task.planRevisions];
            const activeRevision = updatedRevisions[task.activeRevisionIndex];
            updatedRevisions[task.activeRevisionIndex] = {
              ...activeRevision,
              plans: activeRevision.plans.filter(
                (item) => item.index !== planItemIndex,
              ),
            };
            return { ...task, planRevisions: updatedRevisions };
          }
          return task;
        }),
      };
    })();

    // Update local state immediately for UI responsiveness
    setTaskPlan(newPlanState);

    // Update graph state
    const success = await updateGraphState(newPlanState);
    if (!success) {
      // Revert local state if graph update fails
      setTaskPlan(taskPlan);
      console.error("Failed to delete plan item. Changes reverted.");
    }

    console.log(`Deleted plan item ${planItemIndex} from task ${taskId}`);
  };

  return {
    taskPlan,
    isUpdating,
    handleTaskChange,
    handleRevisionChange,
    handleEditPlanItem,
    handleAddPlanItem,
    handleDeletePlanItem,
  };
}
