import { NextRequest, NextResponse } from "next/server";
import { GITHUB_TOKEN_COOKIE } from "@open-swe/shared/constants";

/**
 * Fetches all GitHub App installations accessible to the authenticated user
 * This includes installations on their personal account and organizations they have access to
 */
export async function GET(request: NextRequest) {
  try {
    // Get the GitHub access token from cookies
    const accessToken = request.cookies.get(GITHUB_TOKEN_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: "GitHub access token not found" },
        { status: 401 },
      );
    }

    // Get GitHub App ID from environment variables
    const appId = process.env.GITHUB_APP_ID;

    if (!appId) {
      return NextResponse.json(
        { error: "GitHub App ID not configured" },
        { status: 500 },
      );
    }

    // Fetch installations accessible to the user
    const response = await fetch(`https://api.github.com/user/installations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "OpenSWE-Agent",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to fetch installations: ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();

    // Filter installations for our specific GitHub App
    const ourAppInstallations = data.installations.filter(
      (installation: any) => installation.app_id === parseInt(appId),
    );

    return NextResponse.json({
      installations: ourAppInstallations,
      total_count: ourAppInstallations.length,
    });
  } catch (error) {
    console.error("Error fetching GitHub App installations:", error);
    return NextResponse.json(
      { error: "Failed to fetch installations" },
      { status: 500 },
    );
  }
}
