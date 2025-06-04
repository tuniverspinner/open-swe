"use client";

import { useEffect } from "react";
import { TaskProvider, useTasks } from "@/providers/Task";
import { useTaskSearch } from "@/hooks/useTaskSearch";
import TasksPageHeader from "./TasksPageHeader";
import TasksStats from "./TasksStats";
import TasksFilters from "./TasksFilters";
import TasksTable from "./TasksTable";

function TasksPageWithData() {
  const { getAllTasks, allTasks, setAllTasks, tasksLoading, setTasksLoading } = useTasks();
  const { 
    filters, 
    filteredTasks, 
    filterOptions, 
    updateFilter, 
    clearFilters 
  } = useTaskSearch(allTasks);

  // Fetch all tasks on component mount
  useEffect(() => {
    setTasksLoading(true);
    getAllTasks()
      .then(setAllTasks)
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, [getAllTasks, setAllTasks, setTasksLoading]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TasksPageHeader 
          searchQuery={filters.searchQuery}
          onSearchChange={(query: string) => updateFilter('searchQuery', query)}
        />
        
        <div className="mt-8 space-y-6">
          {/* Statistics */}
          <TasksStats 
            tasks={allTasks}
            filteredTasks={filteredTasks}
          />
          
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <TasksFilters
              filters={filters}
              filterOptions={{
                statuses: filterOptions.statuses,
                repositories: filterOptions.repositories.filter((repo): repo is string => repo !== undefined),
              }}
              updateFilter={updateFilter}
              clearFilters={clearFilters}
            />
          </div>
          
          {/* Tasks Table */}
          <TasksTable 
            tasks={filteredTasks}
            isLoading={tasksLoading}
          />
        </div>
      </div>
    </div>
  );
}

export default function TasksPageContent() {
  return (
    <TaskProvider>
      <TasksPageWithData />
    </TaskProvider>
  );
}
