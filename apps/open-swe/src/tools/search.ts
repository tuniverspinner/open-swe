import { tool } from "@langchain/core/tools";
import { GraphState, GraphConfig } from "@open-swe/shared/open-swe/types";
import { createLogger, LogLevel } from "../utils/logger.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import {
  createSearchToolFields,
  formatSearchCommand,
} from "@open-swe/shared/open-swe/tools";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { wrapScript } from "../utils/wrap-script.js";
import { getLocalExecutorOrThrow } from "../utils/local-executor.js";

const logger = createLogger(LogLevel.INFO, "SearchTool");

const DEFAULT_ENV = {
  // Prevents corepack from showing a y/n download prompt which causes the command to hang
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

export function createSearchTool(
  state: Pick<GraphState, "targetRepository">,
  config: GraphConfig,
) {
  const searchTool = tool(
    async (input): Promise<{ result: string; status: "success" | "error" }> => {
      try {
        const executor = getLocalExecutorOrThrow(state.targetRepository, config);

        const repoRoot = getRepoAbsolutePath(state.targetRepository);
        const command = formatSearchCommand(input);
        logger.info("Running search command", {
          command: command.join(" "),
          repoRoot,
        });
        const response = await executor.process.executeCommand(
          wrapScript(command.join(" ")),
          repoRoot,
          DEFAULT_ENV,
          TIMEOUT_SEC,
        );

        let successResult = response.result;

        if (
          response.exitCode === 1 ||
          (response.exitCode === 127 && response.result.startsWith("sh: 1: "))
        ) {
          const errorResult = response.result ?? response.artifacts?.stdout;
          successResult = `Exit code 1. No results found.\n\n${errorResult}`;
        } else if (response.exitCode > 1) {
          const errorResult = response.result ?? response.artifacts?.stdout;
          throw new Error(
            `Failed to run search command. Exit code: ${response.exitCode}\nError: ${errorResult}`,
          );
        }

        return {
          result: successResult,
          status: "success",
        };
      } catch (e) {
        // Handle local execution errors
        if (e instanceof Error) {
          throw new Error(`Failed to run search command: ${e.message}`);
        }
        throw e;
      }
    },
    createSearchToolFields(state.targetRepository),
  );

  return searchTool;
}
