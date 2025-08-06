import { GraphConfig, GraphState, GraphUpdate } from "@open-swe/shared/open-swe/types";
import { addTokenDataToIssue } from "../../../utils/github/issue-task.js";
import { isLocalMode } from "@open-swe/shared/open-swe/local-mode";

export async function updateIssueTokenData(
  state: GraphState,
  config: GraphConfig,
): Promise<GraphUpdate> {
  // Skip token data update in local mode
  if (isLocalMode(config)) {
    return {};
  }

  // Skip if no token data to update
  if (!state.tokenData || state.tokenData.length === 0) {
    return {};
  }

  // Skip if no GitHub issue ID or target repository
  if (!state.githubIssueId || !state.targetRepository) {
    return {};
  }

  try {
    // Update the GitHub issue with the current token data
    await addTokenDataToIssue(
      {
        githubIssueId: state.githubIssueId,
        targetRepository: state.targetRepository,
      },
      config,
      state.tokenData,
    );
  } catch (error) {
    // Log error but don't fail the graph execution
    console.error("Failed to update token data in issue:", error);
  }

  return {};
}
