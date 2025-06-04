"use client";

import { useState } from "react";
import { Plus, X, Github, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreateTaskInput, useTasks } from "@/providers/Task";
import { toast } from "sonner";

interface TaskCreateModalProps {
  onTaskCreated?: () => void;
}

export default function TaskCreateModal({
  onTaskCreated,
}: TaskCreateModalProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateTaskInput>({
    plan: "",
    summary: "",
    repository: "",
    branch: "main",
  });

  const { createTask, setAllTasks } = useTasks();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.plan.trim()) {
      toast.error("Task description is required");
      return;
    }

    setIsCreating(true);

    try {
      const newTask = await createTask(formData);

      // Update the local state optimistically
      setAllTasks((prev) => [newTask, ...prev]);

      toast.success("Task created successfully!");

      // Reset form and close modal
      setFormData({
        plan: "",
        summary: "",
        repository: "",
        branch: "main",
      });
      setOpen(false);

      // Notify parent component
      onTaskCreated?.();
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error("Failed to create task. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Create a new development task. This will be added to your task
              list.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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
              <Label htmlFor="summary">Summary (optional)</Label>
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

            {/* Repository and Branch */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="repository">Repository</Label>
                <div className="relative">
                  <Github className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="repository"
                    placeholder="repository-name"
                    value={formData.repository}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        repository: e.target.value,
                      }))
                    }
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="branch">Branch</Label>
                <div className="relative">
                  <GitBranch className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="branch"
                    placeholder="main"
                    value={formData.branch}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        branch: e.target.value,
                      }))
                    }
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !formData.plan.trim()}
            >
              {isCreating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
