#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput } from "ink";
import {
  startAuthServer,
  getAccessToken,
  getInstallationAccessToken,
  getInstallationId,
} from "./auth-server.js";
import open from "open";
import { v4 as uuidv4 } from "uuid";
import { encryptSecret } from "../../../packages/shared/dist/crypto.js";
import { MANAGER_GRAPH_ID, PLANNER_GRAPH_ID } from "../../../packages/shared/dist/constants.js";
import { Client } from "@langchain/langgraph-sdk";
import { formatDisplayLog } from "./logger.js";

const LANGGRAPH_URL = process.env.LANGGRAPH_URL || "http://localhost:2024";
const LOG_AREA_HEIGHT = 20;
const GITHUB_LOGIN_URL = process.env.GITHUB_LOGIN_URL || "http://localhost:3000/api/auth/github/login";

// Start the auth server immediately so callback URLs always work
startAuthServer();

const CustomInput: React.FC<{ onSubmit: (value: string) => void }> = ({ onSubmit }) => {
  const [input, setInput] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useInput((inputChar: string, key: { [key: string]: any }) => {
    if (isSubmitted) return;
    if (key.return) {
      setIsSubmitted(true);
      onSubmit(input);
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (inputChar) {
      setInput((prev) => prev + inputChar);
    }
  });

  if (isSubmitted) return null;

  return (
    <Box>
      <Text>&gt; {input}</Text>
    </Box>
  );
};

// Remove StreamTerminal. We'll render logs directly in the main UI.

async function fetchUserRepos(token: string) {
  const allRepos = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "open-swe-cli",
        },
      },
    );
    if (!res.ok) throw new Error("Failed to fetch repos");
    const repos = await res.json();
    allRepos.push(...repos);
    if (repos.length < perPage) break;
    page++;
  }
  return allRepos;
}

