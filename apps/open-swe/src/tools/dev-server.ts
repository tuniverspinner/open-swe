import { tool } from "@langchain/core/tools";
import { createLogger, LogLevel } from "../utils/logger.js";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { getSandboxErrorFields } from "../utils/sandbox-error-fields.js";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import { createDevServerToolFields } from "@open-swe/shared/open-swe/tools";
import { getSandboxSessionOrThrow } from "./utils/get-sandbox-id.js";
import { sleep } from "../utils/sleep.js";

const DEFAULT_ENV = {
  // Prevents corepack from showing a y/n download prompt which causes the command to hang
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

const logger = createLogger(LogLevel.INFO, "DevServerTool");

export function createDevServerTool(
  state: Pick<GraphState, "sandboxSessionId" | "targetRepository">,
) {
  const devServerTool = tool(
    async (input): Promise<{ result: string; status: "success" | "error" }> => {
      const sandbox = await getSandboxSessionOrThrow(input);
      const sessionId = `dev-server-${Date.now()}`;
      try {
        const {
          serverConfig: { command, workdir: serverWorkdir },
          requestConfig: { testCommand, workdir: requestWorkdir, waitTime },
        } = input;

        logger.info("Starting dev server", {
          command: command.join(" "),
          serverWorkdir,
          testCommand,
          requestWorkdir,
          waitTime,
          sessionId,
        });

        await sandbox.process.createSession(sessionId);

        const startResponse = await sandbox.process.executeSessionCommand(
          sessionId,
          {
            command: `cd ${serverWorkdir} && ${command.join(" ")}`,
            runAsync: true,
          },
        );

        if (!startResponse.cmdId) {
          throw new Error("Failed to start dev server");
        }

        await sleep(waitTime * 1000);

        logger.info(`Sending test request: ${testCommand.join(" ")}`);

        const testResponse = await sandbox.process.executeCommand(
          testCommand.join(" "),
          requestWorkdir,
          DEFAULT_ENV,
          TIMEOUT_SEC,
        );

        const logsResponse = await sandbox.process.getSessionCommandLogs(
          sessionId,
          startResponse.cmdId,
        );
        logger.info(`Logs retrieved:`, { logsLength: logsResponse.length });

        await sandbox.process.deleteSession(sessionId);

        const resultParts = [];
        resultParts.push("<run_dev_server_results>");
        resultParts.push(`<command>${command.join(" ")}</command>`);
        resultParts.push(`<request>${testCommand.join(" ")}</request>`);
        resultParts.push("");
        resultParts.push("<request_response>");
        resultParts.push(
          testResponse.result || `Exit code: ${testResponse.exitCode}`,
        );
        resultParts.push("</request_response>");
        resultParts.push("");
        resultParts.push("<server_logs>");
        resultParts.push(logsResponse);
        resultParts.push("</server_logs>");
        resultParts.push("</run_dev_server_results>");

        logger.info("Monitor dev server completed", {
          sessionId,
          responseExitCode: testResponse.exitCode,
          logsLength: logsResponse.length,
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
    createDevServerToolFields(state.targetRepository),
  );

  return devServerTool;
}
