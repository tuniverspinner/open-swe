"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Task, type Task as TaskType } from "./task";

const tasks: TaskType[] = [
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
              <Task
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
