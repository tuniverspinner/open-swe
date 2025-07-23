import { tool } from "@langchain/core/tools";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { getSandboxErrorFields } from "../utils/sandbox-error-fields.js";
import { createLogger, LogLevel } from "../utils/logger.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import { createSedToolFields } from "@open-swe/shared/open-swe/tools";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { getSandboxSessionOrThrow } from "./utils/get-sandbox-id.js";

const logger = createLogger(LogLevel.INFO, "SedTool");

const DEFAULT_ENV = {
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

function formatSedCommand(input: any): string[] {
  const { file_path, start_line, end_line, context_lines, pattern, replacement } = input;
  const args = ["sed"];

  if (start_line !== undefined && end_line !== undefined) {
    args.push(`-n '${start_line},${end_line}p'`);
  }

  if (pattern && replacement) {
    args.push(`-e 's/${pattern}/${replacement}/g'`);
  }

  args.push(file_path);

  return args;
}

export function createSedTool(
  state: Pick<GraphState, "sandboxSessionId" | "targetRepository">
): ReturnType<typeof tool> {
  return tool(
    async (input): Promise<{ result: string; status: "success" | "error" }> => {
      try {
        const sandbox = await getSandboxSessionOrThrow(input);

        const repoRoot = getRepoAbsolutePath(state.targetRepository);
        const command = formatSedCommand(input);
        logger.info("Running sed command", {
          command: command.join(" "),
          repoRoot,
        });
        const response = await sandbox.process.executeCommand(
          command.join(" "),
          repoRoot,
          DEFAULT_ENV,
          TIMEOUT_SEC,
        );

        if (response.exitCode !== 0) {
          const errorResult = response.result ?? response.artifacts?.stdout;
          throw new Error(
            `Command failed. Exit code: ${response.exitCode}\nResult: ${errorResult}`,
          );
        }

        return {
          result: response.result,
          status: "success",
        };
      } catch (e) {
        const errorFields = getSandboxErrorFields(e);
