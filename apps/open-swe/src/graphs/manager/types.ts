import { MessagesZodState } from "@langchain/langgraph";
import { TargetRepository, TaskPlan } from "@open-swe/shared/open-swe/types";
import { z } from "zod";

export const ManagerGraphStateObj = MessagesZodState.extend({
  /**
   * The GitHub issue number that the user's request is associated with.
   * If not provided when the graph is invoked, it will create an issue.
   */
  githubIssueId: z.number(),
  /**
   * The GitHub pull request number of the PR which resolves the user's request.
   * If not provided when the graph is invoked, it will create a PR.
   */
  githubPullRequestId: z.number().optional(),
  /**
   * The target repository the request should be executed in.
   */
  targetRepository: z.custom<TargetRepository>(),
  /**
   * The tasks generated for this request.
   */
  taskPlan: z.custom<TaskPlan>(),
  /**
   * The programmer thread ID
   */
  programmerThreadId: z.string().optional(),
  /**
   * The planner thread ID
   */
  plannerThreadId: z.string().optional(),
  /**
   * The branch name to checkout and make changes on.
   * Can be user specified, or defaults to `open-swe/<manager-thread-id>
   */
  branchName: z.string(),
});

export type ManagerGraphState = z.infer<typeof ManagerGraphStateObj>;
export type ManagerGraphUpdate = Partial<ManagerGraphState>;
