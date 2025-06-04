"use client";

import { useEffect, useState } from "react";
import { TaskProvider, useTasks, TaskWithContext } from "@/providers/Task";
import { useTaskSearch } from "@/hooks/useTaskSearch";
import TasksPageHeader from "./TasksPageHeader";
import TasksStats from "./TasksStats";
import TasksFilters from "./TasksFilters";
import TasksTable from "./TasksTable";
import TaskEditModal from "./TaskEditModal";
import BulkActionsToolbar from "./BulkActionsToolbar";

function TasksPageWithData() {
  const { getAllTasks, allTasks, setAllTasks, tasksLoading, setTasksLoading } =
    useTasks();
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [editingTask, setEditingTask] = useState<TaskWithContext | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { filters, filteredTasks, filterOptions, updateFilter, clearFilters } =
    useTaskSearch(allTasks);

  // Fetch all tasks on component mount
  useEffect(() => {
    setTasksLoading(true);
    getAllTasks()
      .then(setAllTasks)
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, [getAllTasks, setAllTasks, setTasksLoading]);

  // Handle task creation
  const handleTaskCreated = () => {
    // Refresh tasks after creation
    getAllTasks().then(setAllTasks).catch(console.error);
  };

  // Handle task editing
  const handleEditTask = (task: TaskWithContext) => {
    setEditingTask(task);
    setEditModalOpen(true);
  };

  // Handle task updated
  const handleTaskUpdated = () => {
    // Refresh tasks after update
    getAllTasks().then(setAllTasks).catch(console.error);
  };

  // Handle bulk operations completed
  const handleBulkOperationsCompleted = () => {
    // Refresh tasks after bulk operations
    getAllTasks().then(setAllTasks).catch(console.error);
    setSelectedTasks([]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TasksPageHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(query: string) => updateFilter("searchQuery", query)}
          onTaskCreated={handleTaskCreated}
        />

        <div className="mt-8 space-y-6">
          {/* Statistics */}
          <TasksStats
            tasks={allTasks}
            filteredTasks={filteredTasks}
          />

          {/* Filters */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <TasksFilters
              filters={filters}
              filterOptions={{
                statuses: filterOptions.statuses,
                repositories: filterOptions.repositories.filter(
                  (repo): repo is string => repo !== undefined,
                ),
              }}
              updateFilter={updateFilter}
              clearFilters={clearFilters}
            />
          </div>

          {/* Bulk Actions Toolbar */}
          <BulkActionsToolbar
            selectedTasks={selectedTasks}
            allTasks={filteredTasks}
            onSelectionChange={setSelectedTasks}
            onTasksUpdated={handleBulkOperationsCompleted}
          />

          {/* Tasks Table */}
          <TasksTable
            tasks={filteredTasks}
            isLoading={tasksLoading}
            selectedTasks={selectedTasks}
            onSelectionChange={setSelectedTasks}
            onEditTask={handleEditTask}
          />
        </div>

        {/* Edit Task Modal */}
        <TaskEditModal
          task={editingTask}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onTaskUpdated={handleTaskUpdated}
        />
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
