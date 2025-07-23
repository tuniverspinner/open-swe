import { NextRequest, NextResponse } from "next/server";
import { GITHUB_TOKEN_COOKIE } from "@open-swe/shared/constants";
import {
  CloneTemplateRequest,
  CloneTemplateResponse,
  GitHubTemplateResponse,
} from "./types";

/**
 * API route to clone a repository from the bracesproul/typescript-template template
 * Uses GitHub's template repository generation API
 */
export async function POST(request: NextRequest) {
  try {
    const body: CloneTemplateRequest = await request.json();
    const { template, newRepo } = body;

    if (
      !newRepo.name ||
      typeof newRepo.name !== "string" ||
      newRepo.name.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 },
      );
    }

    if (typeof newRepo.private !== "boolean") {
      return NextResponse.json(
        { error: "Private field must be a boolean" },
        { status: 400 },
      );
    }

    const token = request.cookies.get(GITHUB_TOKEN_COOKIE)?.value ?? "";

    if (!token) {
      throw new Error(
        "No GitHub access token found. User must authenticate first.",
      );
    }

    const response = await fetch(
      `https://api.github.com/repos/${template.owner}/${template.repo}/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "OpenSWE-Agent",
        },
        body: JSON.stringify({
          owner: newRepo.owner,
          name: newRepo.name.trim(),
          description: newRepo.description?.trim() || undefined,
          private: newRepo.private,
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

    const cloneTemplateResponse: CloneTemplateResponse = {
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
    };

    return NextResponse.json(cloneTemplateResponse);
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
