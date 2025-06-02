import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TargetRepository } from "../../../open-swe/src/types";
import { useGitHubApp } from "@/hooks/useGitHubApp";
import type { Repository } from "@/utils/github";
import { GitHubSVG } from "@/components/icons/github";

interface RepositorySelectorProps {
  disabled?: boolean;
  placeholder?: string;
}

// Convert GitHub Repository to TargetRepository
const repositoryToTarget = (repo: Repository): TargetRepository => {
  const [owner, repoName] = repo.full_name.split("/");
  return { owner, repo: repoName };
};

// Convert TargetRepository to Repository key
const targetToKey = (target: TargetRepository): string =>
  `${target.owner}/${target.repo}`;

export function RepositorySelector({
  disabled = false,
  placeholder = "Select a repository...",
}: RepositorySelectorProps) {
  const {
    repositories,
    selectedRepository,
    setSelectedRepository,
    isLoading,
    error,
    isInstalled,
  } = useGitHubApp();

  const handleValueChange = (repositoryKey: string) => {
    const repository = repositories.find(
      (repo) => repo.full_name === repositoryKey,
    );
    if (repository) {
      setSelectedRepository(repositoryToTarget(repository));
    }
  };

  const selectedValue = selectedRepository
    ? `${selectedRepository.owner}/${selectedRepository.repo}`
    : undefined;

  // Handle different states
  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Loading repositories..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Error loading repositories" />
        </SelectTrigger>
      </Select>
    );
  }

  if (isInstalled === false) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="GitHub App not installed" />
        </SelectTrigger>
      </Select>
    );
  }

  if (repositories.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="No repositories available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={selectedValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="max-w-[340px]">
        <GitHubSVG
          width="16"
          height="16"
        />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {repositories.map((repo) => {
          const key = repo.full_name;
          return (
            <SelectItem
              key={repo.id}
              value={key}
            >
              <div className="flex flex-col">
                <span className="font-medium">{repo.full_name}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
