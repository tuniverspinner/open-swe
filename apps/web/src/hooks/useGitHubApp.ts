import { useState, useEffect } from "react";
import { useQueryState } from "nuqs";
import { Repository } from "@/utils/github";
import type { TargetRepository } from "../../../open-swe/src/types";

interface UseGitHubAppReturn {
  isInstalled: boolean | null;
  isLoading: boolean;
  error: string | null;
  repositories: Repository[];
  refreshRepositories: () => Promise<void>;
  selectedRepository: TargetRepository | null;
  setSelectedRepository: (repo: TargetRepository | null) => void;
}

export function useGitHubApp(): UseGitHubAppReturn {
  const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepositoryParam, setSelectedRepositoryParam] =
    useQueryState("repo");

  const selectedRepository = selectedRepositoryParam
    ? (() => {
        try {
          const parts = selectedRepositoryParam.split("/");
          if (parts.length === 2) {
            return { owner: parts[0], repo: parts[1] } as TargetRepository;
          }
          return null;
        } catch {
          return null;
        }
      })()
    : null;

  const setSelectedRepository = (repo: TargetRepository | null) => {
    setSelectedRepositoryParam(repo ? `${repo.owner}/${repo.repo}` : null);
  };

  const checkInstallation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/github/repositories");

      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories || []);
        setIsInstalled(true);
      } else {
        const errorData = await response.json();
        if (errorData.error.includes("installation")) {
          setIsInstalled(false);
        } else {
          setError(errorData.error);
          setIsInstalled(false);
        }
      }
    } catch (err) {
      setError("Failed to check GitHub App installation status");
      setIsInstalled(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkInstallation();
  }, []);

  const refreshRepositories = async () => {
    await checkInstallation();
  };

  return {
    isInstalled,
    isLoading,
    error,
    repositories,
    refreshRepositories,
    selectedRepository,
    setSelectedRepository,
  };
}
