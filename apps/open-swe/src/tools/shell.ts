import { tool } from "@langchain/core/tools";
import { GraphState, GraphConfig } from "@open-swe/shared/open-swe/types";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import { createShellToolFields } from "@open-swe/shared/open-swe/tools";
import { getLocalExecutorOrThrow } from "../utils/local-executor.js";

const DEFAULT_ENV = {
  // Prevents corepack from showing a y/n download prompt which causes the command to hang
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

export function createShellTool(
  state: Pick<GraphState, "targetRepository">,
  config: GraphConfig,
) {
  const shellTool = tool(
    async (input): Promise<{ result: string; status: "success" | "error" }> => {
      try {
        const executor = getLocalExecutorOrThrow(state.targetRepository, config);

        const { command, workdir, timeout } = input;
        const response = await executor.process.executeCommand(
          command.join(" "),
          workdir,
          DEFAULT_ENV,
          timeout ?? TIMEOUT_SEC,
        );

        if (response.exitCode !== 0) {
          const errorResult = response.result ?? response.artifacts?.stdout;
          throw new Error(
            `Command failed. Exit code: ${response.exitCode}\nResult: ${errorResult}`,
          );
        }

        return {
          result: response.result ?? `exit code: ${response.exitCode}`,
          status: "success",
        };
      } catch (e) {
        // Handle local execution errors
        if (e instanceof Error) {
          throw new Error(`Command failed: ${e.message}`);
        }
        throw e;
      }
    },
    createShellToolFields(state.targetRepository),
  );

  return shellTool;
}
