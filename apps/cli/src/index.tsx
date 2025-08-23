#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput } from "ink";
import { Command } from "commander";
import { OPEN_SWE_CLI_VERSION } from "./constants.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

// Keep the process alive - prevents exit when streaming completes
const keepAlive = setInterval(() => {}, 60000);

// Handle graceful exit on Ctrl+C and Ctrl+K
process.on("SIGINT", () => {
  clearInterval(keepAlive);
  console.log("\n👋 Goodbye!");
  process.exit(0);
});

process.on("SIGTERM", () => {
  clearInterval(keepAlive);
  console.log("\n👋 Goodbye!");
  process.exit(0);
});

import { StreamingService } from "./streaming.js";
import { TraceReplayService } from "./trace_replay.js";
import { validateConfigExists } from "./config.js";
import { ApiKeySetup } from "./ApiKeySetup.js";

// Parse command line arguments with Commander
const program = new Command();

program
  .name("open-swe")
  .description("Open SWE CLI - Local Mode")
  .version(OPEN_SWE_CLI_VERSION)
  .option("--replay <file>", "Replay from LangSmith trace file")
  .option("--speed <ms>", "Replay speed in milliseconds", "500")
  .helpOption("-h, --help", "Display help for command")
  .parse();

// Always run in local mode
process.env.OPEN_SWE_LOCAL_MODE = "true";

