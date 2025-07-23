import { NextRequest, NextResponse } from "next/server";
import { getInstallationToken } from "@/utils/github";
import { GITHUB_INSTALLATION_ID_COOKIE } from "@open-swe/shared/constants";

interface CloneTemplateRequest {
  name: string;
  description?: string;
  private: boolean;
}

interface GitHubTemplateResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
}

/**
 * API route to clone a repository from the bracesproul/typescript-template template
 * Uses GitHub's template repository generation API
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: CloneTemplateRequest = await request.json();
    const { name, description, private: isPrivate } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 },
      );
    }

    if (typeof isPrivate !== "boolean") {
      return NextResponse.json(
        { error: "Private field must be a boolean" },
        { status: 400 },
      );
    }

    // Get installation ID from cookies
    const installationIdCookie = request.cookies.get(
      GITHUB_INSTALLATION_ID_COOKIE,
    )?.value;

    if (!installationIdCookie) {
      return NextResponse.json(
        {
          error:
            "GitHub installation ID not found. Please install the app first.",
        },
        { status: 401 },
      );
    }

    // Get GitHub App credentials
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      return NextResponse.json(
        { error: "GitHub App configuration missing" },
        { status: 500 },
      );
    }

    // Get installation token
    const token = await getInstallationToken(
      installationIdCookie,
      appId,
      privateKey,
    );

    // Call GitHub API to create repository from template
    const response = await fetch(
      "https://api.github.com/repos/bracesproul/typescript-template/generate",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "OpenSWE-Agent",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description?.trim() || undefined,
          private: isPrivate,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        {
          error: "Failed to create repository from template",
          details: errorData.message || "Unknown error",
        },
        { status: response.status },
      );
    }

    const repositoryData: GitHubTemplateResponse = await response.json();

    // Return the created repository data
    return NextResponse.json({
      success: true,
      repository: {
        id: repositoryData.id,
        name: repositoryData.name,
        full_name: repositoryData.full_name,
        description: repositoryData.description,
        private: repositoryData.private,
        html_url: repositoryData.html_url,
        default_branch: repositoryData.default_branch,
      },
    });
  } catch (error) {
    console.error("Error cloning template repository:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to clone template repository", details: errorMessage },
      { status: 500 },
    );
  }
}
