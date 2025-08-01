import { tool } from "@langchain/core/tools";
import { GraphState, GraphConfig } from "@open-swe/shared/open-swe/types";
import { getSandboxErrorFields } from "../utils/sandbox-error-fields.js";
import { createLogger, LogLevel } from "../utils/logger.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { getSandboxSessionOrThrow } from "./utils/get-sandbox-id.js";
import {
  isLocalMode,
  getLocalWorkingDirectory,
} from "@open-swe/shared/open-swe/local-mode";
import { createShellExecutor } from "../utils/shell-executor.js";
import {
  createGrepToolFields,
  formatGrepCommand,
} from "@open-swe/shared/open-swe/tools";

const logger = createLogger(LogLevel.INFO, "GrepTool");

export function createGrepTool(
  state: Pick<GraphState, "sandboxSessionId" | "targetRepository">,
  config: GraphConfig,
) {
  const grepTool = tool(
    async (input): Promise<{ result: string; status: "success" | "error" }> => {
      try {
        const command = formatGrepCommand(input as any);

        let repoRoot;
        if (isLocalMode(config)) {
          // In local mode, use the local working directory
          repoRoot = getLocalWorkingDirectory();
        } else {
          // In sandbox mode, use the sandbox path
          repoRoot = getRepoAbsolutePath(state.targetRepository);
        }

        logger.info("Running grep search command", {
          command: command.join(" "),
          repoRoot,
        });

        // Get sandbox if needed for sandbox mode
        let sandbox;
        if (!isLocalMode(config)) {
          sandbox = await getSandboxSessionOrThrow(input);
        }

        const executor = createShellExecutor(config);
        const response = await executor.executeCommand({
          command,
          workdir: repoRoot,
          timeout: TIMEOUT_SEC,
          sandbox,
        });

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
            `Failed to run grep search command. Exit code: ${response.exitCode}\nError: ${errorResult}`,
          );
        }

        return {
          result: successResult,
          status: "success",
        };
      } catch (error: any) {
        const errorFields = getSandboxErrorFields(error);
        if (errorFields) {
          return {
            result: `Error: ${errorFields.result ?? errorFields.artifacts?.stdout}`,
            status: "error",
          };
        }

        return {
          result: `Error: ${error.message || String(error)}`,
          status: "error",
        };
      }
    },
    createGrepToolFields(state.targetRepository),
  );

  return grepTool;
}
