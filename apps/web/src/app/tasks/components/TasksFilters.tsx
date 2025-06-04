"use client";

import { X, Filter, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TaskFilters } from "@/hooks/useTaskSearch";

interface TasksFiltersProps {
  filters: TaskFilters;
  filterOptions: {
    statuses: string[];
    repositories: string[];
  };
  updateFilter: (key: keyof TaskFilters, value: any) => void;
  clearFilters: () => void;
}

export default function TasksFilters({
  filters,
  filterOptions,
  updateFilter,
  clearFilters,
}: TasksFiltersProps) {
  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.repository.length > 0 ||
    filters.searchQuery.length > 0;

  const handleStatusToggle = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    updateFilter("status", newStatus);
  };

  const handleRepositoryToggle = (repository: string) => {
    const newRepository = filters.repository.includes(repository)
      ? filters.repository.filter((r) => r !== repository)
      : [...filters.repository, repository];
    updateFilter("repository", newRepository);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done":
        return "bg-green-100 text-green-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "interrupted":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 ${filters.status.length > 0 ? "border-blue-200 bg-blue-50" : ""}`}
          >
            <Filter className="mr-2 h-3 w-3" />
            Status
            {filters.status.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-4 px-1 text-xs"
              >
                {filters.status.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56"
          align="start"
        >
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Filter by Status</h4>
            {filterOptions.statuses.map((status) => (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                className={`h-8 w-full justify-start ${
                  filters.status.includes(status) ? "bg-blue-50" : ""
                }`}
                onClick={() => handleStatusToggle(status)}
              >
                <div className="flex w-full items-center justify-between">
                  <Badge className={`${getStatusColor(status)}`}>
                    {status}
                  </Badge>
                  {filters.status.includes(status) && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </div>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Repository Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 ${filters.repository.length > 0 ? "border-blue-200 bg-blue-50" : ""}`}
          >
            <Filter className="mr-2 h-3 w-3" />
            Repository
            {filters.repository.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-4 px-1 text-xs"
              >
                {filters.repository.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64"
          align="start"
        >
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Filter by Repository</h4>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {filterOptions.repositories.map((repository) => (
                <Button
                  key={repository}
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-full justify-start ${
                    filters.repository.includes(repository) ? "bg-blue-50" : ""
                  }`}
                  onClick={() => handleRepositoryToggle(repository)}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate text-sm">{repository}</span>
                    {filters.repository.includes(repository) && (
                      <Check className="ml-2 h-4 w-4 text-blue-600" />
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground h-8 px-2"
        >
          <X className="mr-1 h-3 w-3" />
          Clear
        </Button>
      )}

      {/* Active Filter Tags */}
      <div className="flex flex-wrap gap-1">
        {filters.status.map((status) => (
          <Badge
            key={`status-${status}`}
            variant="secondary"
            className="h-6 text-xs"
          >
            {status}
            <button
              onClick={() => handleStatusToggle(status)}
              className="ml-1 rounded-full hover:bg-gray-200"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {filters.repository.map((repository) => (
          <Badge
            key={`repo-${repository}`}
            variant="secondary"
            className="h-6 text-xs"
          >
            {repository}
            <button
              onClick={() => handleRepositoryToggle(repository)}
              className="ml-1 rounded-full hover:bg-gray-200"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
