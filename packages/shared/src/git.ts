import { SANDBOX_ROOT_DIR } from "./constants.js";
import { TargetRepository } from "./open-swe/types.js";

export function getRepoAbsolutePath(
  targetRepository: TargetRepository,
): string {
  const repoName = targetRepository.repo;
  if (!repoName) {
    throw new Error("No repository name provided");
  }

  // In local mode, use the current working directory instead of sandbox path
  if (targetRepository.owner === "local" && repoName === "project") {
    return process.env.OPEN_SWE_PROJECT_PATH || process.cwd();
  }

  return `${SANDBOX_ROOT_DIR}/${repoName}`;
}