// eslint-disable-next-line no-unused-vars
const CustomInput: React.FC<{ onSubmit: (value: string) => void }> = ({
  onSubmit,
}) => {
  const [input, setInput] = useState("");

  useInput((inputChar: string, key: { [key: string]: any }) => {
    // Handle Ctrl+K for exit
    if (key.ctrl && inputChar.toLowerCase() === "k") {
      console.log("\n👋 Goodbye!");
      process.exit(0);
    }

    if (key.return) {
      if (input.trim()) {
        // Only submit if there's actual content
        onSubmit(input);
        // Clear input immediately after submission
        setInput("");
      }
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (inputChar) {
      setInput((prev) => prev + inputChar);
    }
  });

  return (
    <Box>
      <Text>&gt; {input}</Text>
    </Box>
  );
};

// Directory prompt component
const DirectoryPrompt: React.FC<{ onSubmit: (directory: string) => void }> = ({
  onSubmit,
}) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useInput((inputChar: string, key: { [key: string]: any }) => {
    // Handle Ctrl+K for exit
    if (key.ctrl && inputChar.toLowerCase() === "k") {
      console.log("\n👋 Goodbye!");
      process.exit(0);
    }

    if (key.return) {
      if (input.trim()) {
        const directory = input.trim();
        const resolvedPath = path.resolve(directory);
        
        // Check if directory exists
        if (!fs.existsSync(resolvedPath)) {
          setError("Directory does not exist. Please enter a valid path.");
          return;
        }
        
        // Check if it's a directory
        if (!fs.statSync(resolvedPath).isDirectory()) {
          setError("Path is not a directory. Please enter a valid directory path.");
          return;
        }
        

        
        // Clear error and submit
        setError(null);
        onSubmit(resolvedPath);
        setInput("");
      }
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      setError(null); // Clear error when user starts typing
    } else if (inputChar) {
      setInput((prev) => prev + inputChar);
      setError(null); // Clear error when user starts typing
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="magenta" bold>
          Welcome to Open SWE CLI!
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text>
          Please enter the path to your project directory:
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text>&gt; {input}</Text>
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color="gray" italic>
          Press Enter to continue, Ctrl+K to exit
        </Text>
      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [streamingService, setStreamingService] =
    useState<StreamingService | null>(null);
  const [currentInterrupt, setCurrentInterrupt] = useState<{
    command: string;
    args: Record<string, any>;
    id: string;
  } | null>(null);
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);
  const [showDirectoryPrompt, setShowDirectoryPrompt] = useState(false);
  const [configValid, setConfigValid] = useState(false);

  const options = program.opts();
  const replayFile = options.replay;
  const playbackSpeed = parseInt(options.speed) || 500;

  // Check config and directory on startup
  useEffect(() => {
    const { isValid } = validateConfigExists();
    setConfigValid(isValid);
    
    // Check if we have a valid project path
    const projectPath = process.env.OPEN_SWE_LOCAL_PROJECT_PATH;
    if (!projectPath) {
      setShowDirectoryPrompt(true);
    } else {
      // Validate the existing path
      const resolvedPath = path.resolve(projectPath);
      if (!fs.existsSync(resolvedPath) || 
          !fs.statSync(resolvedPath).isDirectory()) {
        setShowDirectoryPrompt(true);
      } else {
        setShowApiKeySetup(!isValid);
      }
    }
  }, []);

  // Auto-start replay if file provided
  useEffect(() => {
    if (replayFile && !hasStartedChat && configValid && !showDirectoryPrompt) {
      try {
        const traceData = JSON.parse(fs.readFileSync(replayFile, "utf8"));
        setHasStartedChat(true);

        const traceReplayService = new TraceReplayService({
          setLogs,
          setLoadingLogs,
        });

        traceReplayService.replayFromTrace(traceData, playbackSpeed);
      } catch (err: any) {
        console.error("Error loading replay file:", err.message);
        process.exit(1);
      }
    }
  }, [replayFile, hasStartedChat, playbackSpeed, configValid, showDirectoryPrompt]);

  const inputHeight = 4;
  const availableHeight = process.stdout.rows - inputHeight - 1;

  const handleApiKeySetupComplete = () => {
    setShowApiKeySetup(false);
    setConfigValid(true);
  };

  const handleDirectoryPromptComplete = (directory: string) => {
    process.env.OPEN_SWE_LOCAL_PROJECT_PATH = directory;
    setShowDirectoryPrompt(false);
    
    // Now check if we need API key setup
    const { isValid } = validateConfigExists();
    setConfigValid(isValid);
    setShowApiKeySetup(!isValid);
  };

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      {/* Directory Prompt */}
      {showDirectoryPrompt ? (
        <DirectoryPrompt onSubmit={handleDirectoryPromptComplete} />
      ) : showApiKeySetup ? (
        <ApiKeySetup onComplete={handleApiKeySetupComplete} />
      ) : (
        <>
          {/* Welcome message or logs display */}
          {!hasStartedChat ? (
        <Box flexDirection="column" paddingX={1}>
          <Box>
            <Text>
              {`

##          ###    ##    ##  ######    ######  ##     ##    ###    #### ##    ## 
##         ## ##   ###   ## ##    ##  ##    ## ##     ##   ## ##    ##  ###   ## 
##        ##   ##  ####  ## ##        ##       ##     ##  ##   ##   ##  ####  ## 
##       ##     ## ## ## ## ##   #### ##       ######### ##     ##  ##  ## ## ## 
##       ######### ##  #### ##    ##  ##       ##     ## #########  ##  ##  #### 
##       ##     ## ##   ### ##    ##  ##    ## ##     ## ##     ##  ##  ##   ### 
######## ##     ## ##    ##  ######    ######  ##     ## ##     ## #### ##    ##
`}
            </Text>
          </Box>
        </Box>
      ) : (
        <Box
          flexDirection="column"
          height={availableHeight}
          paddingX={2}
          paddingY={1}
          paddingBottom={3}
        >
          <Box
            flexDirection="column"
            height={availableHeight - 5}
            justifyContent="flex-end"
            overflow="hidden"
          >
            {logs
              .filter(
                (log) =>
                  log !== null && log !== undefined && typeof log === "string",
              )
              .map((log, index) => {
                const isToolCall = log.startsWith("▸");
                const isToolResult = log.startsWith("  ↳");
                const isAIMessage = log.startsWith("◆");
                const isRemovedLine = log.startsWith("- ");
                const isAddedLine = log.startsWith("+ ");
                const isLongBashCommand =
                  isToolCall &&
                  (log.includes("execute_bash:") || log.includes("shell:")) &&
                  log.includes("...");

                return (
                  <Box
                    key={index}
                    paddingLeft={isToolCall ? 1 : isToolResult ? 2 : 0}
                    width="100%"
                    flexShrink={0}
                  >
                    <Text
                      color={
                        isAIMessage
                          ? "magenta"
                          : isToolResult
                            ? "gray"
                            : isRemovedLine
                              ? "redBright"
                              : isAddedLine
                                ? "greenBright"
                                : isLongBashCommand
                                  ? "gray"
                                  : undefined
                      }
                      bold={isAIMessage}
                      wrap="wrap"
                    >
                      {log}
                    </Text>
                  </Box>
                );
              })}
          </Box>
        </Box>
      )}

      {/* Approval prompt above input when interrupt is active */}
      {currentInterrupt && (
        <Box paddingX={2} paddingY={1}>
          <Text color="magenta">
            Approve this command? $ {currentInterrupt.command}{" "}
            {(() => {
              const args = currentInterrupt.args.path ||
                Object.values(currentInterrupt.args).join(" ");
              return args.length > 50 ? args.substring(0, 50) + "..." : args;
            })()}{" "}
            (yes/no/custom)
          </Text>
        </Box>
      )}

      {/* Cooking icon above input when loading */}
      {loadingLogs && (
        <Box paddingX={2} paddingY={1}>
          <Text>Thinking...</Text>
        </Box>
      )}

      {/* Fixed input area at bottom */}
      <Box
        flexDirection="column"
        paddingX={2}
        borderStyle="single"
        borderTop
        height={3}
        flexShrink={0}
        justifyContent="center"
      >
        <Box>
          {replayFile ? (
            <Text>&gt; Replay mode - input disabled</Text>
          ) : !configValid ? (
            <Text>&gt; Setting up API keys...</Text>
          ) : (
            <CustomInput
              onSubmit={(value) => {
                // Handle interrupt approval responses
                if (currentInterrupt && streamingService) {
                  streamingService.submitInterruptResponse(value);
                  return;
                }

                if (!streamingService) {
                  // First message - create new session
                  setHasStartedChat(true);
                  // Clear logs only for first message
                  setLogs([]);

                  const newStreamingService = new StreamingService({
                    setLogs,
                    setLoadingLogs,
                    setCurrentInterrupt,
                    setStreamingPhase: () => {},
                  });

                  setStreamingService(newStreamingService);
                  newStreamingService.startNewSession(value);
                } else {
                  // If stream is active, submit to existing stream
                  // If stream is not active, also submit to existing stream
                  streamingService.submitToExistingStream(value);
                }
              }}
            />
          )}
        </Box>
      </Box>

          {/* Local mode indicator underneath the input bar */}
          <Box paddingX={2} paddingY={0}>
            <Text>
              Working on {process.env.OPEN_SWE_LOCAL_PROJECT_PATH} • Ctrl+C to exit
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
};

render(<App />);
