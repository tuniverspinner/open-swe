import { useGitHubApp } from "@/hooks/useGitHubApp";
import { useGitHubOrganizations } from "@/hooks/useGitHubOrganizations";
import { createContext, useContext, ReactNode, useEffect } from "react";
import type { UseGitHubOrganizationsReturn } from "@/hooks/useGitHubOrganizations";

type GitHubAppContextType = ReturnType<typeof useGitHubApp> & UseGitHubOrganizationsReturn;

const GitHubAppContext = createContext<GitHubAppContextType | undefined>(
  undefined,
);

export function GitHubAppProvider({ children }: { children: ReactNode }) {
  const gitHubAppValue = useGitHubApp();
  const organizationsValue = useGitHubOrganizations();

  // Automatically refresh repositories when installation changes
  useEffect(() => {
    if (organizationsValue.selectedInstallationId !== null) {
      gitHubAppValue.refreshRepositories();
    }
  }, [organizationsValue.selectedInstallationId, gitHubAppValue.refreshRepositories]);

  // Combine both hook values into a single context value
  const value: GitHubAppContextType = {
    ...gitHubAppValue,
    ...organizationsValue,
  };

  return (
    <GitHubAppContext.Provider value={value}>
      {children}
    </GitHubAppContext.Provider>
  );
}

export function useGitHubAppProvider() {
  const context = useContext(GitHubAppContext);
  if (context === undefined) {
    throw new Error(
      "useGitHubAppProvider must be used within a GitHubAppProvider",
    );
  }
  return context;
}