const RepoSearchSelect: React.FC<{
  repos: any[];
  onSelect: (repo: any) => void;
}> = ({ repos, onSelect }) => {
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [isMessage, setIsMessage] = useState(false);

  const filtered = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(search.toLowerCase()),
  );
  const shown = filtered.slice(0, 10);

  useInput((input: string, key: { [key: string]: any }) => {
    if (isMessage) return;
    if (key.return) {
      if (shown.length > 0) {
        setIsMessage(true);
        onSelect(shown[highlighted]);
      }
    } else if (key.upArrow) {
      setHighlighted((h) => (h - 1 + shown.length) % shown.length);
    } else if (key.downArrow) {
      setHighlighted((h) => (h + 1) % shown.length);
    } else if (key.backspace || key.delete) {
      setSearch((prev) => prev.slice(0, -1));
      setHighlighted(0);
    } else if (input && !key.ctrl && !key.meta) {
      setSearch((prev) => prev + input);
      setHighlighted(0);
    }
  });

  if (isMessage) return null;

  return (
    <Box flexDirection="column">
      <Box>
        <Text>Search repositories: {search}</Text>
      </Box>
      {shown.length === 0 ? (
        <Box>
          <Text dimColor>No matches found.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {shown.map((_, idx) => (
            <Text
              key={shown[idx].id}
              dimColor={idx !== highlighted}
            >
              {idx === highlighted ? "> " : "  "}
              {shown[idx].full_name}
            </Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          Use ↑/↓ to navigate, Enter to select
        </Text>
      </Box>
    </Box>
  );
};

// Copy isAgentInboxInterruptSchema from web/src/lib/agent-inbox-interrupt.ts
function isAgentInboxInterruptSchema(value: unknown): boolean {
  const valueAsObject = Array.isArray(value) ? value[0] : value;
  return (
    valueAsObject &&
    typeof valueAsObject === "object" &&
    "action_request" in valueAsObject &&
    typeof valueAsObject.action_request === "object" &&
    "config" in valueAsObject &&
    typeof valueAsObject.config === "object" &&
    "allow_respond" in valueAsObject.config &&
    "allow_accept" in valueAsObject.config &&
    "allow_edit" in valueAsObject.config &&
    "allow_ignore" in valueAsObject.config
  );
}

const App: React.FC = () => {
  const [authPrompt, setAuthPrompt] = useState<null | boolean>(null);
  const [authInput, setAuthInput] = useState("");
  const [exit, setExit] = useState(false);
  const [authStarted, setAuthStarted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [selectingRepo, setSelectingRepo] = useState(false);
  const [waitingForInstall, setWaitingForInstall] = useState(false);
  const [installChecked, setInstallChecked] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [appSlug, setAppSlug] = useState(process.env.GITHUB_APP_NAME || "");
  const INSTALLATION_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || "";
  const [pollingForToken, setPollingForToken] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [prompt, setPrompt] = useState<string>("");
  // Remove debugInfo state
  const [awaitingPlannerFeedback, setAwaitingPlannerFeedback] = useState(false);
  const [plannerFeedback, setPlannerFeedback] = useState<string | null>(null);
  const [streamingPhase, setStreamingPhase] = useState<"streaming" | "awaitingFeedback" | "done">("streaming");
  const [pendingInterrupt, setPendingInterrupt] = useState<any>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [plannerThreadId, setPlannerThreadId] = useState<string | null>(null);
  const [programmerThreadId, setProgrammerThreadId] = useState<string | null>(null);
  const [hasStartedChat, setHasStartedChat] = useState(false);

  // On mount, check for existing token
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  // After login, fetch and store user repos
  useEffect(() => {
    if (isLoggedIn && repos.length === 0) {
      const token = getAccessToken();
      if (token) {
        fetchUserRepos(token)
          .then((repos) => {
            setRepos(repos);
            setSelectingRepo(true);
          })
          .catch((err) => {
            console.error("Failed to fetch repos:", err);
          });
      }
    }
  }, [isLoggedIn, repos.length]);

  // Poll for installation_id after opening install page
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (waitingForInstall) {
      interval = setInterval(() => {
        // Check if installation_id is present in config file
        const installationId = getInstallationId();
        if (installationId) {
          setInstallChecked(true);
          setWaitingForInstall(false);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [waitingForInstall]);

  // Listen for Cmd+C/Ctrl+C to re-select repo
  useInput((input: string, key: { [key: string]: any }) => {
    if (installChecked && !waitingForInstall && key.return) {
      setInstallChecked(false);
      setSelectingRepo(false);
    }
    if (selectedRepo && (key.ctrl || key.meta) && input.toLowerCase() === "c") {
      setSelectingRepo(true);
      setSelectedRepo(null);
    }
  });

  // Handle yes/no input for auth prompt
  useInput((input: string, key: { [key: string]: any }) => {
    if (authPrompt === null && !isLoggedIn) {
      if (key.return) {
        if (authInput.toLowerCase() === "y") {
          setAuthPrompt(true);
        } else if (authInput.toLowerCase() === "n") {
          setAuthPrompt(false);
          setExit(true);
        }
      } else if (key.backspace || key.delete) {
        setAuthInput((prev) => prev.slice(0, -1));
      } else if (input && authInput.length < 1) {
        setAuthInput(input);
      }
    }
  });

  // Exit the process safely after render
  useEffect(() => {
    if (exit) {
      process.exit(0);
    }
  }, [exit]);

  // Start auth server and open browser when user says yes
  useEffect(() => {
    if (authPrompt === true && !authStarted) {
      setAuthStarted(true);
      startAuthServer();
      open(GITHUB_LOGIN_URL);
      setPollingForToken(true);
    }
  }, [authPrompt, authStarted]);

  // Poll for token after auth flow starts
  useEffect(() => {
    if (pollingForToken && !isLoggedIn) {
      const interval = setInterval(() => {
        const token = getAccessToken();
        if (token) {
          setIsLoggedIn(true);
          setPollingForToken(false);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pollingForToken, isLoggedIn]);

  // Custom input for planner feedback (must be inside App)
  const PlannerFeedbackInput: React.FC = () => {
    const [input, setInput] = useState("");
    useInput((inputChar: string, key: { [key: string]: any }) => {
      if (streamingPhase !== "awaitingFeedback") return;
      if (key.return) {
        if (input.trim().toLowerCase() === "approve" || input.trim().toLowerCase() === "deny") {
          setPlannerFeedback(input.trim().toLowerCase());
        }
      } else if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1));
      } else if (inputChar) {
        setInput((prev) => prev + inputChar);
      }
    });
    if (streamingPhase !== "awaitingFeedback") return null;
    return (
      <Box>
        <Text>Plan feedback (approve/deny): {input}</Text>
      </Box>
    );
  };

  // Streaming logic: when prompt is set, stream logs
  useEffect(() => {
    if (prompt && selectedRepo && streamingPhase === "streaming") {
      setIsStreaming(true);
      setLogs([]);
      setPlannerFeedback(null);
      setPendingInterrupt(null);
      (async () => {
        try {
          const userAccessToken = getAccessToken();
          const installationAccessToken = await getInstallationAccessToken();
          const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
          if (!userAccessToken || !installationAccessToken || !encryptionKey) {
            setLogs(["Missing access tokens or SECRETS_ENCRYPTION_KEY."]);
            setIsStreaming(false);
            return;
          }
          const encryptedUserToken = encryptSecret(userAccessToken, encryptionKey);
          const encryptedInstallationToken = encryptSecret(installationAccessToken, encryptionKey);
          const [owner, repoName] = selectedRepo.full_name.split("/");
          const runInput = {
            messages: [
              {
                id: uuidv4(),
                type: "human",
                content: [{ type: "text", text: prompt }],
              },
            ],
            targetRepository: {
              owner,
              repo: repoName,
              branch: selectedRepo.default_branch || "main",
            },
            autoAcceptPlan: false,
          };
          const client = new Client({
            apiUrl: LANGGRAPH_URL,
            defaultHeaders: {
              "x-github-access-token": encryptedUserToken,
              "x-github-installation-token": encryptedInstallationToken,
              "x-github-installation-name": owner,
            },
          });
          const thread = await client.threads.create();
          const threadId = thread["thread_id"];
          setThreadId(threadId);
          const run = await client.runs.create(
            threadId,
            MANAGER_GRAPH_ID,
            {
              input: runInput,
              config: { recursion_limit: 400 },
              ifNotExists: "create",
              streamResumable: true,
              streamSubgraphs: true,
              streamMode: ["values", "messages"],
            }
          );
		  
          let plannerStreamed = false;
          let programmerStreamed = false;
          for await (const chunk of client.runs.joinStream(threadId, run.run_id)) {
            const formatted = formatDisplayLog(chunk);
            if (formatted.length > 0) {
              setLogs(prev => [...prev, ...formatted]);
            }
            // Check for plannerSession
            if (
              !plannerStreamed &&
              chunk.data &&
              chunk.data.plannerSession &&
              typeof chunk.data.plannerSession.threadId === "string" &&
              typeof chunk.data.plannerSession.runId === "string"
            ) {
              plannerStreamed = true;
              setPlannerThreadId(chunk.data.plannerSession.threadId);
              for await (const subChunk of client.runs.joinStream(
                chunk.data.plannerSession.threadId,
                chunk.data.plannerSession.runId
              )) {
				const formatted = formatDisplayLog(subChunk);
                if (formatted.length > 0) {
                  setLogs(prev => [...prev, ...formatted]);
                }

                // Check for programmer session
                if (
                  !programmerStreamed &&
                  subChunk.data?.programmerSession?.threadId &&
                  typeof subChunk.data.programmerSession.threadId === "string" &&
                  typeof subChunk.data.programmerSession.runId === "string"
                ) {
                  programmerStreamed = true;
                  setProgrammerThreadId(subChunk.data.programmerSession.threadId);
                  for await (const programmerChunk of client.runs.joinStream(
                    subChunk.data.programmerSession.threadId,
                    subChunk.data.programmerSession.runId
                  )) {
                    const formatted = formatDisplayLog(programmerChunk);
                    if (formatted.length > 0) {
                      setLogs(prev => [...prev, ...formatted]);
                    }
                  }
                }

                // Detect HumanInterrupt in planner stream
                const interruptArr = subChunk.data && Array.isArray(subChunk.data["__interrupt__"])
                  ? subChunk.data["__interrupt__"]
                  : undefined;
                const firstInterruptValue = interruptArr && interruptArr[0] && interruptArr[0].value
                  ? interruptArr[0].value
                  : undefined;
                if (isAgentInboxInterruptSchema(firstInterruptValue)) {
                  setPendingInterrupt(firstInterruptValue);
                  setStreamingPhase("awaitingFeedback");
                  return; // Pause streaming, let React render feedback prompt
                }
              }
            }
          }
          setStreamingPhase("done");
        } catch (err: any) {
        } finally {
          setIsStreaming(false);
          setPrompt("");
        }
      })();
    }
  }, [prompt, selectedRepo, streamingPhase]);

  // Add this where we handle planner feedback
  useEffect(() => {
    if (streamingPhase === "awaitingFeedback" && plannerFeedback && plannerThreadId) {
      const submitFeedback = async () => {
        try {
          const userAccessToken = getAccessToken();
          const installationAccessToken = await getInstallationAccessToken();
          const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
          
          if (!userAccessToken || !installationAccessToken || !encryptionKey) {
            return;
          }

          const encryptedUserToken = encryptSecret(userAccessToken, encryptionKey);
          const encryptedInstallationToken = encryptSecret(installationAccessToken, encryptionKey);
          const [owner, repoName] = selectedRepo?.full_name.split("/") || [];

          const client = new Client({
            apiUrl: LANGGRAPH_URL,
            defaultHeaders: {
              "x-github-access-token": encryptedUserToken,
              "x-github-installation-token": encryptedInstallationToken,
              "x-github-installation-name": owner,
            },
          });

          const formatted = formatDisplayLog(`Human feedback: ${plannerFeedback}`);
          if (formatted.length > 0) {
            setLogs(prev => [...prev, ...formatted]);
          }
          
          // Create a new stream with the feedback
          const stream = await client.runs.stream(plannerThreadId, PLANNER_GRAPH_ID, {
            command: { 
              resume: [{
                type: plannerFeedback === 'approve' ? 'accept' : 'ignore',
                args: null
              }]
            },
            streamMode: ["values", "messages"],
          });

          let programmerStreamed = false;
          // Process the stream response
          for await (const chunk of stream) {
			const formatted = formatDisplayLog(chunk);
            if (formatted.length > 0) {
              setLogs(prev => [...prev, ...formatted]);
            }
            
            // Check for programmer session in the resumed planner stream
            const chunkData = chunk.data as any;
            if (
              !programmerStreamed &&
              chunkData?.programmerSession?.threadId &&
              typeof chunkData.programmerSession.threadId === 'string' &&
              typeof chunkData.programmerSession.runId === 'string'
            ) {
              programmerStreamed = true;
              setProgrammerThreadId(chunkData.programmerSession.threadId);
              // Join programmer stream
              for await (const programmerChunk of client.runs.joinStream(
                chunkData.programmerSession.threadId,
                chunkData.programmerSession.runId
              )) {
				const formatted = formatDisplayLog(programmerChunk);
                if (formatted.length > 0) {
                  setLogs(prev => [...prev, ...formatted]);
                }
              }
            }
          }

          // Reset states after streaming completes
          setPlannerFeedback(null);
          setPendingInterrupt(null);
          setStreamingPhase("streaming");

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setLogs(prev => [...prev, `Error submitting feedback: ${errorMessage}`]);
        }
      };

      submitFeedback();
    }
  }, [streamingPhase, plannerFeedback, selectedRepo, plannerThreadId]);

  // Repo selection UI
  if (isLoggedIn && repos.length > 0 && (selectingRepo || !selectedRepo)) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box justifyContent="center" marginBottom={1}>
          <Text bold>LangChain Open SWE CLI</Text>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          <Text>Select a repository to work with (type to search):</Text>
        </Box>
        <Box
          borderStyle="round"
          borderColor="white"
          paddingX={2}
          paddingY={1}
          marginTop={1}
          marginBottom={1}
        >
          <RepoSearchSelect
            repos={repos}
            onSelect={async (repo) => {
              let slug = appSlug;
              const installationId = getInstallationId();
              setSelectedRepo(repo);
              setSelectingRepo(false);
              if (installationId) {
                setInstallChecked(true);
                setWaitingForInstall(false);
                setInstallError(null);
                return;
              }
              if (!slug) {
                console.log(
                  "Please enter your GitHub App slug (as in https://github.com/apps/<slug>):",
                );
                process.stdin.resume();
                process.stdin.setEncoding("utf8");
                slug = await new Promise((resolve) => {
                  process.stdin.once("data", (data) =>
                    resolve(String(data).trim()),
                  );
                });
                setAppSlug(slug);
              }
              const installUrl = `https://github.com/apps/${slug}/installations/new?redirect_uri=${encodeURIComponent(INSTALLATION_CALLBACK_URL)}`;
              console.log(
                "Opening GitHub App installation page in your browser...",
              );
              await open(installUrl);
              setWaitingForInstall(true);
              setInstallChecked(false);
              setInstallError(null);
            }}
          />
        </Box>
        {waitingForInstall && (
          <Box flexDirection="column" marginTop={1}>
            <Text>
              Waiting for GitHub App installation to complete...
            </Text>
            <Text dimColor>
              After installing the app, return here to continue.
            </Text>
          </Box>
        )}
        {installChecked && !waitingForInstall && (
          <Box flexDirection="column" marginTop={1}>
            <Text>
              GitHub App installation detected! You can now proceed.
            </Text>
            <Text dimColor>Press Enter to continue.</Text>
          </Box>
        )}
        {installError && (
          <Box marginTop={1}>
            <Text>{installError}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Main UI: logs area + input prompt
  if (isLoggedIn && selectedRepo) {
    // Calculate available space for logs based on whether welcome message is shown
    const headerHeight = hasStartedChat ? 0 : 9; // Welcome message takes ~9 lines
    const inputHeight = 3; // Fixed input area height
    const availableLogHeight = Math.max(5, process.stdout.rows - headerHeight - inputHeight);
    
    // Always show the most recent logs (auto-scroll to bottom)
    const visibleLogs = logs.length > availableLogHeight 
      ? logs.slice(-availableLogHeight) 
      : logs;
    
    return (
      <Box flexDirection="column" height={process.stdout.rows}>
        {/* Welcome message at top - only show before first chat */}
        {!hasStartedChat && (
          <Box flexDirection="column" paddingX={1} paddingY={1}>
            <Box justifyContent="center">
              <Text>
                {`
 __      __   _                    _         
 \\ \\    / /__| |__ ___ _ __  ___| |_ ___ ___
  \\ \\/\\/ / -_) / _/ _ \\ '  \\/ -_)  _/ _ (_-<
   \\_/\\_/\\___|_\\__\\___/_|_|_\\___|\\__\\___/__/
              `}
              </Text>
            </Box>
            <Box justifyContent="center">
              <Text bold>LangChain Open SWE CLI</Text>
            </Box>
            <Box justifyContent="center" marginY={1}>
              <Text dimColor>Describe your coding problem. It'll run in the sandbox and a PR will be created.</Text>
            </Box>
          </Box>
        )}

        {/* Auto-scrolling logs area */}
        <Box flexGrow={1} flexDirection="column" paddingX={1} paddingBottom={1} justifyContent="flex-end">
          <Box flexDirection="column">
            {visibleLogs.map((log, index) => (
              <Text key={`${logs.length}-${index}`} dimColor>{log}</Text>
            ))}
          </Box>
        </Box>

        {/* Fixed input area at bottom */}
        <Box 
          flexDirection="column" 
          paddingX={1}
          borderStyle="single"
          borderTop
          height={3}
          flexShrink={0}
          justifyContent="center"
        >
          {streamingPhase === "awaitingFeedback" ? (
            <PlannerFeedbackInput />
          ) : (
            <Box>
              <Text dimColor>❯ </Text>
              {!isStreaming && streamingPhase === "streaming" ? (
                <CustomInput onSubmit={(value) => {
                  setHasStartedChat(true);
                  setPrompt(value);
                }} />
              ) : (
                <Text>Streaming...</Text>
              )}
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // Auth prompt UI
  if (!isLoggedIn && authPrompt === null) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box justifyContent="center" marginBottom={1}>
          <Text bold>LangChain Open SWE CLI</Text>
        </Box>
        <Box
          borderStyle="round"
          borderColor="white"
          paddingX={2}
          paddingY={1}
          marginTop={1}
          marginBottom={1}
        >
          <Text>
            Do you want to start the GitHub authentication flow? (y/n) {authInput}
          </Text>
        </Box>
      </Box>
    );
  }

  // Fallback
  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold>LangChain Open SWE CLI</Text>
      </Box>
    </Box>
  );
};

render(<App />);
