import { tool } from "@langchain/core/tools";
import { createLogger, LogLevel } from "../utils/logger.js";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { getSandboxErrorFields } from "../utils/sandbox-error-fields.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import { createMonitorDevServerToolFields } from "@open-swe/shared/open-swe/tools";
import { getSandboxSessionOrThrow } from "./utils/get-sandbox-id.js";

const DEFAULT_ENV = {
  // Prevents corepack from showing a y/n download prompt which causes the command to hang
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

const logger = createLogger(LogLevel.INFO, "MonitorDevServerTool");

export function createMonitorDevServerTool(
  state: Pick<GraphState, "sandboxSessionId" | "targetRepository">,
) {
  const monitorDevServerTool = tool(
    async (input): Promise<{ result: string; status: "success" | "error" }> => {
      try {
        const sandbox = await getSandboxSessionOrThrow(input);
        const { command, request, workdir, wait_time } = input;

        const waitTime = wait_time;
        const sessionId = `monitor-${Date.now()}`;

        logger.info("Starting monitor dev server", {
          command: command.join(" "),
          request,
          workdir,
          waitTime,
          sessionId,
        });

        const startCommand = `tmux new-session -d -s "${sessionId}" -c "${workdir}" "${command.join(" ")}"`;
        const startResponse = await sandbox.process.executeCommand(
          startCommand,
          workdir,
          DEFAULT_ENV,
          TIMEOUT_SEC,
        );

        if (startResponse.exitCode !== 0) {
          throw new Error(
            `Failed to start tmux session. Exit code: ${startResponse.exitCode}\nResult: ${startResponse.result}`,
          );
        }

        logger.info(`Server started in tmux session: ${sessionId}`);

        logger.info(`Waiting ${waitTime}s for server startup...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

        logger.info(`Sending request: ${request}`);
        const httpResponse = await sandbox.process.executeCommand(
          request,
          workdir,
          DEFAULT_ENV,
          TIMEOUT_SEC,
        );

        logger.info(`Waiting ${waitTime}s for request processing...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

        // Capture server logs
        const logsCommand = `tmux capture-pane -S - -p -t "${sessionId}"`;
        const logsResponse = await sandbox.process.executeCommand(
          logsCommand,
          workdir,
          DEFAULT_ENV,
          10,
        );

        // Stop server (cleanup)
        const stopCommand = `tmux kill-session -t "${sessionId}"`;
        await sandbox.process.executeCommand(
          stopCommand,
          workdir,
          DEFAULT_ENV,
          10,
        );

        logger.info(`Cleaned up tmux session: ${sessionId}`);

        const resultParts = [];
        resultParts.push("MONITOR DEV SERVER RESULTS: ");
        resultParts.push(`Command: ${command.join(" ")}`);
        resultParts.push(`Request: ${request}`);
        resultParts.push("");
        resultParts.push("REQUEST RESPONSE: ");
        resultParts.push(
          httpResponse.result || `exit code: ${httpResponse.exitCode}`,
        );
        resultParts.push("");
        resultParts.push("SERVER LOGS: ");
        resultParts.push(logsResponse.result || "No logs captured");

        logger.info("Monitor dev server completed", {
          sessionId,
          responseExitCode: httpResponse.exitCode,
          logsLength: (logsResponse.result || "").length,
        });

        return {
          result: resultParts.join("\n"),
          status: "success",
        };
      } catch (e) {
        const errorFields = getSandboxErrorFields(e);
        if (errorFields) {
          const errorResult =
            errorFields.result ?? errorFields.artifacts?.stdout;
          throw new Error(
            `Monitor dev server failed. Exit code: ${errorFields.exitCode}\nError: ${errorResult}`,
          );
        }

        throw e;
      }
    },
    createMonitorDevServerToolFields(state.targetRepository),
  );

  return monitorDevServerTool;
}
