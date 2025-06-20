import { getActivePlanItems } from "@open-swe/shared/open-swe/tasks";
import { TaskPlan } from "@open-swe/shared/open-swe/types";

const previousCompletedPlanPrompt = `Here is the list of tasks from the previous session. You've already completed all of these tasks. Use the tasks, and task summaries as context when generating a new plan:
{PREVIOUS_PLAN}`;

const previousProposedPlanPrompt = `Here is the complete list of the proposed plan you generated before the user sent their followup request:
{PREVIOUS_PROPOSED_PLAN}`;

const followupMessagePrompt = `
The user is sending a followup request for you to generate a plan for. You are provided with the following context to aid in your new plan context gathering steps:
  - The previous user requests, along with the tasks, and task summaries you generated for these previous requests.
  - The summaries of the actions you took, and their results from previous planning sessions.
  - You are only provided this information as context to reference when gathering context for the new plan, or for making changes to the previously generated plan.

{PREVIOUS_PLAN}
`;

const formatPreviousPlans = (tasks: TaskPlan): string => {
  const formattedTasksAndRequests = tasks.tasks
    .map((task) => {
      const activePlanItems =
        task.planRevisions[task.activeRevisionIndex].plans;

      return `<previous-task index="${task.taskIndex}">
  User request: ${task.request}

  Overall task summary:\n</task-summary>\n${task.summary || "No overall task summary found"}\n</task-summary>

  Individual tasks & their summaries you generated to complete this request:
${activePlanItems
  .map(
    (planItem) => `
  <plan-item index="${planItem.index}">
    Plan: ${planItem.plan}
    Summary: ${planItem.summary || "No summary found for this task."}
  </plan-item>`,
  )
  .join("\n  ")}
</previous-task>`;
    })
    .join("\n");

  return previousCompletedPlanPrompt.replace(
    "{PREVIOUS_PLAN}",
    formattedTasksAndRequests,
  );
};

const formatPreviousProposedPlan = (proposedPlan: string[]): string => {
  const formattedProposedPlan = proposedPlan
    .map((p) => `<proposed-plan-item>${p}</proposed-plan-item>`)
    .join("\n");
  return previousProposedPlanPrompt.replace(
    "{PREVIOUS_PROPOSED_PLAN}",
    formattedProposedPlan,
  );
};

export function formatFollowupMessagePrompt(
  tasks: TaskPlan,
  proposedPlan: string[],
): string {
  let isGeneratingNewPlan = false;
  if (tasks && tasks.tasks?.length) {
    const activePlanItems = getActivePlanItems(tasks);
    isGeneratingNewPlan = activePlanItems.every((p) => p.completed);
    if (!isGeneratingNewPlan && !proposedPlan.length) {
      throw new Error(
        "Can not format plan prompt if no proposed plan is provided.",
      );
    }
  }

  return followupMessagePrompt.replace(
    "{PREVIOUS_PLAN}",
    isGeneratingNewPlan
      ? formatPreviousPlans(tasks)
      : formatPreviousProposedPlan(proposedPlan),
  );
}

export function isFollowupRequest(
  taskPlan: TaskPlan | undefined,
  proposedPlan: string[] | undefined,
) {
  return taskPlan?.tasks?.length || proposedPlan?.length;
}
