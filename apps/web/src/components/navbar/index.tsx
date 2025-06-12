import { useMediaQuery } from "@/hooks/useMediaQuery";
import { motion } from "framer-motion";
import TaskListSidebar from "../task-list-sidebar";
import { parseAsBoolean, useQueryState } from "nuqs";
import {
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
  useArtifactOpen,
} from "../thread/artifact";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { Button } from "../ui/button";
import {
  PanelRightClose,
  PanelRightOpen,
  Settings,
  SquarePen,
  XIcon,
} from "lucide-react";
import { TooltipIconButton } from "../ui/tooltip-icon-button";
import { GitHubOAuthButton } from "../github/github-oauth-button";
import { useRouter } from "next/navigation";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { useEffect, useRef, useState } from "react";
import { useTaskPlan } from "../tasks/useTaskPlan";
import { TaskPlanView } from "../tasks";
import { OpenPRButton } from "../github/open-pr-button";
import { StickToBottom } from "use-stick-to-bottom";
import { ConfigurationSidebar } from "../configuration-sidebar";

export function NavBar() {
  const { push } = useRouter();
  const stream = useStreamContext();
  const messages = stream.messages;
  const [threadId, _setThreadId] = useQueryState("threadId");
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [artifactOpen, closeArtifact] = useArtifactOpen();
  const chatStarted = !!threadId || !!messages.length;
  const [configSidebarOpen, setConfigSidebarOpen] = useState(false);
  const [_artifactContext, setArtifactContext] = useArtifactContext();
  const [taskId, setTaskId] = useQueryState("taskId");

  const {
    taskPlan,
    handleEditPlanItem,
    handleAddPlanItem,
    handleDeletePlanItem,
  } = useTaskPlan();

  const isTaskView = !!taskId;
  const isThreadView = !!threadId;

  // Track previous states to detect navigation changes
  const prevTaskId = useRef(taskId);
  const prevThreadId = useRef(threadId);

  useEffect(() => {
    const isNavigatingToTask = !prevTaskId.current && taskId;
    const isNavigatingToThread = !prevThreadId.current && threadId;
    if ((isNavigatingToTask || isNavigatingToThread) && !chatHistoryOpen) {
      setChatHistoryOpen(true);
    }
    prevTaskId.current = taskId;
    prevThreadId.current = threadId;
  }, [taskId, threadId, chatHistoryOpen, setChatHistoryOpen]);

  useEffect(() => {
    if (taskId && typeof window !== "undefined") {
      // TaskId format is "${threadId}-${taskIndex}", so we can extract the threadId directly
      const taskThreadId = taskId.split("-").slice(0, -1).join("-");
      if (taskThreadId && taskThreadId !== threadId) {
        _setThreadId(taskThreadId);
      }
    }
  }, [taskId, threadId, _setThreadId]);

  const setThreadId = (id: string | null) => {
    _setThreadId(id);

    if (id === null) {
      setTaskId(null);
      closeArtifact();
      setArtifactContext({});
    }
  };

  return (
    <nav>
      <div className="relative hidden lg:flex">
        <motion.div
          className="absolute z-20 h-full overflow-hidden border-r bg-white"
          style={{ width: 300 }}
          animate={
            isLargeScreen
              ? { x: chatHistoryOpen ? 0 : -300 }
              : { x: chatHistoryOpen ? 0 : -300 }
          }
          initial={{ x: -300 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div
            className="relative h-full"
            style={{ width: 300 }}
          >
            <TaskListSidebar onCollapse={() => setChatHistoryOpen(false)} />
          </div>
        </motion.div>
      </div>

      <div
        className={cn(
          "grid w-full grid-cols-[1fr_0fr] transition-all duration-500",
          artifactOpen && "grid-cols-[3fr_2fr]",
        )}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
            !chatStarted && "grid-rows-[1fr]",
          )}
          layout={isLargeScreen}
          animate={{
            marginLeft: chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
            width: chatHistoryOpen
              ? isLargeScreen
                ? "calc(100% - 300px)"
                : "100%"
              : "100%",
          }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          {!chatStarted && (
            <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 p-2 pl-4">
              <div>
                {(!chatHistoryOpen || !isLargeScreen) && (
                  <Button
                    className="hover:bg-gray-100"
                    variant="ghost"
                    onClick={() => setChatHistoryOpen((p) => !p)}
                  >
                    {chatHistoryOpen ? (
                      <PanelRightOpen className="size-4" />
                    ) : (
                      <PanelRightClose className="size-4" />
                    )}
                  </Button>
                )}
              </div>
              <div className="absolute top-2 right-4 flex items-center gap-2 text-gray-700">
                <TooltipIconButton
                  tooltip="Configuration"
                  variant="ghost"
                  onClick={() => {
                    setConfigSidebarOpen(true);
                  }}
                >
                  <Settings className="size-4" />
                </TooltipIconButton>
                <GitHubOAuthButton />
              </div>
            </div>
          )}
          {chatStarted && (
            <div className="relative z-10 grid grid-cols-10 items-start gap-3 p-2">
              <div className="relative col-span-2 flex items-center justify-start gap-2">
                <div className="absolute left-0 z-10">
                  {(!chatHistoryOpen || !isLargeScreen) && (
                    <Button
                      className="hover:bg-gray-100"
                      variant="ghost"
                      onClick={() => setChatHistoryOpen((p) => !p)}
                    >
                      {chatHistoryOpen ? (
                        <PanelRightOpen className="size-5" />
                      ) : (
                        <PanelRightClose className="size-5" />
                      )}
                    </Button>
                  )}
                </div>
                <motion.button
                  className="flex cursor-pointer items-center gap-2"
                  onClick={() => push("/")}
                  animate={{
                    marginLeft: !chatHistoryOpen ? 48 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <LangGraphLogoSVG
                    width={32}
                    height={32}
                  />
                  <span className="text-xl font-semibold tracking-tight">
                    Open SWE
                  </span>
                </motion.button>
              </div>

              <div className="col-span-6 mx-auto flex w-sm justify-center md:w-md lg:w-lg xl:w-xl">
                {taskPlan && (
                  <TaskPlanView
                    taskPlan={taskPlan}
                    onTaskChange={() => {}}
                    onRevisionChange={() => {}}
                    onEditPlanItem={handleEditPlanItem}
                    onAddPlanItem={handleAddPlanItem}
                    onDeletePlanItem={handleDeletePlanItem}
                  />
                )}
              </div>

              <div className="col-span-2 flex items-center justify-end gap-2 text-gray-700">
                <GitHubOAuthButton />
                <OpenPRButton />
                <TooltipIconButton
                  tooltip="Configuration"
                  variant="ghost"
                  onClick={() => {
                    setConfigSidebarOpen(true);
                  }}
                >
                  <Settings className="size-4" />
                </TooltipIconButton>
                <TooltipIconButton
                  tooltip="New thread"
                  variant="ghost"
                  onClick={() => setThreadId(null)}
                >
                  <SquarePen className="size-4" />
                </TooltipIconButton>
              </div>

              <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
            </div>
          )}
        </motion.div>
      </div>

      <div className="relative flex flex-col border-l">
        <div className="absolute inset-0 flex min-w-[30vw] flex-col">
          <div className="grid grid-cols-[1fr_auto] border-b p-4">
            <ArtifactTitle className="truncate overflow-hidden" />
            <button
              onClick={closeArtifact}
              className="cursor-pointer"
            >
              <XIcon className="size-5" />
            </button>
          </div>
          <ArtifactContent className="relative flex-grow" />
        </div>
      </div>

      <ConfigurationSidebar
        open={configSidebarOpen}
        onClose={() => setConfigSidebarOpen(false)}
      />
    </nav>
  );
}
