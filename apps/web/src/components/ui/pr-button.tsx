import { Button } from "./button";
import { GitHubSVG } from "../icons/github";
import { ExternalLink } from "lucide-react";

interface PullRequestButtonProps {
  pullRequest: {
    html_url: string;
    title?: string;
    number?: number;
  };
  className?: string;
}

export function PullRequestButton({
  pullRequest,
  className,
}: PullRequestButtonProps) {
  return (
    <Button
      asChild
      variant="brand"
      size="sm"
      className={className}
    >
      <a
        href={pullRequest.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2"
      >
        <GitHubSVG className="size-4" />
        View PR
        <ExternalLink className="size-3" />
      </a>
    </Button>
  );
}
