import { Octokit } from "@octokit/rest";
import { Sandbox } from "@daytonaio/sdk";
import { createLogger, LogLevel } from "../logger.js";
import { GraphConfig, TargetRepository } from "../../types.js";
import { TIMEOUT_MS, SANDBOX_ROOT_DIR } from "../../constants.js";
import { getSandboxErrorFields } from "../sandbox-error-fields.js";
import { ExecuteResponse } from "@daytonaio/sdk/dist/types/ExecuteResponse.js";

const logger = createLogger(LogLevel.INFO, "GitUtil");

export function getRepoAbsolutePath(
  targetRepository: TargetRepository,
): string {
  const repoName = targetRepository.repo;
  if (!repoName) {
    throw new Error("No repository name provided");
  }

  return `${SANDBOX_ROOT_DIR}/${repoName}`;
}

export function getBranchName(config: GraphConfig): string {
  const threadId = config.configurable?.thread_id;
  if (!threadId) {
    throw new Error("No thread ID provided");
  }

  return `open-swe/${threadId}`;
}

export async function checkoutBranch(
  absoluteRepoDir: string,
  branchName: string,
  sandbox: Sandbox,
): Promise<ExecuteResponse | false> {
  logger.info(`Checking out branch '${branchName}'...`);

  try {
    const getCurrentBranchOutput = await sandbox.process.executeCommand(
      "git branch --show-current",
      absoluteRepoDir,
      undefined,
      TIMEOUT_MS,
    );

    if (getCurrentBranchOutput.exitCode !== 0) {
      logger.error(`Failed to get current branch`, {
        getCurrentBranchOutput,
      });
    } else {
      const currentBranch = getCurrentBranchOutput.result.trim();
      if (currentBranch === branchName) {
        logger.info(`Already on branch '${branchName}'. No checkout needed.`);
        return {
          result: `Already on branch ${branchName}`,
          exitCode: 0,
        };
      }
    }
  } catch (e) {
    const errorFields = getSandboxErrorFields(e);
    logger.error(`Failed to get current branch`, {
      ...(errorFields && { errorFields }),
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return false;
  }

  let checkoutCommand: string;
  try {
    logger.info(
      `Checking if branch 'refs/heads/${branchName}' exists using 'git rev-parse --verify --quiet'`,
    );
    // Check if branch exists using git rev-parse for robustness
    const checkBranchExistsOutput = await sandbox.process.executeCommand(
      `git rev-parse --verify --quiet "refs/heads/${branchName}"`,
      absoluteRepoDir,
      undefined,
      TIMEOUT_MS,
    );

    if (checkBranchExistsOutput.exitCode === 0) {
      // Branch exists (rev-parse exit code 0 means success)
      checkoutCommand = `git checkout "${branchName}"`;
    } else {
      // Branch does not exist (rev-parse non-zero exit code) or other error.
      // Attempt to create it.
      checkoutCommand = `git checkout -b "${branchName}"`;
    }
  } catch (e: unknown) {
    const errorFields = getSandboxErrorFields(e);
    if (
      errorFields &&
      errorFields.exitCode === 1 &&
      errorFields.result === ""
    ) {
      checkoutCommand = `git checkout -b "${branchName}"`;
    } else {
      logger.error(`Error checking if branch exists`, {
        ...(e instanceof Error && {
          name: e.name,
          message: e.message,
          stack: e.stack,
        }),
      });
      return false;
    }
  }

  try {
    const gitCheckoutOutput = await sandbox.process.executeCommand(
      checkoutCommand,
      absoluteRepoDir,
      undefined,
      TIMEOUT_MS,
    );

    if (gitCheckoutOutput.exitCode !== 0) {
      logger.error(`Failed to checkout branch`, {
        gitCheckoutOutput,
      });
      return false;
    }

    logger.info(`Checked out branch '${branchName}' successfully.`, {
      gitCheckoutOutput,
    });

    return gitCheckoutOutput;
  } catch (e) {
    const errorFields = getSandboxErrorFields(e);
    logger.error(`Error checking out branch`, {
      ...(errorFields && { errorFields }),
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return false;
  }
}

interface GitHubUserResponse {
  login: string;
  id: number;
  name: string | null;
  email: string | null;
}

async function getGitUserDetailsFromGitHub(): Promise<{
  userName?: string;
  userEmail?: string;
}> {
  const githubToken = process.env.GITHUB_PAT;
  if (!githubToken) {
    logger.warn(
      "GITHUB_PAT environment variable is not set. Cannot fetch user details from GitHub.",
    );
    return {};
  }

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      logger.error(`Failed to fetch GitHub user info`, {
        response,
      });
      return {};
    }

    const userData = (await response.json()) as GitHubUserResponse;
    const fetchedUserName = userData.name || userData.login;
    let fetchedUserEmail = userData.email; // This can be string | null

    if (!fetchedUserEmail && userData.id && userData.login) {
      fetchedUserEmail = `${userData.id}+${userData.login}@users.noreply.github.com`;
    } else if (!fetchedUserEmail && userData.login) {
      fetchedUserEmail = `${userData.login}@users.noreply.github.com`;
    }

    const finalUserName = fetchedUserName || undefined;
    const finalUserEmail = fetchedUserEmail || undefined;

    if (!finalUserName) {
      logger.warn("Could not determine GitHub username from API response.");
    }
    if (!finalUserEmail) {
      logger.warn("Could not determine GitHub user email from API response.");
    }
    return { userName: finalUserName, userEmail: finalUserEmail };
  } catch (e) {
    logger.error(`Error fetching GitHub user info`, {
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return {};
  }
}

export async function configureGitUserInRepo(
  absoluteRepoDir: string,
  sandbox: Sandbox,
): Promise<void> {
  let needsGitConfig = false;
  try {
    const nameCheck = await sandbox.process.executeCommand(
      "git config user.name",
      absoluteRepoDir,
      undefined,
      TIMEOUT_MS,
    );
    const emailCheck = await sandbox.process.executeCommand(
      "git config user.email",
      absoluteRepoDir,
      undefined,
      TIMEOUT_MS,
    );

    if (
      nameCheck.exitCode !== 0 ||
      nameCheck.result.trim() === "" ||
      emailCheck.exitCode !== 0 ||
      emailCheck.result.trim() === ""
    ) {
      needsGitConfig = true;
    }
  } catch (checkError) {
    logger.warn(`Could not check existing git config, will attempt to set it`, {
      ...(checkError instanceof Error && {
        name: checkError.name,
        message: checkError.message,
        stack: checkError.stack,
      }),
    });
    needsGitConfig = true;
  }

  if (needsGitConfig) {
    const { userName, userEmail } = await getGitUserDetailsFromGitHub();

    if (userName) {
      const configUserNameOutput = await sandbox.process.executeCommand(
        `git config user.name "${userName}"`,
        absoluteRepoDir,
        undefined,
        TIMEOUT_MS,
      );
      if (configUserNameOutput.exitCode !== 0) {
        logger.error(`Failed to set git user.name`, {
          configUserNameOutput,
        });
      } else {
        logger.info(`Set git user.name to '${userName}' successfully.`);
      }
    }

    if (userEmail) {
      const configUserEmailOutput = await sandbox.process.executeCommand(
        `git config user.email "${userEmail}"`,
        absoluteRepoDir,
        undefined,
        TIMEOUT_MS,
      );
      if (configUserEmailOutput.exitCode !== 0) {
        logger.error(`Failed to set git user.email`, {
          configUserEmailOutput,
        });
      } else {
        logger.info(`Set git user.email to '${userEmail}' successfully.`);
      }
    }
  } else {
    logger.info(
      "Git user.name and user.email are already configured in this repository.",
    );
  }
}

export async function commitAll(
  absoluteRepoDir: string,
  message: string,
  sandbox: Sandbox,
): Promise<ExecuteResponse | false> {
  try {
    const gitAddOutput = await sandbox.process.executeCommand(
      `git add -A && git commit -m "${message}"`,
      absoluteRepoDir,
      undefined,
      TIMEOUT_MS,
    );

    if (gitAddOutput.exitCode !== 0) {
      logger.error(`Failed to commit all changes to git repository`, {
        gitAddOutput,
      });
    }
    return gitAddOutput;
  } catch (e) {
    const errorFields = getSandboxErrorFields(e);
    logger.error(`Failed to commit all changes to git repository`, {
      ...(errorFields && { errorFields }),
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return false;
  }
}

export async function commitAllAndPush(
  absoluteRepoDir: string,
  message: string,
  sandbox: Sandbox,
): Promise<ExecuteResponse | false> {
  try {
    const commitOutput = await commitAll(absoluteRepoDir, message, sandbox);

    const pushCurrentBranchCmd =
      "git push -u origin $(git rev-parse --abbrev-ref HEAD)";

    if (!commitOutput || commitOutput.exitCode !== 0) {
      return false;
    }

    const gitPushOutput = await sandbox.process.executeCommand(
      pushCurrentBranchCmd,
      absoluteRepoDir,
      undefined,
      TIMEOUT_MS,
    );

    if (gitPushOutput.exitCode !== 0) {
      logger.error(`Failed to push changes to git repository`, {
        gitPushOutput,
      });
      return false;
    }

    return gitPushOutput;
  } catch (e) {
    const errorFields = getSandboxErrorFields(e);
    logger.error(`Failed to commit all and push changes to git repository`, {
      ...(errorFields && { errorFields }),
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return false;
  }
}

export async function getChangedFilesStatus(
  absoluteRepoDir: string,
  sandbox: Sandbox,
): Promise<string[]> {
  const gitStatusOutput = await sandbox.process.executeCommand(
    "git status --porcelain",
    absoluteRepoDir,
    undefined,
    TIMEOUT_MS,
  );

  if (gitStatusOutput.exitCode !== 0) {
    logger.error(`Failed to get changed files status`, {
      gitStatusOutput,
    });
    return [];
  }

  return gitStatusOutput.result
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export async function checkoutBranchAndCommit(
  config: GraphConfig,
  targetRepository: TargetRepository,
  sandbox: Sandbox,
  options?: {
    branchName?: string;
  },
): Promise<string> {
  logger.info("Checking out branch and committing changes...");
  const absoluteRepoDir = getRepoAbsolutePath(targetRepository);
  const branchName = options?.branchName || getBranchName(config);

  await checkoutBranch(absoluteRepoDir, branchName, sandbox);

  logger.info(`Committing changes to branch ${branchName}`);
  await commitAllAndPush(absoluteRepoDir, "Apply patch", sandbox);
  logger.info("Successfully checked out & committed changes.");

  return branchName;
}

export async function createPullRequest({
  owner,
  repo,
  headBranch,
  title,
  body = "",
}: {
  owner: string;
  repo: string;
  headBranch: string;
  title: string;
  body?: string;
}) {
  // Initialize Octokit with the personal access token
  const token = process.env.GITHUB_PAT;
  if (!token) {
    throw new Error("GITHUB_PAT environment variable is not set");
  }

  const octokit = new Octokit({
    auth: token,
  });

  try {
    // Step 1: Get repository information to find the default branch
    const { data: repository } = await octokit.repos.get({
      owner,
      repo,
    });

    const defaultBranch = repository.default_branch;
    logger.info(
      `Creating pull request against default branch: ${defaultBranch}`,
    );

    // Step 2: Create the pull request
    const { data: pullRequest } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head: headBranch,
      base: defaultBranch,
    });

    logger.info(`🐙 Pull request created: ${pullRequest.html_url}`);
    return pullRequest;
  } catch (error) {
    logger.error(`Failed to create pull request`, {
      error,
    });
    return null;
  }
}

export async function pullLatestChanges(
  absoluteRepoDir: string,
  sandbox: Sandbox,
): Promise<ExecuteResponse | false> {
  try {
    const gitPullOutput = await sandbox.process.executeCommand(
      "git pull",
      absoluteRepoDir,
      undefined,
      TIMEOUT_MS,
    );
    return gitPullOutput;
  } catch (e) {
    const errorFields = getSandboxErrorFields(e);
    logger.error(`Failed to pull latest changes`, {
      ...(errorFields && { errorFields }),
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return false;
  }
}
