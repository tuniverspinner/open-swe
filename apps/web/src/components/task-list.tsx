"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStreamContext } from "@/providers/Stream";
import { 
  Task, 
  type TaskWithStatus, 
  type PlanItem,
  getCurrentTask,
  computeTaskStatus 
} from "./task";

export default function TaskList() {
  const stream = useStreamContext();
  
  // Get plan data from stream - it might be in values or directly accessible
  // We need to check multiple potential locations for plan data
  const streamValues = stream.values as any; // Type assertion for now since plan isn't in StateType
  const plan: PlanItem[] = streamValues?.plan || [];
  const isLoading = stream.isLoading;
  const hasError = !!stream.error;
  const hasInterrupt = !!stream.interrupt;
  
  // Get current task
  const currentTask = getCurrentTask(plan);
  
  // Transform plan items to tasks with computed status
  const tasks: TaskWithStatus[] = plan.map((planItem) => ({
    ...planItem,
    status: computeTaskStatus(
      planItem,
      currentTask,
      isLoading,
      hasError,
      hasInterrupt
    ),
    // Add repository info if available
    repository: streamValues?.targetRepository?.repo || stream.values?.targetRepository?.repo,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  // Debug info - remove this later
  console.log('TaskList Debug:', {
    hasStreamValues: !!stream.values,
    planLength: plan.length,
    tasksLength: tasks.length,
    isLoading,
    hasError,
    hasInterrupt,
    streamKeys: stream.values ? Object.keys(stream.values) : 'no stream.values'
  });

  return (
    <div className="mx-auto mb-4 w-1/2 items-center justify-center p-4">
      <Tabs
        defaultValue="tasks"
        className="w-full"
      >
        <TabsList className="grid h-auto w-fit grid-cols-2 bg-transparent p-0">
          <TabsTrigger
            value="tasks"
            className="px-0 font-medium data-[state=active]:rounded-none data-[state=active]:border-b-2 data-[state=active]:border-b-black data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Tasks ({tasks.length})
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
          {tasks.length > 0 ? (
            <div className="space-y-0">
              {tasks.map((task) => (
                <Task
                  key={task.index}
                  task={task}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <Archive className="mx-auto mb-2 h-6 w-6 opacity-50" />
              <p className="text-sm">No tasks yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Tasks will appear here when you start a conversation
              </p>
            </div>
          )}
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
