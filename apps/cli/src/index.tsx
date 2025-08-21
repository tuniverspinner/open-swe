#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput } from "ink";
import { Command } from "commander";
import { OPEN_SWE_CLI_VERSION } from "./constants.js";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

// Handle graceful exit on Ctrl+C and Ctrl+K
process.on("SIGINT", () => {
  console.log("\n👋 Goodbye!");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Goodbye!");
  process.exit(0);
});

import { StreamingService } from "./streaming.js";

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

const LoadingSpinner: React.FC<{ text: string }> = ({ text }) => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box justifyContent="center" paddingY={2}>
      <Text>
        {text}
        {dots}
      </Text>
    </Box>
  );
};
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

const App: React.FC = () => {
  const [streamingPhase, setStreamingPhase] = useState<
    "streaming" | "done"
  >("streaming");
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [streamingService, setStreamingService] = useState<StreamingService | null>(null);

  const options = program.opts();
  const replayFile = options.replay;
  const playbackSpeed = parseInt(options.speed) || 500;

  // Auto-start replay if file provided
  useEffect(() => {
    if (replayFile && !hasStartedChat) {
      try {
        const traceData = JSON.parse(fs.readFileSync(replayFile, 'utf8'));
        setHasStartedChat(true);
        
        const newStreamingService = new StreamingService({
          setLogs,
          setStreamingPhase,
          setLoadingLogs,
          targetPath: process.env.OPEN_SWE_LOCAL_PROJECT_PATH || "",
        });
        
        setStreamingService(newStreamingService);
        newStreamingService.replayFromTrace(traceData, playbackSpeed);
      } catch (err: any) {
        console.error('Error loading replay file:', err.message);
        process.exit(1);
      }
    }
  }, [replayFile, hasStartedChat, playbackSpeed]);


  const inputHeight = 4;
  const welcomeHeight = hasStartedChat ? 0 : 8;
  const availableHeight = process.stdout.rows - inputHeight - 1; // Reserve space for input + status bar

  return (
    <Box flexDirection="column" height={process.stdout.rows}>

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
        <Box flexDirection="column" height={availableHeight} paddingX={2} paddingY={1}>
          {loadingLogs && logs.length === 0 ? (
            <LoadingSpinner text="Starting session" />
          ) : (
            <Box flexDirection="column" height={availableHeight - 2} justifyContent="flex-end">
              {logs.map((log, index) => {
                const isToolCall = log.startsWith("▸");
                const isToolResult = log.startsWith("  ↳");
                const isAIMessage = log.startsWith("◆");
                
                return (
                  <Box 
                    key={index} 
                    paddingLeft={isToolCall ? 1 : isToolResult ? 2 : 0}
                    paddingX={isAIMessage ? 1 : 0}
                    borderStyle={isAIMessage ? "round" : undefined}
                    borderColor={isAIMessage ? "magenta" : undefined}
                  >
                    <Text color={isAIMessage ? "magenta" : undefined} bold={isAIMessage}>
                      {log}
                    </Text>
                  </Box>
                );
              })}
              {loadingLogs && (
                <LoadingSpinner text="Processing" />
              )}
            </Box>
          )}
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
          ) : (
            <CustomInput
              onSubmit={(value) => {
                if (!streamingService) {
                  // First message - create new session
                  setHasStartedChat(true);

                  const newStreamingService = new StreamingService({
                    setLogs,
                    setStreamingPhase,
                    setLoadingLogs,
                    targetPath: process.env.OPEN_SWE_LOCAL_PROJECT_PATH || "",
                  });

                  setStreamingService(newStreamingService);
                  newStreamingService.startNewSession(value);
                } else {
                  // Subsequent messages - submit to existing stream
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
    </Box>
  );
};

render(<App />);
