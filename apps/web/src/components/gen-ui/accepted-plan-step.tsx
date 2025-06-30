"use client";

import {
  CheckCircle,
  FileText,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

type AcceptedPlanStepProps = {
  planTitle: string;
  planItems: string[];
  collapse?: boolean;
};

export function AcceptedPlanStep({
  planTitle,
  planItems,
  collapse: collapseProp = false,
}: AcceptedPlanStepProps) {
  const [collapsed, setCollapsed] = useState(collapseProp);

  const getStatusText = () => {
    return `Plan accepted: ${planTitle}`;
  };

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
      {/* Header with collapse/expand functionality */}
      <div className="relative flex items-center border-b border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
        <FileText className="mr-2 h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
        <span className="flex-1 text-xs font-normal text-gray-800 dark:text-gray-200">
          {getStatusText()}
        </span>
        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        <Button
          aria-label={collapsed ? "Expand" : "Collapse"}
          onClick={() => setCollapsed((c) => !c)}
          variant="ghost"
          size="icon"
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              collapsed ? "rotate-0" : "rotate-180",
            )}
          />
        </Button>
      </div>
      {/* Plan items list - only render if not collapsed */}
      {!collapsed && planItems && planItems.length > 0 && (
        <div className="p-2">
          <ul className="space-y-2">
            {planItems.map((planItem, index) => (
              <li
                key={index}
                className="flex items-start text-xs"
              >
                <span className="mr-2 mt-0.5 flex-shrink-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                </span>
                <span className="font-normal text-gray-800 dark:text-gray-200">
                  {planItem}
                </span>
              </li>
            ))}
          </ul>
          {planItems.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                <CheckCircle className="mr-1.5 h-3 w-3 text-green-500" />
                <span>
                  {planItems.length} task{planItems.length !== 1 ? 's' : ''} accepted
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Empty state */}
      {!collapsed && (!planItems || planItems.length === 0) && (
        <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
          No plan items to display
        </div>
      )}
    </div>
  );
}

