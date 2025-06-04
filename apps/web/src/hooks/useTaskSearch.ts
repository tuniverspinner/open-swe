import { useState, useMemo } from "react";
import { TaskWithContext } from "@/providers/Task";

export interface TaskFilters {
  status: string[];
  repository: string[];
  searchQuery: string;
}

export const useTaskSearch = (tasks: TaskWithContext[]) => {
  const [filters, setFilters] = useState<TaskFilters>({
    status: [],
    repository: [],
    searchQuery: "",
  });

  // Filter and search tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesSearch =
          task.plan.toLowerCase().includes(query) ||
          task.summary?.toLowerCase().includes(query) ||
          task.repository?.toLowerCase().includes(query) ||
          task.threadTitle?.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(task.status)) {
        return false;
      }

      // Repository filter
      if (
        filters.repository.length > 0 &&
        !filters.repository.includes(task.repository || "")
      ) {
        return false;
      }

      return true;
    });
  }, [tasks, filters]);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const statuses = [...new Set(tasks.map((task) => task.status))];
    const repositories = [
      ...new Set(tasks.map((task) => task.repository).filter(Boolean)),
    ];

    return {
      statuses,
      repositories,
    };
  }, [tasks]);

  // Update specific filter
  const updateFilter = (key: keyof TaskFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: [],
      repository: [],
      searchQuery: "",
    });
  };

  return {
    filters,
    filteredTasks,
    filterOptions,
    updateFilter,
    clearFilters,
  };
};
