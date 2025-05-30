import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { applyPatch } from "diff";
import { GraphState } from "../types.js";
import { readFile, writeFile } from "../utils/read-write.js";
import { getCurrentTaskInput } from "@langchain/langgraph";
import { fixGitPatch } from "../utils/diff.js";
import { createLogger, LogLevel } from "../utils/logger.js";
import { daytonaClient } from "../utils/sandbox.js";
import { SANDBOX_ROOT_DIR } from "../constants.js";

const logger = createLogger(LogLevel.INFO, "ApplyPatchTool");

const applyPatchToolSchema = z.object({
  diff: z
    .string()
    .describe(
      "The diff to apply. Use a standard diff format. Ensure this field is ALWAYS provided.",
    ),
  file_path: z.string().describe("The file path to apply the diff to."),
  workdir: z
    .string()
    .default(SANDBOX_ROOT_DIR)
    .describe(
      `The working directory for the command. Ensure this path is NOT included in any command arguments, as it will be added automatically. Defaults to '${SANDBOX_ROOT_DIR}' as this is the root directory of the sandbox.`,
    ),
});

export const applyPatchTool = tool(
  async (input): Promise<{ result: string; status: "success" | "error" }> => {
    const state = getCurrentTaskInput<GraphState>();
    const { sandboxSessionId } = state;
    if (!sandboxSessionId) {
      logger.error("FAILED TO RUN COMMAND: No sandbox session ID provided", {
        input,
      });
      throw new Error("FAILED TO RUN COMMAND: No sandbox session ID provided");
    }

    const { diff, file_path, workdir } = input;

    const sandbox = await daytonaClient().get(sandboxSessionId);

    const { success: readFileSuccess, output: readFileOutput } = await readFile(
      sandbox,
      file_path,
      {
        workDir: workdir,
      },
    );
    if (!readFileSuccess) {
      logger.error(readFileOutput);
      return {
        result: readFileOutput,
        status: "error",
      };
    }

    let patchedContent: string | false;
    let fixedDiff: string | false = false;
    let errorApplyingPatchMessage: string | undefined;
    try {
      logger.info(`Applying patch to file ${file_path}`);
      patchedContent = applyPatch(readFileOutput, diff);
    } catch (e) {
      errorApplyingPatchMessage = e instanceof Error ? e.message : undefined;
      try {
        logger.warn("Failed to apply patch, trying to fix diff", {
          error: e,
        });
        const fixedDiff_ = fixGitPatch(diff, {
          [file_path]: readFileOutput,
        });
        patchedContent = applyPatch(readFileOutput, fixedDiff_);
        logger.info("Successfully fixed diff and applied patch to file", {
          file_path,
        });
        if (patchedContent) {
          fixedDiff = fixedDiff_;
        }
      } catch (_) {
        logger.error("Failed to apply patch", {
          ...(e instanceof Error
            ? { name: e.name, message: e.message, stack: e.stack }
            : { error: e }),
        });
        const errMessage = e instanceof Error ? e.message : "Unknown error";
        return {
          result: `FAILED TO APPLY PATCH: The diff could not be applied to file '${file_path}'.\n\nError: ${errMessage}`,
          status: "error",
        };
      }
    }

    if (patchedContent === false) {
      logger.error(
        `FAILED TO APPLY PATCH: The diff could not be applied to file '${file_path}'. This may be due to an invalid diff format or conflicting changes with the file's current content. Original content length: ${readFileOutput.length}, Diff: ${diff.substring(0, 100)}...`,
      );
      return {
        result: `FAILED TO APPLY PATCH: The diff could not be applied to file '${file_path}'. This may be due to an invalid diff format or conflicting changes with the file's current content. Original content length: ${readFileOutput.length}, Diff: ${diff.substring(0, 100)}...`,
        status: "error",
      };
    }

    const { success: writeFileSuccess, output: writeFileOutput } =
      await writeFile(sandbox, file_path, patchedContent, {
        workDir: workdir,
      });
    if (!writeFileSuccess) {
      logger.error("Failed to write file", {
        writeFileOutput,
      });
      return {
        result: writeFileOutput,
        status: "error",
      };
    }

    let resultMessage = `Successfully applied diff to \`${file_path}\` and saved changes.`;
    logger.info(resultMessage);
    if (fixedDiff) {
      resultMessage +=
        "\n\nNOTE: The generated diff was NOT formatted properly, and had to be fixed." +
        `\nHere is the error that was thrown when your generated diff was applied:\n<apply-diff-error>\n${errorApplyingPatchMessage}\n</apply-diff-error>` +
        `\nThe diff which was applied is:\n<fixed-diff>\n${fixedDiff}\n</fixed-diff>`;
    }
    return {
      result: resultMessage,
      status: "success",
    };
  },
  {
    name: "apply_patch",
    description:
      "Applies a diff to a file given a file path and diff content. Ensure you ALWAYS pass a valid file path to this tool. The combination of `workdir` and `file_path` should point to a valid file in the sandbox. Ensure you do not omit parts of the path between `workdir` and `file_path`.",
    schema: applyPatchToolSchema,
  },
);
