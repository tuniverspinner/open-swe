"use client";

import { useState } from "react";
import {
  CheckSquare,
  Square,
  Trash2,
  CheckCircle2,
  Pause,
  LoaderCircle,
  XCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskWithContext, useTasks } from "@/providers/Task";
import { toast } from "sonner";

interface BulkActionsToolbarProps {
  selectedTasks: string[];
  allTasks: TaskWithContext[];
  onSelectionChange: (taskIds: string[]) => void;
  onTasksUpdated?: () => void;
}

export default function BulkActionsToolbar({
  selectedTasks,
  allTasks,
  onSelectionChange,
  onTasksUpdated,
}: BulkActionsToolbarProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { bulkUpdateTasks, bulkDeleteTasks } = useTasks();

  const selectedTasksData = allTasks.filter((task) =>
    selectedTasks.includes(task.taskId),
  );
  const allSelected = selectedTasks.length === allTasks.length;
  const someSelected = selectedTasks.length > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(allTasks.map((task) => task.taskId));
    }
  };

  const handleBulkStatusUpdate = async (
    status: "running" | "interrupted" | "done" | "error",
  ) => {
    if (selectedTasks.length === 0) return;

    setIsUpdating(true);
    try {
      await bulkUpdateTasks(selectedTasks, {
        status,
        completed: status === "done",
      });

      toast.success(`Updated ${selectedTasks.length} task(s) to ${status}`);
      onSelectionChange([]);
      onTasksUpdated?.();
    } catch (error) {
      console.error("Failed to update tasks:", error);
      toast.error("Failed to update tasks. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;

    setIsUpdating(true);
    try {
      await bulkDeleteTasks(selectedTasks);

      toast.success(`Deleted ${selectedTasks.length} task(s)`);
      onSelectionChange([]);
      setShowDeleteDialog(false);
      onTasksUpdated?.();
    } catch (error) {
      console.error("Failed to delete tasks:", error);
      toast.error("Failed to delete tasks. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!someSelected) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="h-8 w-8 p-0"
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </Button>

          <span className="text-sm font-medium text-blue-900">
            {selectedTasks.length} task(s) selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Update Dropdown */}
          <Select
            onValueChange={handleBulkStatusUpdate}
            disabled={isUpdating}
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Update status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="running">
                <div className="flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 text-blue-500" />
                  Running
                </div>
              </SelectItem>
              <SelectItem value="interrupted">
                <div className="flex items-center gap-2">
                  <Pause className="h-4 w-4 text-yellow-500" />
                  Interrupted
                </div>
              </SelectItem>
              <SelectItem value="done">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Done
                </div>
              </SelectItem>
              <SelectItem value="error">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Error
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Delete Button */}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isUpdating}
            className="h-8"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>

          {/* Clear Selection */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange([])}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tasks</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedTasks.length} task(s)?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 max-h-32 overflow-y-auto rounded border bg-gray-50 p-3">
            <div className="space-y-1">
              {selectedTasksData.slice(0, 5).map((task) => (
                <div
                  key={task.taskId}
                  className="text-sm text-gray-600"
                >
                  • {task.plan.substring(0, 60)}...
                </div>
              ))}
              {selectedTasks.length > 5 && (
                <div className="text-sm text-gray-500">
                  ... and {selectedTasks.length - 5} more
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleBulkDelete}
              disabled={isUpdating}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUpdating ? "Deleting..." : "Delete Tasks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
