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

interface CloneTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CloneTemplateResponse {
  success: boolean;
  repository: {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    default_branch: string;
  };
}

export function CloneTemplateDialog({
  open,
  onOpenChange,
}: CloneTemplateDialogProps) {
  const router = useRouter();
  const { setSelectedRepository } = useGitHubAppProvider();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    private: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Repository name is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/github/clone-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          private: formData.private,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || "Failed to clone template");
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
      toast.success(`Successfully created repository: ${data.repository.full_name}`);

      // Close dialog and reset form
      onOpenChange(false);
      setFormData({
        name: "",
        description: "",
        private: false,
      });

      // Navigate to chat interface
      router.push("/chat");
    } catch (error) {
      console.error("Error cloning template:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to clone template: ${errorMessage}`);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Clone TypeScript Template</DialogTitle>
          <DialogDescription>
            Create a new repository from the TypeScript template to get started quickly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Repository Name *</Label>
            <Input
              id="name"
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
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              type="text"
              placeholder="A brief description of your project"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
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
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
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

