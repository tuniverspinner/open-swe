"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export type DisplayState = "expanded" | "collapsed";

interface ActionDisplayContextType {
  // Global states
  globalReasoningState: DisplayState;
  globalOutputState: DisplayState;
  
  // Functions to update global states
  setGlobalReasoningState: (state: DisplayState) => void;
  setGlobalOutputState: (state: DisplayState) => void;
  
  // Functions to get effective state for individual components
  getEffectiveReasoningState: (localState?: boolean) => boolean;
  getEffectiveSummaryState: (localState?: boolean) => boolean;
  getEffectiveOutputState: (localState?: boolean) => boolean;
  
  // Function to check if global override is active
  isGlobalOverrideActive: () => boolean;
}

const ActionDisplayContext = createContext<ActionDisplayContextType | undefined>(
  undefined,
);

export function useActionDisplay() {
  const context = useContext(ActionDisplayContext);
  if (context === undefined) {
    throw new Error(
      "useActionDisplay must be used within an ActionDisplayProvider",
    );
  }
  return context;
}

interface ActionDisplayProviderProps {
  children: React.ReactNode;
}

export function ActionDisplayProvider({ children }: ActionDisplayProviderProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Initialize states from URL parameters
  const [globalReasoningState, setGlobalReasoningStateInternal] = useState<DisplayState>(
    (searchParams.get("reasoning") as DisplayState) || "expanded"
  );
  const [globalOutputState, setGlobalOutputStateInternal] = useState<DisplayState>(
    (searchParams.get("output") as DisplayState) || "expanded"
  );

  // Update URL when global states change
  const updateURL = (reasoning: DisplayState, output: DisplayState) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("reasoning", reasoning);
    params.set("output", output);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const setGlobalReasoningState = (state: DisplayState) => {
    setGlobalReasoningStateInternal(state);
    updateURL(state, globalOutputState);
  };

  const setGlobalOutputState = (state: DisplayState) => {
    setGlobalOutputStateInternal(state);
    updateURL(globalReasoningState, state);
  };

  // Functions to get effective state for individual components
  const getEffectiveReasoningState = (localState?: boolean): boolean => {
    return globalReasoningState === "expanded";
  };

  const getEffectiveSummaryState = (localState?: boolean): boolean => {
    return globalReasoningState === "expanded";
  };

  const getEffectiveOutputState = (localState?: boolean): boolean => {
    return globalOutputState === "expanded";
  };

  const isGlobalOverrideActive = (): boolean => {
    return searchParams.has("reasoning") || searchParams.has("output");
  };

  // Sync with URL parameters when they change
  useEffect(() => {
    const reasoningParam = searchParams.get("reasoning") as DisplayState;
    const outputParam = searchParams.get("output") as DisplayState;
    
    if (reasoningParam && reasoningParam !== globalReasoningState) {
      setGlobalReasoningStateInternal(reasoningParam);
    }
    if (outputParam && outputParam !== globalOutputState) {
      setGlobalOutputStateInternal(outputParam);
    }
  }, [searchParams, globalReasoningState, globalOutputState]);

  const value: ActionDisplayContextType = {
    globalReasoningState,
    globalOutputState,
    setGlobalReasoningState,
    setGlobalOutputState,
    getEffectiveReasoningState,
    getEffectiveSummaryState,
    getEffectiveOutputState,
    isGlobalOverrideActive,
  };

  return (
    <ActionDisplayContext.Provider value={value}>
      {children}
    </ActionDisplayContext.Provider>
  );
}

