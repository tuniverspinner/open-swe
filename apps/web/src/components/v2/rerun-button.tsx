"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";

interface RerunButtonProps {
  threadValues: Partial<ManagerGraphState>;
  isLoading: boolean;
  onRerun: () => void;
}

export function RerunButton({
  threadValues,
  isLoading,
  onRerun,
}: RerunButtonProps) {
  // Check if we have the necessary values to rerun
  const canRerun =
    threadValues.messages &&
    threadValues.messages.length > 0 &&
    threadValues.targetRepository;

  if (!canRerun) {
    return null;
  }

  return (
    <Button
      onClick={onRerun}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Rerunning...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Rerun Task
        </>
      )}
    </Button>
  );
}
