import { Octokit } from "@octokit/rest";
import { Endpoints } from "@octokit/types";

export type GithubUser = Endpoints["GET /user"]["response"]["data"];

/**
 * Verifies a GitHub user access token.
 * @param accessToken The GitHub user access token.
 * @returns A promise that resolves with the user object if valid, otherwise undefined.
 */
export async function verifyGithubUser(
  accessToken: string,
): Promise<GithubUser | undefined> {
  if (!accessToken) {
    return undefined;
  }

  try {
    const octokit = new Octokit({ auth: accessToken });
    const { data: user } = await octokit.users.getAuthenticated();
    if (!user || !user.login) {
      return undefined;
    }
    return user;
  } catch {
    return undefined;
  }
}
