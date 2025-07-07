import { NextRequest, NextResponse } from "next/server";
import { GITHUB_TOKEN_COOKIE } from "@open-swe/shared/constants";

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    id: number;
    avatar_url: string;
    type: "User" | "Organization";
  };
  app_id: number;
  target_type: string;
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
  updated_at: string;
  single_file_name: string | null;
  has_multiple_single_files: boolean;
  single_file_paths: string[];
  app_slug: string;
  target_id: number;
  suspended_by: any;
  suspended_at: string | null;
}

export interface GitHubInstallationsResponse {
  total_count: number;
  installations: GitHubInstallation[];
}

/**
 * Fetches GitHub App installations accessible to the authenticated user
 * Uses the user's access token to call GET /user/installations
 * Returns installation details including account info (org/user name, type, avatar)
 */
export async function GET(request: NextRequest) {
  try {
    // Get the user's access token from cookies
    const accessToken = request.cookies.get(GITHUB_TOKEN_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "GitHub access token not found. Please authenticate first.",
        },
        { status: 401 },
      );
    }

    // Fetch user's accessible GitHub App installations
    const response = await fetch("https://api.github.com/user/installations", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "OpenSWE-Agent",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to fetch GitHub installations:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch GitHub installations" },
        { status: response.status },
      );
    }

    const data: GitHubInstallationsResponse = await response.json();

    // Return the installations with account details
    return NextResponse.json({
      total_count: data.total_count,
      installations: data.installations.map((installation) => ({
        id: installation.id,
        account: installation.account,
        app_id: installation.app_id,
        target_type: installation.target_type,
        created_at: installation.created_at,
        updated_at: installation.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching GitHub installations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

