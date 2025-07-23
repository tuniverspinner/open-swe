"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGitHubAppProvider } from "@/providers/GitHubApp";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  CloneTemplateResponse,
  CloneTemplateRequest,
} from "@/app/api/github/clone-template/types";
import { useQueryState } from "nuqs";

interface CloneTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    owner: string;
    repo: string;
  };
}

export function CloneTemplateDialog({
  open,
  onOpenChange,
  template,
}: CloneTemplateDialogProps) {
  const [repo] = useQueryState("repo");
  const ownerName = repo?.split("/")[0];
  const { setSelectedRepository } = useGitHubAppProvider();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    private: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName) {
      toast.error("Owner name is required", {
        richColors: true,
        duration: 5000,
      });
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Repository name is required", {
        richColors: true,
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const cloneTemplateInput: CloneTemplateRequest = {
        template,
        newRepo: {
          owner: ownerName,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          private: formData.private,
        },
      };
      const response = await fetch("/api/github/clone-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cloneTemplateInput),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || errorData.error || "Failed to clone template",
        );
      }

      const data: CloneTemplateResponse = await response.json();

      // Update selected repository in context
      const [owner, repo] = data.repository.full_name.split("/");
      setSelectedRepository({
        owner,
        repo,
        branch: data.repository.default_branch,
      });

      // Show success message
      toast.success(
        `Successfully created repository: ${data.repository.full_name}`,
        {
          richColors: true,
          duration: 5000,
        },
      );

      // Close dialog and reset form
      onOpenChange(false);
      setFormData({
        name: "",
        description: "",
        private: false,
      });
    } catch (error) {
      console.error("Error cloning template:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to clone template: ${errorMessage}`, {
        richColors: true,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setFormData({
      name: "",
      description: "",
      private: false,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Clone TypeScript Template</DialogTitle>
          <DialogDescription>
            Create a new repository from the TypeScript template to get started
            quickly.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="repo-owner">Repository Owner *</Label>
            <Input
              id="repo-owner"
              type="text"
              placeholder="my-awesome-project"
              value={ownerName}
              disabled={true}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo-name">Repository Name *</Label>
            <Input
              id="repo-name"
              type="text"
              placeholder="my-awesome-project"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              disabled={isLoading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo-description">Description (optional)</Label>
            <Input
              id="repo-description"
              type="text"
              placeholder="A brief description of your project"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="private"
              checked={formData.private}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, private: checked }))
              }
              disabled={isLoading}
            />
            <Label htmlFor="private">Private repository</Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </div>
              ) : (
                "Create Repository"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
