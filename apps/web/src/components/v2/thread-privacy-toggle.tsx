"use client";

import { Lock, Unlock } from "lucide-react";
import { TooltipIconButton } from "../ui/tooltip-icon-button";
import { useStream } from "@langchain/langgraph-sdk/react";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";

interface ThreadPrivacyToggleProps {
  stream: ReturnType<typeof useStream<ManagerGraphState>>;
  threadId: string;
  isPublic?: boolean;
}

export function ThreadPrivacyToggle({
  stream,
  threadId,
  isPublic = false,
}: ThreadPrivacyToggleProps) {
  const handleTogglePrivacy = async () => {
    try {
      await stream.client.threads.updateState(threadId, {
        values: {
          isPublic: !isPublic,
        },
      });
    } catch (error) {
      console.error("Failed to update thread privacy:", error);
    }
  };

  return (
    <TooltipIconButton
      tooltip={isPublic ? "Make thread private" : "Make thread public"}
      variant="ghost"
      onClick={handleTogglePrivacy}
      aria-label={isPublic ? "Make thread private" : "Make thread public"}
    >
      {isPublic ? <Unlock className="size-4" /> : <Lock className="size-4" />}
    </TooltipIconButton>
  );
}
