import { z } from "zod";
import { TargetRepository } from "./types.js";
import { getRepoAbsolutePath } from "../git.js";

export function createSedToolFields(targetRepository: TargetRepository) {
  const repoRoot = getRepoAbsolutePath(targetRepository);
  const sedToolSchema = z.object({
    file_path: z.string().describe("The file path to read from."),
    start_line: z.number().optional().describe("The starting line number to read from."),
    end_line: z.number().optional().describe("The ending line number to read to."),
    context_lines: z.number().optional().describe("The number of context lines to include."),
    pattern: z.string().optional().describe("The pattern to match in the file."),
    replacement: z.string().optional().describe("The replacement string for the pattern."),
  });

  return {
    name: "sed",
    schema: sedToolSchema,
    description: `Execute a sed command in the repository. The working directory this command will be executed in is \`${repoRoot}\`.`
  };
