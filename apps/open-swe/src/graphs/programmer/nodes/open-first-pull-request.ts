import { v4 as uuidv4 } from "uuid";
import {
  GraphConfig,
  GraphState,
  GraphUpdate,
} from "@open-swe/shared/open-swe/types";
import { createPullRequest } from "../../../utils/github/api.js";
import { createLogger, LogLevel } from "../../../utils/logger.js";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { getSandboxWithErrorHandling } from "../../../utils/sandbox.js";
import { getGitHubTokensFromConfig } from "../../../utils/github-tokens.js";
import { trackCachePerformance } from "../../../utils/caching.js";

const logger = createLogger(LogLevel.INFO, "Open First PR");

export async function openFirstPullRequest(
  state: GraphState,
  config: GraphConfig,
): Promise<GraphUpdate> {
  const { githubInstallationToken } = getGitHubTokensFromConfig(config);

  const { sandbox, codebaseTree, dependenciesInstalled } =
    await getSandboxWithErrorHandling(
      state.sandboxSessionId,
      state.targetRepository,
      state.branchName,
      config,
    );
  const sandboxSessionId = sandbox.id;

  const { owner, repo } = state.targetRepository;

  if (!owner || !repo) {
    throw new Error(
      "Failed to open first pull request: No target repository found in config.",
    );
  }

  const branchName = state.branchName;
  if (!branchName) {
    throw new Error(
      "Failed to open first pull request: No branch name found in state.",
    );
  }

  // Create a draft PR with a simple title and body
  const title = "Work in progress";
  const body = `Fixes #${state.githubIssueId}\n\nThis is a draft pull request that will be updated as work progresses.`;

  const pr = await createPullRequest({
    owner,
    repo,
    headBranch: branchName,
    title,
    body,
    githubInstallationToken,
    baseBranch: state.targetRepository.branch,
    draft: true, // Create as draft
  });

  const newMessages = [
    new AIMessage({
      content: pr
        ? `Created draft pull request: ${pr.html_url}`
        : "Failed to create draft pull request.",
      additional_kwargs: {
        // Required for the UI to render these fields.
        branch: branchName,
        targetBranch: state.targetRepository.branch,
      },
    }),
    new ToolMessage({
      id: uuidv4(),
      tool_call_id: uuidv4(),
      content: pr
        ? `Created draft pull request: ${pr.html_url}`
        : "Failed to create draft pull request.",
      name: "open_first_pr",
      additional_kwargs: {
        pull_request: pr,
      },
    }),
  ];

  return {
    messages: newMessages,
    internalMessages: newMessages,
    // Add the PR number to the pullRequestNumbers array
    pullRequestNumbers: pr ? [pr.number] : [],
