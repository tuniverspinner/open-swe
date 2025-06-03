"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  Pause,
  Loader2,
  Archive,
  Plus,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: string;
  title: string;
  status: "running" | "interrupted" | "done" | "error";
  date: string;
  repository: string;
  additions?: number;
  deletions?: number;
}

const tasks: Task[] = [
  {
    id: "1",
    title: "Identify and propose code improvements",
    status: "running",
    date: "May 30",
    repository: "langchain-ai/open_deep_research",
  },
  {
    id: "2",
    title: "Explain codebase to newcomer",
    status: "interrupted",
    date: "May 30",
    repository: "langchain-ai/open_deep_research",
  },
  {
    id: "3",
    title: "Find and fix important bug",
    status: "done",
    date: "May 30",
    repository: "langchain-ai/open_deep_research",
    additions: 6,
    deletions: 3,
  },
  {
    id: "4",
    title: "Optimize database queries",
    status: "error",
    date: "May 29",
    repository: "langchain-ai/open_deep_research",
  },
];

const StatusIndicator = ({ status }: { status: Task["status"] }) => {
  switch (status) {
    case "running":
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case "interrupted":
      return <Pause className="h-3 w-3 text-yellow-500" />;
    case "done":
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-500" />;
    default:
      return null;
  }
};

const TaskItem = ({ task }: { task: Task }) => {
  return (
    <div className="group flex items-start gap-3 border-b border-gray-100 py-3 last:border-b-0">
      <div className="mt-1 flex-shrink-0">
        <StatusIndicator status={task.status} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-medium text-gray-900">
              {task.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{task.date}</span>
              <span>·</span>
              <span>{task.repository}</span>
            </div>
          </div>

          <div className="ml-4 flex items-center gap-2">
            {task.status === "interrupted" && (
              <Archive className="h-4 w-4 text-gray-400" />
            )}

            {task.additions !== undefined && task.deletions !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                <span className="flex items-center gap-0.5 text-green-600">
                  <Plus className="h-3 w-3" />
                  {task.additions}
                </span>
                <span className="flex items-center gap-0.5 text-red-600">
                  <Minus className="h-3 w-3" />
                  {task.deletions}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function TaskList() {
  return (
    <div className="mx-auto mb-4 w-1/2 items-center justify-center p-4">
      <Tabs
        defaultValue="tasks"
        className="w-full"
      >
        <TabsList className="grid h-auto w-fit grid-cols-2 bg-transparent p-0">
          <TabsTrigger
            value="tasks"
            className="px-0 pb-3 font-medium data-[state=active]:rounded-none data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Tasks
          </TabsTrigger>
          <TabsTrigger
            value="archive"
            disabled
            className="ml-6 px-0 pb-3 font-medium text-gray-500 data-[state=active]:rounded-none data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Plan{" "}
            <Badge
              variant="outline"
              className="text-xs"
            >
              {" "}
              Coming Soon{" "}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <div className="mb-6 border-b border-gray-200"></div>

        <TabsContent
          value="tasks"
          className="mt-0"
        >
          <div className="space-y-0">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="archive"
          className="mt-0"
        >
          <div className="py-12 text-center text-gray-500">
            <Archive className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No archived tasks</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
