import { useStreamContext } from "@/providers/Stream";
import { TaskPlan } from "@open-swe/shared/open-swe/types";
import { useEffect, useState } from "react";

export function useTaskPlan() {
  const stream = useStreamContext();
  const { values } = stream;
  const [taskPlan, setTaskPlan] = useState<TaskPlan>();

  useEffect(() => {
    const currentPlanStr = JSON.stringify(taskPlan, null, 2);
    const newPlanStr = JSON.stringify(values?.plan, null, 2);
    if (currentPlanStr !== newPlanStr) {
      setTaskPlan(values?.plan);
    }
  }, [values?.plan]);

  // Helper function to update graph state
  const updateGraphState = (updatedPlan: TaskPlan) => {
    stream.submit(
      { plan: updatedPlan },
      {
        streamMode: ["values"],
        optimisticValues: (prev) => ({
          ...prev,
          plan: updatedPlan,
        }),
      },
    );
  };

  const handleTaskChange = (taskId: string) => {
    console.log(`Switched to task: ${taskId}`);
  };

  const handleRevisionChange = (taskId: string, revisionIndex: number) => {
    console.log(`Task ${taskId} switched to revision ${revisionIndex}`);
  };

  const handleEditPlanItem = (
    taskId: string,
    planItemIndex: number,
    newPlan: string,
  ) => {
    const updatedPlan = ((prevTaskPlan) => {
      const prevTaskPlan_ = prevTaskPlan ?? {
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
    })(taskPlan);

    setTaskPlan(updatedPlan);
    updateGraphState(updatedPlan);
    console.log(
      `Edited plan item ${planItemIndex} in task ${taskId}: ${newPlan}`,
    );
  };

  const handleAddPlanItem = (taskId: string, plan: string) => {
    const updatedPlan = ((prevTaskPlan) => {
      const prevTaskPlan_ = prevTaskPlan ?? {
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
    })(taskPlan);

    setTaskPlan(updatedPlan);
    updateGraphState(updatedPlan);
    console.log(`Added new plan item to task ${taskId}: ${plan}`);
  };

  const handleDeletePlanItem = (taskId: string, planItemIndex: number) => {
    const updatedPlan = ((prevTaskPlan) => {
      const prevTaskPlan_ = prevTaskPlan ?? {
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
    })(taskPlan);

    setTaskPlan(updatedPlan);
    updateGraphState(updatedPlan);
    console.log(`Deleted plan item ${planItemIndex} from task ${taskId}`);
  };

  return {
    taskPlan,
    handleTaskChange,
    handleRevisionChange,
    handleEditPlanItem,
    handleAddPlanItem,
    handleDeletePlanItem,
  };
}
