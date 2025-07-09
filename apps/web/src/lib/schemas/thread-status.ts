import { z } from "zod";
import { ThreadStatus } from "@langchain/langgraph-sdk";

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
 * LangGraph SDK ThreadStatus schema
 * Represents the actual status from the LangGraph SDK
 */
export const LangGraphThreadStatus = z.enum([
  "busy",
  "idle",
  "error",
  "interrupted",
]);

export type LangGraphThreadStatus = z.infer<typeof LangGraphThreadStatus>;

/**
 * Agent session schema for planner and programmer sessions
 */
export const AgentSessionSchema = z.object({
  threadId: z.string(),
  runId: z.string(),
});

export type AgentSessionSchema = z.infer<typeof AgentSessionSchema>;

/**
 * Manager thread state schema for status validation
 */
export const ManagerThreadStateSchema = z.object({
  status: LangGraphThreadStatus,
  plannerSession: AgentSessionSchema.optional(),
  programmerSession: AgentSessionSchema.optional(),
  taskPlan: z.any().optional(), // TaskPlan type from shared package
});

export type ManagerThreadStateSchema = z.infer<typeof ManagerThreadStateSchema>;

/**
 * Planner thread state schema for status validation
 */
export const PlannerThreadStateSchema = z.object({
  status: LangGraphThreadStatus,
  programmerSession: AgentSessionSchema.optional(),
  taskPlan: z.any().optional(), // TaskPlan type from shared package
});

export type PlannerThreadStateSchema = z.infer<typeof PlannerThreadStateSchema>;

/**
 * Programmer thread state schema for status validation
 */
export const ProgrammerThreadStateSchema = z.object({
  status: LangGraphThreadStatus,
  taskPlan: z.any().optional(), // TaskPlan type from shared package
});

export type ProgrammerThreadStateSchema = z.infer<
  typeof ProgrammerThreadStateSchema
>;

/**
 * Thread polling response schema for caching
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
