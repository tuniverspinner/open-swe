import { tool } from "@langchain/core/tools";
import { GraphState, GraphConfig } from "@open-swe/shared/open-swe/types";
import { createLogger, LogLevel } from "../utils/logger.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import { createInstallDependenciesToolFields } from "@open-swe/shared/open-swe/tools";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { getLocalExecutorOrThrow } from "../utils/local-executor.js";

const logger = createLogger(LogLevel.INFO, "InstallDependenciesTool");

const DEFAULT_ENV = {
  // Prevents corepack from showing a y/n download prompt which causes the command to hang
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

export function createInstallDependenciesTool(
  state: Pick<GraphState, "targetRepository">,
  config: GraphConfig,
) {
  const installDependenciesTool = tool(
    async (input): Promise<{ result: string; status: "success" | "error" }> => {
      try {
        const executor = getLocalExecutorOrThrow(state.targetRepository, config);

        const repoRoot = getRepoAbsolutePath(state.targetRepository);
        const command = input.command.join(" ");
        const workdir = input.workdir || repoRoot;
        logger.info("Running install dependencies command", {
          command,
          workdir,
        });
        const response = await executor.process.executeCommand(
          command,
          workdir,
          DEFAULT_ENV,
          TIMEOUT_SEC * 2.5, // add a 2.5 min timeout
        );

        if (response.exitCode !== 0) {
          const errorResult = response.result ?? response.artifacts?.stdout;
          throw new Error(
            `Failed to install dependencies. Exit code: ${response.exitCode}\nError: ${errorResult}`,
          );
        }

        return {
          result: response.result,
          status: "success",
        };
      } catch (e) {
        // Handle local execution errors
        if (e instanceof Error) {
          throw new Error(`Failed to install dependencies: ${e.message}`);
        }
        throw e;
      }
    },
    createInstallDependenciesToolFields(state.targetRepository),
  );

  return installDependenciesTool;
}
