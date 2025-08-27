import { z } from "zod";

/**
 * Type definitions for Open SWE V2 coding agent
 */

// Command argument types
export interface FileEditCommandArgs {
  file_path?: string;
  path?: string;
}

export interface ExecuteBashCommandArgs {
  cwd?: string;
}

export interface FileSystemCommandArgs {
  path?: string;
  directory?: string;
}

export interface GenericCommandArgs {
  [key: string]: any;
}

// Union type for all possible command arguments
export type CommandArgs =
  | FileEditCommandArgs
  | ExecuteBashCommandArgs
  | FileSystemCommandArgs
  | GenericCommandArgs;

// Command types
export type FileEditCommand =
  | "write_file"
  | "str_replace_based_edit_tool"
  | "edit_file";
export type ExecuteBashCommand = "execute_bash";
export type FileSystemCommand = "ls" | "glob" | "grep";
export type GenericCommand = string;

export type Command =
  | FileEditCommand
  | ExecuteBashCommand
  | FileSystemCommand
  | GenericCommand;

// Approval key type
export type ApprovalKey = string;

// Approved operations schema
export const ApprovedOperationsSchema = z
  .object({
    cached_approvals: z.set(z.string()).default(() => new Set<string>()),
  })
  .optional();

export type ApprovedOperations = z.infer<typeof ApprovedOperationsSchema>;
// Type for the approval key generation result
export interface ApprovalKeyResult {
  command: Command;
  targetDir: string;
  normalizedDir: string;
  approvalKey: ApprovalKey;
}
