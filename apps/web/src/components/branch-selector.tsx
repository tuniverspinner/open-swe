import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGitHubApp } from "@/hooks/useGitHubApp";
import { GitBranch, Shield } from "lucide-react";

interface BranchSelectorProps {
  disabled?: boolean;
  placeholder?: string;
}

export function BranchSelector({
  disabled = false,
  placeholder = "Select a branch...",
}: BranchSelectorProps) {
  const {
    branches,
    branchesLoading,
    branchesError,
    selectedBranch,
    setSelectedBranch,
    selectedRepository,
  } = useGitHubApp();

  const handleValueChange = (branchName: string) => {
    setSelectedBranch(branchName);
  };

  // Handle different states
  if (!selectedRepository) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select a repository first" />
        </SelectTrigger>
      </Select>
    );
  }

  if (branchesLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Loading branches..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (branchesError) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Error loading branches" />
        </SelectTrigger>
      </Select>
    );
  }

  if (branches.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="No branches available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select
      value={selectedBranch || ""}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="max-w-[340px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem
            key={branch.name}
            value={branch.name}
          >
            <div className="flex items-center gap-2">
              <GitBranch className="h-3 w-3" />
              <span className="font-medium">{branch.name}</span>
              {branch.protected && (
                <div title="Protected branch">
                  <Shield className="h-3 w-3 text-amber-500" />
                </div>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
