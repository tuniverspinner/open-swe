import { v4 as uuidv4 } from "uuid";
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { createLogger, LogLevel } from "../../../utils/logger.js";
import { GraphState, GraphConfig } from "@open-swe/shared/open-swe/types";
import { isLocalMode, getLocalWorkingDirectory } from "../../../utils/local-mode.js";
import { getLocalShellExecutor } from "../../../utils/local-shell-executor.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";

const logger = createLogger(LogLevel.INFO, "HandleShellCommandResponse");

const DEFAULT_ENV = {
  // Prevents corepack from showing a y/n download prompt which causes the command to hang
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

export async function handleShellCommandResponse(
  state: GraphState,
  config: GraphConfig,
): Promise<Command> {
  const { pendingShellCommand } = state as any;
  
  if (!pendingShellCommand) {
    logger.error("No pending shell command found in state");
    return new Command({
      goto: "generate-action",
    });
  }

  const { command, workdir, timeout, toolCallId } = pendingShellCommand;
  
  try {
    if (isLocalMode(config)) {
      // Execute the shell command in local mode
      const executor = getLocalShellExecutor(getLocalWorkingDirectory());
      const response = await executor.executeCommand(
        Array.isArray(command) ? command.join(" ") : String(command),
        workdir || getLocalWorkingDirectory(),
        DEFAULT_ENV,
        timeout ?? TIMEOUT_SEC,
        true, // localMode
      );

      if (response.exitCode !== 0) {
        const errorResult = response.result ?? response.artifacts?.stdout;
        throw new Error(
          `Command failed. Exit code: ${response.exitCode}\nResult: ${errorResult}`,
        );
      }

      // Create a successful tool message
      const toolMessage = new ToolMessage({
        id: uuidv4(),
        tool_call_id: toolCallId ?? "",
        content: response.result ?? `exit code: ${response.exitCode}`,
        name: "shell",
        status: "success",
      });

      logger.info("Shell command executed successfully", {
        command: Array.isArray(command) ? command.join(" ") : String(command),
        workdir,
        exitCode: response.exitCode,
      });

      return new Command({
        goto: "generate-action",
        update: {
          internalMessages: [...state.internalMessages, toolMessage],
          pendingShellCommand: undefined,
          shellCommandInterrupt: undefined,
        },
      });
    } else {
      // This shouldn't happen in sandbox mode, but handle it gracefully
      logger.warn("Shell command response handler called in sandbox mode");
      return new Command({
        goto: "generate-action",
      });
    }
  } catch (e) {
    logger.error("Failed to execute shell command", {
      command: Array.isArray(command) ? command.join(" ") : String(command),
      workdir,
      error: e instanceof Error ? e.message : String(e),
    });

    // Create an error tool message
    const toolMessage = new ToolMessage({
      id: uuidv4(),
      tool_call_id: toolCallId ?? "",
      content: `FAILED TO EXECUTE SHELL COMMAND: ${e instanceof Error ? e.message : String(e)}`,
      name: "shell",
      status: "error",
    });

    return new Command({
      goto: "take-action",
      update: {
        internalMessages: [...state.internalMessages, toolMessage],
        pendingShellCommand: undefined,
        shellCommandInterrupt: undefined,
      },
    });
  }
} 