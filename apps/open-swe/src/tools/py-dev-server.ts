import { tool } from "@langchain/core/tools";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { createLogger, LogLevel } from "../utils/logger.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import { getSandboxSessionOrThrow } from "./utils/get-sandbox-id.js";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { createLangGraphServerStartupToolFields } from "@open-swe/shared/open-swe/tools";

const logger = createLogger(LogLevel.INFO, "PythonDevServer");

export function createLangGraphServerStartupTool(
  state: Pick<GraphState, "sandboxSessionId" | "targetRepository">,
) {
  const langGraphServerStartup = tool(async (input) => {
    try {
      console.log("[createLangGraphServerStartupTool] input", input);
      const sandbox = await getSandboxSessionOrThrow(input);
      const repoRoot = getRepoAbsolutePath(state.targetRepository);

      const response = await sandbox.process.executeCommand(
        "ruff check .",
        repoRoot,
        undefined,
        TIMEOUT_SEC,
      );

      if (response.exitCode !== 0) {
        throw new Error(`Command failed with exit code: ${response.exitCode}`);
      }

      return {
        result: response.result ?? `exit code: ${response.exitCode}`,
        status: "success",
      };
    } catch (error) {
      logger.error("FAILED TO RUN COMMAND", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error; // Let the error propagate to be handled by LangGraph
    }
  }, createLangGraphServerStartupToolFields(state.targetRepository));

  return langGraphServerStartup;
}
