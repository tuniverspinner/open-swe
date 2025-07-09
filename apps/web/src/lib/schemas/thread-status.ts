import { z } from "zod";

/**
 * Thread status enum for UI display
 * Maps to the priority logic: manager > planner > programmer
 */
export const ThreadDisplayStatus = z.enum([
  "running",
  "completed",
  "failed",
  "pending",
  "idle",
  "paused",
  "error",
]);

export type ThreadDisplayStatus = z.infer<typeof ThreadDisplayStatus>;

/**
 * Thread status response schema for SWR typing
 * Used by useThreadStatus hook and fetchThreadStatus service
 */
export const ThreadPollingResponseSchema = z.object({
  graph: z.enum(["manager", "planner", "programmer"]),
  runId: z.string(),
  threadId: z.string(),
  status: ThreadDisplayStatus,
  taskPlan: z.any().optional(), // TaskPlan type from shared package
});

export type ThreadPollingResponseSchema = z.infer<
  typeof ThreadPollingResponseSchema
>;
