"use client";

import { useState, useEffect } from "react";
import { Edit2, Github, GitBranch, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskWithContext, UpdateTaskInput, useTasks } from "@/providers/Task";
import { toast } from "sonner";

interface TaskEditModalProps {
  task: TaskWithContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
}

export default function TaskEditModal({
  task,
  open,
  onOpenChange,
  onTaskUpdated,
}: TaskEditModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState<UpdateTaskInput>({
    plan: "",
    summary: "",
    status: "interrupted",
    completed: false,
  });

  const { updateTask } = useTasks();

  // Reset form data when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        plan: task.plan,
        summary: task.summary || "",
        status: task.status,
        completed: task.completed,
      });
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!task || !formData.plan?.trim()) {
      toast.error("Task description is required");
      return;
    }

    setIsUpdating(true);

    try {
      await updateTask(task.taskId, formData);

      toast.success("Task updated successfully!");
      onOpenChange(false);
      onTaskUpdated?.();
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Failed to update task. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Task
            </DialogTitle>
            <DialogDescription>
              Update the task details and status.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(
                  value: "running" | "interrupted" | "done" | "error",
                ) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: value,
                    completed: value === "done",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="running">🔵 Running</SelectItem>
                  <SelectItem value="interrupted">🟡 Interrupted</SelectItem>
                  <SelectItem value="done">🟢 Done</SelectItem>
                  <SelectItem value="error">🔴 Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Task Description */}
            <div className="grid gap-2">
              <Label htmlFor="plan">Task Description *</Label>
              <Textarea
                id="plan"
                placeholder="Describe what needs to be done..."
                value={formData.plan}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, plan: e.target.value }))
                }
                className="min-h-20"
                required
              />
            </div>

            {/* Summary */}
            <div className="grid gap-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                placeholder="Brief summary or notes about this task..."
                value={formData.summary}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, summary: e.target.value }))
                }
                className="min-h-16"
              />
            </div>

            {/* Read-only Repository and Branch info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Repository</Label>
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <Github className="h-4 w-4 text-gray-400" />
                  <span>{task.repository}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Branch</Label>
                <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <GitBranch className="h-4 w-4 text-gray-400" />
                  <span>{task.branch}</span>
                </div>
              </div>
            </div>

            {/* Task ID for reference */}
            <div className="grid gap-2">
              <Label>Task ID</Label>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-600">
                {task.taskId}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating || !formData.plan?.trim()}
            >
              <Save className="mr-2 h-4 w-4" />
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
