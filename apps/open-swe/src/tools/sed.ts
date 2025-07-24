import { tool } from "@langchain/core/tools";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { getSandboxErrorFields } from "../utils/sandbox-error-fields.js";
import { createLogger, LogLevel } from "../utils/logger.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import {
  createSedToolFields,
  formatSedCommand,
} from "@open-swe/shared/open-swe/tools";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { getSandboxSessionOrThrow } from "./utils/get-sandbox-id.js";

const logger = createLogger(LogLevel.INFO, "SedTool");

const DEFAULT_ENV = {
  // Prevents corepack from showing a y/n download prompt which causes the command to hang
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

export function createSedTool(
  state: Pick<GraphState, "sandboxSessionId" | "targetRepository">,
) {
  const sedTool = tool(
    async (input): Promise<{ result: string; status: "success" | "error" }> => {
      try {
        const sandbox = await getSandboxSessionOrThrow(input);

        const repoRoot = getRepoAbsolutePath(state.targetRepository);
        const command = formatSedCommand(input);
        logger.info("Running sed command", {
          command: command.join(" "),
          repoRoot,
          file_path: input.file_path,
        });

        const response = await sandbox.process.executeCommand(
          command.join(" "),
          repoRoot,
          DEFAULT_ENV,
          TIMEOUT_SEC,
        );

        if (response.exitCode !== 0) {
          const errorResult = response.result ?? response.artifacts?.stdout;

          // Handle common sed errors more gracefully
          if (
            response.exitCode === 1 &&
            errorResult?.includes("No such file")
          ) {
            throw new Error(
              `File not found: ${input.file_path}. Please ensure the file path is correct and relative to the repository root.`,
            );
          }

          throw new Error(
            `Failed to run sed command. Exit code: ${response.exitCode}\nError: ${errorResult}`,
          );
        }

        return {
          result: response.result ?? "",
          status: "success",
        };
      } catch (e) {
        const errorFields = getSandboxErrorFields(e);
        if (errorFields) {
          const errorResult =
            errorFields.result ?? errorFields.artifacts?.stdout;
          throw new Error(
            `Failed to run sed command. Exit code: ${errorFields.exitCode}\nError: ${errorResult}`,
          );
        }

        throw e;
      }
    },
    createSedToolFields(state.targetRepository),
  );

  return sedTool;
}
