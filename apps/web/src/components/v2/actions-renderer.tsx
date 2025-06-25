import { isAIMessageSDK, isHumanMessageSDK } from "@/lib/langchain-messages";
import { UseStream, useStream } from "@langchain/langgraph-sdk/react";
import { AssistantMessage } from "../thread/messages/ai";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import {
  isCustomNodeEvent,
  CustomNodeEvent,
  INITIALIZE_NODE_ID,
  mapCustomEventsToSteps,
} from "@open-swe/shared/open-swe/custom-node-events";
import { DO_NOT_RENDER_ID_PREFIX } from "@open-swe/shared/constants";
import { Message } from "@langchain/langgraph-sdk";
import { InitializeStep } from "../gen-ui/initialize-step";
import { ActionStep } from "../gen-ui/action-step";
import { PlannerGraphState } from "@open-swe/shared/open-swe/planner/types";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ActionsRendererProps {
  graphId: string;
  threadId: string;
  runId?: string;
  setProgrammerSession?: (
    session: ManagerGraphState["programmerSession"],
  ) => void;
  programmerSession?: ManagerGraphState["programmerSession"];
  setSelectedTab?: Dispatch<SetStateAction<"planner" | "programmer">>;
}

const getCustomNodeEventsFromMessages = (
  messages?: Message[],
  nodeId?: string,
): CustomNodeEvent[] => {
  if (!messages) return [];

  return messages
    .filter((m) => isAIMessageSDK(m))
    .filter((m) => {
      const events = m.additional_kwargs?.customNodeEvents as
        | CustomNodeEvent[]
        | undefined;
      if (!events?.length) return false;
      if (!nodeId) {
        return true;
      }
      return events.some((e) => e.nodeId === nodeId);
    })
    .map((m) => m.additional_kwargs?.customNodeEvents as CustomNodeEvent[])
    .flat();
};

export function ActionsRenderer<State extends PlannerGraphState | GraphState>({
  graphId,
  threadId,
  runId,
  setProgrammerSession,
  programmerSession,
  setSelectedTab,
}: ActionsRendererProps) {
  const [customNodeEvents, setCustomNodeEvents] = useState<CustomNodeEvent[]>(
    [],
  );
  const stream = useStream<State>({
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    assistantId: graphId,
    reconnectOnMount: true,
    threadId,
    onCustomEvent: (event) => {
      if (isCustomNodeEvent(event)) {
        setCustomNodeEvents((prev) => [...prev, event]);
      }
    },
  });

  const initializeEvents = customNodeEvents.filter(
    (e) => e.nodeId === INITIALIZE_NODE_ID,
  );
  const toolExecutionEvents = customNodeEvents.filter(
    (e) => e.nodeId === "TOOL_EXECUTION",
  );
  const steps = mapCustomEventsToSteps(initializeEvents);
  const allSuccess =
    steps.length > 0 && steps.every((s) => s.status === "success");

  let initStatus: "loading" | "generating" | "done" = "generating";
  if (allSuccess) {
    initStatus = "done";
  }

  useEffect(() => {
    const customInitEvents = getCustomNodeEventsFromMessages(
      stream.messages,
      INITIALIZE_NODE_ID,
    );
    // If there are no custom init events found in messages, or we already have steps from custom events, return
    if (!customInitEvents?.length || initializeEvents.length) {
      return;
    }
    setCustomNodeEvents(customInitEvents);
  }, [stream.messages]);

  const streamJoined = useRef(false);
  useEffect(() => {
    if (!streamJoined.current && runId) {
      streamJoined.current = true;
      // TODO: If the SDK changes go in, use this instead:
      // stream.joinStream(runId, undefined, { streamMode: ["values", "messages", "custom"]}).catch(console.error);
      stream.joinStream(runId).catch(console.error);
    }
  }, [runId]);

  // Filter out human & do not render messages
  const filteredMessages = stream.messages?.filter(
    (m) =>
      !isHumanMessageSDK(m) &&
      !(m.id && m.id.startsWith(DO_NOT_RENDER_ID_PREFIX)),
  );

  // TODO: Need a better way to handle this. Not great like this...
  useEffect(() => {
    if (
      "programmerSession" in stream.values &&
      stream.values.programmerSession &&
      (stream.values.programmerSession.runId !== programmerSession?.runId ||
        stream.values.programmerSession.threadId !==
          programmerSession?.threadId)
    ) {
      setProgrammerSession?.(stream.values.programmerSession);
      setSelectedTab?.("programmer");
    }
  }, [stream.values]);

  // Check if we have tool execution data to show instead of generic loading
  const toolSteps = mapCustomEventsToSteps(toolExecutionEvents);
  const hasToolExecutionData = toolSteps.length > 0;

  // Only show loading ActionStep AFTER initialization is complete AND if no tool execution data
  const showLoadingActionStep =
    stream.isLoading &&
    (initStatus === "done" || initializeEvents.length === 0) &&
    !hasToolExecutionData;

  return (
    <div className="flex w-full flex-col gap-2">
      {initializeEvents.length > 0 && steps.length > 0 && (
        <InitializeStep
          status={initStatus}
          steps={steps}
          success={allSuccess}
          collapse={initStatus === "done" && allSuccess}
        />
      )}

      {/* 2. Show loading ActionStep ONLY after init is done and when loading with no messages */}
      {showLoadingActionStep &&
        (!filteredMessages || filteredMessages.length === 0) && (
          <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <ActionStep
              actions={[{ status: "loading" }]}
              reasoningText="Agent is thinking..."
            />
          </div>
        )}

      {/* 3. Existing AI messages */}
      {filteredMessages?.map((m) => (
        <AssistantMessage
          key={m.id}
          thread={stream as UseStream<Record<string, unknown>>}
          message={m}
          isLoading={stream.isLoading}
          handleRegenerate={() => {}}
        />
      ))}

      {/* 4. Show tool execution progress if available */}
      {hasToolExecutionData && stream.isLoading && (
        <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <div className="bg-card rounded-lg border p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-medium">Executing Tools</h3>
            <div className="space-y-2">
              {toolSteps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm"
                >
                  {step.status === "success" ? (
                    <CheckCircle className="size-3.5 text-green-500" />
                  ) : step.status === "error" ? (
                    <XCircle className="size-3.5 text-red-500" />
                  ) : (
                    <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
                  )}
                  <span className="text-foreground/80">{step.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Show loading ActionStep when no tool execution data available */}
      {showLoadingActionStep &&
        filteredMessages &&
        filteredMessages.length > 0 && (
          <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <ActionStep
              actions={[{ status: "loading" }]}
              reasoningText="Agent is thinking..."
            />
          </div>
        )}
    </div>
  );
}
