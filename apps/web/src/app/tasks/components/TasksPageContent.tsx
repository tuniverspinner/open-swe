"use client";

import { TaskProvider } from "@/providers/Task";
import TasksPageHeader from "./TasksPageHeader";
import TasksTable from "./TasksTable";

export default function TasksPageContent() {
  return (
    <TaskProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <TasksPageHeader />
          <div className="mt-8">
            <TasksTable />
          </div>
        </div>
      </div>
    </TaskProvider>
  );
}
