"use client";

import "../app/globals.css";
import { useState } from "react";
import {
  FileCode,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
} from "lucide-react";

type ApplyPatchProps = {
  file: string;
  status: "loading" | "generating" | "done";
  success?: boolean;
  diff?: string;
  errorMessage?: string;
  fixedDiff?: string;
  reasoningText?: string;
  summaryText?: string;
};

export function ApplyPatch({
  file,
  status,
  success,
  diff,
  errorMessage,
  fixedDiff,
  reasoningText,
  summaryText,
}: ApplyPatchProps) {
  const [expanded, setExpanded] = useState(Boolean(status === "done" && diff));
  const [showReasoning, setShowReasoning] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const getStatusIcon = () => {
    switch (status) {
      case "loading":
        return (
          <div className="h-3.5 w-3.5 rounded-full border border-gray-300" />
        );
      case "generating":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" />;
      case "done":
        return success ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-500" />
        );
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "loading":
        return "Preparing patch...";
      case "generating":
        return "Applying patch...";
      case "done":
        return success ? "Patch applied" : "Patch failed";
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-gray-200">
      {reasoningText && (
        <div className="border-b border-blue-100 bg-blue-50 p-2">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1 text-xs font-normal text-blue-700 hover:text-blue-800"
          >
            <MessageSquare className="h-3 w-3" />
            {showReasoning ? "Hide reasoning" : "Show reasoning"}
          </button>
          {showReasoning && (
            <p className="mt-1 text-xs font-normal text-blue-800">
              {reasoningText}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center border-b border-gray-200 bg-gray-50 p-2">
        <FileCode className="mr-2 h-3.5 w-3.5 text-gray-500" />
        <code className="flex-1 text-xs font-normal text-gray-800">{file}</code>
        <div className="flex items-center gap-2">
          <span className="text-xs font-normal text-gray-500">
            {getStatusText()}
          </span>
          {getStatusIcon()}
          {diff && status === "done" && (
            <button
              onClick={() => setExpanded((prev) => !prev)}
              className="text-gray-500 hover:text-gray-700"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {expanded && diff && status === "done" && (
        <div className="overflow-x-auto bg-gray-900 p-2">
          <pre
            className="text-xs font-normal whitespace-pre-wrap text-gray-200"
            dangerouslySetInnerHTML={{ __html: formatDiff(diff) }}
          />

          {!success && errorMessage && (
            <div className="mt-2 rounded border border-red-700/30 bg-red-900/30 p-2 text-xs text-red-400">
              {errorMessage}
            </div>
          )}

          {!success && fixedDiff && (
            <div className="mt-2">
              <div className="mb-1 text-xs text-gray-400">Fixed diff:</div>
              <pre
                className="text-xs font-normal whitespace-pre-wrap text-gray-200"
                dangerouslySetInnerHTML={{ __html: formatDiff(fixedDiff) }}
              />
            </div>
          )}
        </div>
      )}

      {summaryText && status === "done" && (
        <div className="border-t border-green-100 bg-green-50 p-2">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="flex items-center gap-1 text-xs font-normal text-green-700 hover:text-green-800"
          >
            <FileText className="h-3 w-3" />
            {showSummary ? "Hide summary" : "Show summary"}
          </button>
          {showSummary && (
            <p className="mt-1 text-xs font-normal text-green-800">
              {summaryText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDiff(diff: string) {
  return diff
    .split("\n")
    .map((line) => {
      if (line.startsWith("+")) {
        return `<span class="text-green-400">${line}</span>`;
      } else if (line.startsWith("-")) {
        return `<span class="text-red-400">${line}</span>`;
      } else if (line.startsWith("@")) {
        return `<span class="text-blue-400">${line}</span>`;
      }
      return line;
    })
    .join("\n");
}
