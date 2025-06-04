"use client";

import {
  CheckCircle2,
  XCircle,
  Pause,
  LoaderCircle,
  Archive,
  TrendingUp,
} from "lucide-react";
import { TaskWithContext } from "@/providers/Task";

interface TasksStatsProps {
  tasks: TaskWithContext[];
  filteredTasks: TaskWithContext[];
}

export default function TasksStats({ tasks, filteredTasks }: TasksStatsProps) {
  // Calculate statistics
  const totalTasks = tasks.length;
  const filteredCount = filteredTasks.length;
  
  const stats = {
    total: totalTasks,
    done: tasks.filter(t => t.status === "done").length,
    interrupted: tasks.filter(t => t.status === "interrupted").length,
    running: tasks.filter(t => t.status === "running").length,
    error: tasks.filter(t => t.status === "error").length,
  };

  const completionRate = totalTasks > 0 ? Math.round((stats.done / totalTasks) * 100) : 0;
  const repositoryCount = new Set(tasks.map(t => t.repository).filter(Boolean)).size;

  const statCards = [
    {
      name: "Total Tasks",
      value: filteredCount !== totalTasks ? `${filteredCount} / ${totalTasks}` : totalTasks,
      icon: Archive,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
    {
      name: "Completed",
      value: stats.done,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      name: "In Progress",
      value: stats.running,
      icon: LoaderCircle,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      name: "Interrupted",
      value: stats.interrupted,
      icon: Pause,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      name: "Completion Rate",
      value: `${completionRate}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.name}
            className="overflow-hidden rounded-lg bg-white border border-gray-200 shadow-sm"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`inline-flex items-center justify-center rounded-md p-2 ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
} 