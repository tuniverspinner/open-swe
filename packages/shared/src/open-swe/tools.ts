import { z } from "zod";
import { TargetRepository } from "./types.js";
import { getRepoAbsolutePath } from "../git.js";
import { TIMEOUT_SEC } from "../constants.js";

export function createApplyPatchToolFields(targetRepository: TargetRepository) {
  const repoRoot = getRepoAbsolutePath(targetRepository);
  const applyPatchToolSchema = z.object({
    diff: z
      .string()
      .describe(
        `The diff to apply. Use a standard diff format. Ensure this field is ALWAYS provided.`,
      ),
    file_path: z.string().describe("The file path to apply the diff to."),
  });

  return {
    name: "apply_patch",
    description:
      "Applies a diff to a file given a file path and diff content." +
      `The working directory this diff will be applied to is \`${repoRoot}\`. Ensure the file paths you provide are relative to this directory.`,
    schema: applyPatchToolSchema,
  };
}

export function createRequestHumanHelpToolFields() {
  const requestHumanHelpSchema = z.object({
    help_request: z
      .string()
      .describe(
        "The help request to send to the human. Should be concise, but descriptive.",
      ),
  });
  return {
    name: "request_human_help",
    schema: requestHumanHelpSchema,
    description:
      "Use this tool to request help from the human. This should only be called if you are stuck, and you are unable to continue. This will pause your execution until the user responds. You will not be able to go back and fourth with the user, so ensure the help request contains all of the necessary information and context the user might need to respond to your request.",
  };
}

export function createSessionPlanToolFields() {
  const sessionPlanSchema = z.object({
    plan: z
      .array(z.string())
      .describe("The plan to address the user's request."),
  });
  return {
    name: "session_plan",
    description: "Call this tool when you are ready to generate a plan.",
    schema: sessionPlanSchema,
  };
}

export function createShellToolFields(targetRepository: TargetRepository) {
  const repoRoot = getRepoAbsolutePath(targetRepository);
  const shellToolSchema = z.object({
    command: z
      .array(z.string())
      .describe(
        "The command to run. Ensure the command is properly formatted, with arguments in the correct order, and including any wrapping strings, quotes, etc. By default, this command will be executed in the root of the repository, unless a custom workdir is specified.",
      ),
    workdir: z
      .string()
      .default(repoRoot)
      .describe(
        `The working directory for the command. Defaults to the root of the repository (${repoRoot}). You should only specify this if the command you're running can not be executed from the root of the repository.`,
      ),
    timeout: z
      .number()
      .optional()
      .default(TIMEOUT_SEC)
      .describe(
        "The maximum time to wait for the command to complete in seconds.",
      ),
  });
  return {
    name: "shell",
    description: "Runs a shell command, and returns its output.",
    schema: shellToolSchema,
  };
}

export function createUpdatePlanToolFields() {
  const updatePlanSchema = z.object({
    update_plan_reasoning: z
      .string()
      .describe(
        "The reasoning for why you are updating the plan. This should include context which will be useful when actually updating the plan, such as what plan items to update, edit, or remove, along with any other context that would be useful when updating the plan.",
      ),
  });

  return {
    name: "update_plan",
    schema: updatePlanSchema,
    description:
      "Call this tool to update the current plan. This should ONLY be called if you want to remove, edit, or add plan items to the current plan." +
      "\nDo NOT call this tool to mark a plan item as completed, or add a summary." +
      "\nYou can not edit/remove completed plan items. This tool can only be used to update/add/remove plan items from the remaining and current plan items." +
      "\nThe reasoning you pass to this tool will be used in the step that actually updates the plan, so ensure it is useful and concise.",
  };
}

export function createSetTaskStatusToolFields() {
  const setTaskStatusToolSchema = z.object({
    reasoning: z
      .string()
      .describe(
        "A concise reasoning summary for the status of the current task, explaining why you think it is completed or not completed.",
      ),
    task_status: z
      .enum(["completed", "not_completed"])
      .describe(
        "The status of the current task, based on the reasoning provided.",
      ),
  });

  const setTaskStatusTool = {
    name: "set_task_status",
    description:
      "The status of the current task, along with a concise reasoning summary to support the status.",
    schema: setTaskStatusToolSchema,
  };

  return setTaskStatusTool;
}
