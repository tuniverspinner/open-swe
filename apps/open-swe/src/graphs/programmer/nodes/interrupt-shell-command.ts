import { v4 as uuidv4 } from "uuid";
import { interrupt } from "@langchain/langgraph";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";
import { Command } from "@langchain/langgraph";
import { createLogger, LogLevel } from "../../../utils/logger.js";
import { GraphState, GraphConfig } from "@open-swe/shared/open-swe/types";
const SHELL_COMMAND_INTERRUPT_ACTION_TITLE = "Approve Shell Command";
import { isLocalMode } from "../../../utils/local-mode.js";

const logger = createLogger(LogLevel.INFO, "InterruptShellCommand");

export async function interruptShellCommand(
  state: GraphState,
  config: GraphConfig,
  shellCommand: string,
  workdir: string,
): Promise<HumanResponse | HumanResponse[]> {
  // Only interrupt in local mode
  if (!isLocalMode(config)) {
    // In sandbox mode, just continue without interruption
    throw new Error("Shell command interrupt should not be called in sandbox mode");
  }

  logger.info("Interrupting shell command for user approval", {
    command: shellCommand,
    workdir,
    isLocalMode: isLocalMode(config),
  });

  const interruptResponse = interrupt<
    HumanInterrupt,
    HumanResponse[] | HumanResponse
  >({
    action_request: {
      action: SHELL_COMMAND_INTERRUPT_ACTION_TITLE,
      args: {
        command: shellCommand,
        workdir,
      },
    },
    config: {
      allow_accept: true,
      allow_edit: false,
      allow_respond: false,
      allow_ignore: true,
    },
  });

  return interruptResponse;
}

export async function handleShellCommandResponse(
  state: GraphState,
  config: GraphConfig,
  response: HumanResponse | HumanResponse[],
): Promise<Command> {
  const responseArray = Array.isArray(response) ? response : [response];
  const firstResponse = responseArray[0];
  
  if (firstResponse.type === "accept") {
    logger.info("Shell command approved by user, continuing execution");
    return new Command({
      goto: "take_action",
    });
  } else if (firstResponse.type === "ignore") {
    logger.info("Shell command denied by user, skipping execution");
    // Skip the shell command by returning to generate_message
    return new Command({
      goto: "generate_message",
    });
  } else {
    // This shouldn't happen given our config, but handle it gracefully
    logger.warn("Unexpected shell command response type", { type: firstResponse.type });
    return new Command({
      goto: "generate_message",
    });
  }
} 