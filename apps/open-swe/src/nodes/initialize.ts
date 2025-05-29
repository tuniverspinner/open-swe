import { Daytona, Sandbox } from '@daytonaio/sdk'
import { createLogger, LogLevel } from "../utils/logger.js";
import {
  GraphState,
  GraphConfig,
  GraphUpdate,
  TargetRepository,
} from "../types.js";
import { TIMEOUT_EXTENSION_OPT } from "../constants.js";
import {
  checkoutBranch,
  configureGitUserInRepo,
  getBranchName,
  getGitUserDetailsFromGitHub,
  getRepoAbsolutePath,
} from "../utils/git/index.js";
import { getSandboxErrorFields } from "../utils/sandbox-error-fields.js";

const logger = createLogger(LogLevel.INFO, "Initialize");

// const SANDBOX_TEMPLATE_ID = "eh0860emqx28qyxmbctu";
const SANDBOX_USER = "agent";

async function cloneRepo(sandbox: Sandbox, targetRepository: TargetRepository) {
  if (!process.env.GITHUB_PAT) {
    throw new Error("GITHUB_PAT environment variable not set.");
  }

  const userDetails = await getGitUserDetailsFromGitHub();

  try {
    const repoUrlWithToken = `https://${process.env.GITHUB_PAT}@github.com/${targetRepository.owner}/${targetRepository.repo}.git`;

    logger.info("Cloning repository", {
      repo: `${targetRepository.owner}/${targetRepository.repo}`,
    });
    await sandbox.git.clone(repoUrlWithToken, `${SANDBOX_USER}/${targetRepository.repo}`, targetRepository.branch, userDetails.userName, process.env.GITHUB_PAT);
  } catch (e) {
    const errorFields = getSandboxErrorFields(e);
    logger.error("Failed to clone repository", errorFields ?? e);
    throw e;
  }
}

/**
 * Initializes the session. This ensures there's an active VM session, and that
 * the proper credentials are provided for taking actions on GitHub.
 * It also clones the repository the user has specified to be used, and an optional
 * branch.
 */
export async function initialize(
  state: GraphState,
  config: GraphConfig,
): Promise<GraphUpdate> {
  if (!config.configurable) {
    throw new Error("Configuration object not found.");
  }
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error("DAYTONA_API_KEY environment variable not set.");
  }
  const { sandboxSessionId } = state;
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY,
  })

  if (sandboxSessionId) {
    try {
      logger.info("Sandbox session ID exists. Resuming", {
        sandboxSessionId,
      });
      // Resume the sandbox if the session ID is in the config.
      const newSandbox = await Sandbox.resume(
        sandboxSessionId,
        TIMEOUT_EXTENSION_OPT,
      );
      return {
        sandboxSessionId: newSandbox.sandboxId,
      };
    } catch (e) {
      // Error thrown, log it and continue. Will create a new sandbox session since the resumption failed.
      logger.error("Failed to get sandbox session", e);
    }
  }

  const { target_repository } = config.configurable;

  if (!target_repository) {
    throw new Error(
      "Missing required configuration. Please provide a git repository URL.",
    );
  }

  logger.info("Creating sandbox...");
  await daytona.start
  const sandbox = await daytona.create(
    {
      user: "agent"
    }
    // SANDBOX_TEMPLATE_ID,
    // TIMEOUT_EXTENSION_OPT,
  );

  const res = await sandbox.process.executeCommand

  const res = await cloneRepo(sandbox, target_repository);
  if (res.error) {
    // TODO: This should probably be an interrupt.
    logger.error("Failed to clone repository", res.error);
    throw new Error(`Failed to clone repository.\n${res.error}`);
  }
  logger.info("Repository cloned successfully.");

  const absoluteRepoDir = getRepoAbsolutePath(config);

  logger.info(`Configuring git user for repository at "${absoluteRepoDir}"...`);
  await configureGitUserInRepo(absoluteRepoDir, sandbox);
  logger.info("Git user configured successfully.");

  const checkoutBranchRes = await checkoutBranch(
    absoluteRepoDir,
    state.branchName || getBranchName(config),
    sandbox,
  );

  if (!checkoutBranchRes) {
    // TODO: This should probably be an interrupt.
    logger.error("Failed to checkout branch.");
    throw new Error("Failed to checkout branch");
  }

  return {
    sandboxSessionId: sandbox.sandboxId,
  };
}
