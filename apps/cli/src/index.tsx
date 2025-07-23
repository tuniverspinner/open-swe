"use client"
import React, { useState, useEffect, useRef, useCallback } from "react";
import { render, Box, Text, useInput } from "ink";
import { startAuthServer, getAccessToken, getInstallationAccessToken } from "./auth-server.js";
import open from "open";
import TerminalInterface from "./TerminalInterface.js";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";
import { encryptSecret } from "../../../packages/shared/dist/crypto.js";
import { MANAGER_GRAPH_ID } from "../../../packages/shared/dist/constants.js";
import { Client } from "@langchain/langgraph-sdk";
import type { StreamMode } from "@langchain/langgraph-sdk";


const LANGGRAPH_URL = process.env.LANGGRAPH_URL || "http://localhost:2024";

// Start the auth server immediately so callback URLs always work
startAuthServer();

const CustomInput: React.FC<{ onSubmit: (value: string) => void }> = ({ onSubmit }) => {
	const [value, setValue] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);

	useInput((input, key) => {
		if (isSubmitted) return;
		if (key.return) {
			setIsSubmitted(true);
			onSubmit(value);
		} else if (key.backspace || key.delete) {
			setValue(prev => prev.slice(0, -1));
		} else if (input) {
			setValue(prev => prev + input);
		}
	});

	if (isSubmitted) return null;

	return (
		<Box>
			<Text color="cyan">&gt; {value}</Text>
		</Box>
	);
};

const RepoSearchSelect: React.FC<{ repos: any[]; onSelect: (repo: any) => void }> = ({ repos, onSelect }) => {
	const [search, setSearch] = useState("");
	const [highlighted, setHighlighted] = useState(0);
	const [isSubmitted, setIsSubmitted] = useState(false);

	const filtered = repos.filter(repo => repo.full_name.toLowerCase().includes(search.toLowerCase()));
	const shown = filtered.slice(0, 10);

	useInput((input, key) => {
		if (isSubmitted) return;
		if (key.return) {
			if (shown.length > 0) {
				setIsSubmitted(true);
				onSelect(shown[highlighted]);
			}
		} else if (key.upArrow) {
			setHighlighted(h => (h - 1 + shown.length) % shown.length);
		} else if (key.downArrow) {
			setHighlighted(h => (h + 1) % shown.length);
		} else if (key.backspace || key.delete) {
			setSearch(prev => prev.slice(0, -1));
			setHighlighted(0);
		} else if (input && !key.ctrl && !key.meta) {
			setSearch(prev => prev + input);
			setHighlighted(0);
		}
	});

	if (isSubmitted) return null;

	return (
		<Box flexDirection="column">
			<Box>
				<Text color="cyan">Search repositories: {search}</Text>
			</Box>
			{shown.length === 0 ? (
				<Box><Text color="gray">No matches found.</Text></Box>
			) : (
				<Box flexDirection="column" marginTop={1}>
					{shown.map((repo, idx) => (
						<Text key={repo.id} color={idx === highlighted ? "magenta" : "white"}>
							{idx === highlighted ? "> " : "  "}{repo.full_name}
						</Text>
					))}
				</Box>
			)}
			<Box marginTop={1}><Text dimColor color="gray">Use ↑/↓ to navigate, Enter to select</Text></Box>
		</Box>
	);
};

async function fetchUserRepos(token: string) {
	const allRepos = [];
	let page = 1;
	const perPage = 100;
	while (true) {
		const res = await fetch(`https://api.github.com/user/repos?per_page=${perPage}&page=${page}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'open-swe-cli',
			},
		});
		if (!res.ok) throw new Error('Failed to fetch repos');
		const repos = await res.json();
		allRepos.push(...repos);
		if (repos.length < perPage) break;
		page++;
	}
	return allRepos;
}

const StreamTerminal: React.FC<{
  prompt: string;
  repo: any;
  onDone: () => void;
  logsRef: React.MutableRefObject<string[]>;
  setLogs: (logs: string[]) => void;
  setStreamedOutput: (output: string[]) => void;
}> = ({ prompt, repo, onDone, logsRef, setLogs, setStreamedOutput }) => {
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Set this to true to always show logs
  const SHOW_LOGS = true;
  const chunksRef = useRef<string[]>([]);
  const runIdsRef = useRef<Set<string>>(new Set());
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    let cancelled = false;
    chunksRef.current = [];
    runIdsRef.current = new Set();
    setOutput([]);
    setError(null);
    setStreamedOutput([]);
    (async () => {
      // --- Construct payload and headers ---
      const userAccessToken = getAccessToken();
      const installationAccessToken = await getInstallationAccessToken();
      const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
      if (!userAccessToken || !installationAccessToken || !encryptionKey) {
        setError("Missing access tokens or SECRETS_ENCRYPTION_KEY. Please authenticate, install the app, and set the encryption key.");
        return;
      }
      const encryptedUserToken = encryptSecret(userAccessToken, encryptionKey);
      const encryptedInstallationToken = encryptSecret(installationAccessToken, encryptionKey);
      const [owner, repoName] = repo.full_name.split("/");
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
          branch: repo.default_branch || "main",
        },
        autoAcceptPlan: false,
      };
      try {
        const client = new Client({
          apiUrl: LANGGRAPH_URL,
          defaultHeaders: {
            "x-github-access-token": encryptedUserToken,
            "x-github-installation-token": encryptedInstallationToken,
            "x-github-installation-name": owner,
          },
        });
        // Create a thread and get its threadId
        const thread = await client.threads.create();
        const threadId = thread["thread_id"];
        // Helper to stream and collect output, and recursively follow planner/programmer subgraph sessions
        async function streamPlannerProgrammer(threadId: string, runId: string) {
          let lastPlanStr = null;
          // Stream the current run
          for await (const chunk of client.runs.joinStream(threadId, runId)) {
            // Always log every chunk/event
            logsRef.current.push(`[stream] event: ${chunk.event} data: ${JSON.stringify(chunk.data)}`);
            setLogs([...logsRef.current]);
            let str = "";
            let color: string | undefined = undefined;
            // AI/Human messages (from messages-tuple or values events)
            if (chunk.event === "messages-tuple" && Array.isArray(chunk.data)) {
              const [msg, meta] = chunk.data;
              if (msg.type === "human") {
                let userText = "";
                if (Array.isArray(msg.content)) {
                  userText = msg.content.map((c: any) => c.text).join(" ");
                } else if (typeof msg.content === "string") {
                  userText = msg.content;
                }
                if (userText.trim().length > 0) {
                  str = `You: ${userText}`;
                  color = "cyan";
                } else {
                  continue;
                }
              } else if (msg.type === "ai") {
                let aiText = "";
                let reasoning = "";
                if (Array.isArray(msg.content)) {
                  aiText = msg.content.map((c: any) => c.text).join(" ");
                  // Look for reasoning/internal_reasoning/plan/step in content blocks
                  for (const c of msg.content) {
                    if (c.type === "tool_use" && c.input) {
						str += c.input;
                      try {
                        const inputObj = typeof c.input === "string" ? JSON.parse(c.input) : c.input;
                        if (inputObj.internal_reasoning) {
                          reasoning = inputObj.internal_reasoning;
                        } else if (inputObj.reasoning) {
                          reasoning = inputObj.reasoning;
                        } else if (inputObj.plan) {
                          reasoning = inputObj.plan;
                        } else if (inputObj.step) {
                          reasoning = inputObj.step;
                        }
                        if (inputObj.command) {
                          // Show command/action as well
                          str += `\n\x1b[35m[Action] ${inputObj.command}\x1b[0m`;
                        }
                      } catch {}
                    }
                  }
                } else if (typeof msg.content === "string") {
                  aiText = msg.content;
                }
                if (aiText.trim().length > 0) {
                  str = `AI: ${aiText}`;
                  color = "yellow";
                }
                if (reasoning && reasoning.trim().length > 0) {
                  str += `\n\x1b[32m[Reasoning] ${reasoning}\x1b[0m`;
                }
                if (!str) continue;
              }
            } else if (chunk.event === "values" && chunk.data && Array.isArray(chunk.data.messages)) {
              // Fallback: show last message in values
              const lastMsg = chunk.data.messages[chunk.data.messages.length - 1];
              if (lastMsg) {
                if (lastMsg.type === "human") {
                  let userText = "";
                  if (Array.isArray(lastMsg.content)) {
                    userText = lastMsg.content.map((c: any) => c.text).join(" ");
                  } else if (typeof lastMsg.content === "string") {
                    userText = lastMsg.content;
                  }
                  if (userText.trim().length > 0) {
                    str = `You: ${userText}`;
                    color = "cyan";
                  } else {
                    continue;
                  }
                } else if (lastMsg.type === "ai") {
                  let aiText = "";
                  let reasoning = "";
                  if (Array.isArray(lastMsg.content)) {
                    aiText = lastMsg.content.map((c: any) => c.text).join(" ");
                    for (const c of lastMsg.content) {
                      if (c.type === "tool_use" && c.input) {
                        try {
                          const inputObj = typeof c.input === "string" ? JSON.parse(c.input) : c.input;
                          if (inputObj.internal_reasoning) {
                            reasoning = inputObj.internal_reasoning;
                          } else if (inputObj.reasoning) {
                            reasoning = inputObj.reasoning;
                          } else if (inputObj.plan) {
                            reasoning = inputObj.plan;
                          } else if (inputObj.step) {
                            reasoning = inputObj.step;
                          }
                          if (inputObj.command) {
                            str += `\n\x1b[35m[Action] ${inputObj.command}\x1b[0m`;
                          }
                        } catch {}
                      }
                    }
                  } else if (typeof lastMsg.content === "string") {
                    aiText = lastMsg.content;
                  }
                  if (aiText.trim().length > 0) {
                    str = `AI: ${aiText}`;
                    color = "yellow";
                  }
                  if (reasoning && reasoning.trim().length > 0) {
                    str += `\n\x1b[32m[Reasoning] ${reasoning}\x1b[0m`;
                  }
                  if (!str) continue;
                }
              }
            } else if (
              chunk.event === "custom" && chunk.data && chunk.data.type === "plan_step"
            ) {
              // Plan/step event (custom event)
              str = `[Plan Step] ${chunk.data.title || JSON.stringify(chunk.data)}`;
              color = "green";
            } else if (
              chunk.event === "tool_call" ||
              chunk.event === "tool_calls" ||
              (chunk.data && chunk.data.name && ["shell", "search", "install_dependencies"].includes(chunk.data.name))
            ) {
              // Tool call result or known tool action
              let actionStr = "";
              if (chunk.data && chunk.data.name) {
                // Show the command/args for the tool call
                if (chunk.data.name === "shell" && chunk.data.args && chunk.data.args.command) {
                  actionStr = `Running shell: ${Array.isArray(chunk.data.args.command) ? chunk.data.args.command.join(" ") : chunk.data.args.command}`;
                } else if (chunk.data.name === "search" && chunk.data.args && chunk.data.args.query) {
                  actionStr = `Running search: ${chunk.data.args.query}`;
                } else if (chunk.data.name === "install_dependencies" && chunk.data.args && chunk.data.args.packages) {
                  actionStr = `Running install_dependencies: ${Array.isArray(chunk.data.args.packages) ? chunk.data.args.packages.join(", ") : chunk.data.args.packages}`;
                } else {
                  actionStr = `Running ${chunk.data.name}`;
                }
              }
              str = actionStr;
              color = "magenta";
              // If there is output, show it as a tool result
              if (chunk.data && chunk.data.output) {
                str += `\n[Tool Result] ${chunk.data.output}`;
              }
            } else {
              // Ignore all other events
              continue;
            }
            if (str) {
              chunksRef.current.push(color ? `\x1b[${color === "cyan" ? 36 : color === "yellow" ? 33 : color === "magenta" ? 35 : color === "green" ? 32 : color === "red" ? 31 : 0}m${str}\x1b[0m` : str);
              setOutput([...chunksRef.current]);
              setStreamedOutput([...chunksRef.current]);
            }
            // After each chunk, check for a new plan and display if found
            const threadInfo = await client.threads.get(threadId);
            let plan = null;
            if (threadInfo?.values && typeof threadInfo.values === 'object' && !Array.isArray(threadInfo.values)) {
              const valuesObj = threadInfo.values as Record<string, any>;
              plan =
                valuesObj.taskPlan ||
                valuesObj.proposedPlan ||
                valuesObj.plan ||
                (valuesObj.plannerSession && (valuesObj.plannerSession.taskPlan || valuesObj.plannerSession.proposedPlan || valuesObj.plannerSession.plan)) ||
                null;
            }
            if (plan && (
              (Array.isArray(plan) && plan.length > 0) ||
              (typeof plan === "object" && !Array.isArray(plan) && Object.keys(plan).length > 0) ||
              (typeof plan === "string" && plan.trim().length > 0)
            )) {
              let planStr = "";
              if (Array.isArray(plan)) {
                planStr = plan.map((item: any, idx: number) => `  - ${typeof item === 'string' ? item : JSON.stringify(item)}`).join("\n");
              } else if (typeof plan === 'object') {
                planStr = Object.entries(plan).map(([k, v]) => `  - ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join("\n");
              } else {
                planStr = String(plan);
              }
              if (planStr && planStr !== lastPlanStr) {
                const planBlock = `\x1b[32m[Proposed Plan]\n${planStr}\x1b[0m`;
                chunksRef.current.push(planBlock);
                setOutput([...chunksRef.current]);
                setStreamedOutput([...chunksRef.current]);
                lastPlanStr = planStr;
              }
            }
          }
          // After streaming, check for planner/programmer subgraph sessions
          const threadInfo = await client.threads.get(threadId);
          const possibleSessionKeys = ["plannerSession", "programmerSession"];
          if (threadInfo?.values && typeof threadInfo.values === 'object' && !Array.isArray(threadInfo.values)) {
            const valuesObj = threadInfo.values as Record<string, any>;
            for (const key of possibleSessionKeys) {
              const session = valuesObj[key];
              if (session && typeof session === 'object' && typeof session.threadId === 'string' && typeof session.runId === 'string') {
                if (!runIdsRef.current.has(session.runId)) {
                  runIdsRef.current.add(session.runId);
                  await streamPlannerProgrammer(session.threadId, session.runId);
                }
              }
            }
          }
        }
        // Start the initial run and stream logs/output
        const streamModes: StreamMode[] = ["values", "messages-tuple", "custom"];
        const run = await client.runs.create(
          threadId,
          MANAGER_GRAPH_ID,
          {
            input: runInput,
            config: { recursion_limit: 400 },
            ifNotExists: "create",
            streamResumable: true,
            streamMode: streamModes,
          }
        );
        if (run && run.run_id) {
          runIdsRef.current.add(run.run_id);
          await streamPlannerProgrammer(threadId, run.run_id);
        }
        // After all streaming, show the proposed plan if present
        onDone();
      } catch (err: any) {
        setError(err?.message || String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [prompt, repo]);

  // Only show logs and streamed output
  return (
    <Box flexDirection="column">
      <Text color="yellow">Streaming output for: {prompt}</Text>
      {SHOW_LOGS && logsRef.current.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray">--- Logs ---</Text>
          {logsRef.current.map((log, idx) => (
            <Text key={idx} color="gray">{log}</Text>
          ))}
          <Text color="gray">--- End Logs ---</Text>
        </Box>
      )}
      {error ? (
        <Text color="red">{error}</Text>
      ) : output.length > 0 ? (
        output.map((msg, idx) => <Text key={idx}>{msg}</Text>)
      ) : (
        <Text color="gray">Waiting for output...</Text>
      )}
    </Box>
  );
};

const App: React.FC = () => {
	const [authPrompt, setAuthPrompt] = useState<null | boolean>(null);
	const [authInput, setAuthInput] = useState("");
	const [submitted, setSubmitted] = useState<string | null>(null);
	const [exit, setExit] = useState(false);
	const [authStarted, setAuthStarted] = useState(false);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [repos, setRepos] = useState<any[]>([]);
	const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
	const [selectingRepo, setSelectingRepo] = useState(false);
	const [activePrompt, setActivePrompt] = useState<string | null>(null);
	const [logs, setLogs] = useState<string[]>([]);
	const logsRef = useRef<string[]>([]);
  const [streamedOutput, setStreamedOutput] = useState<string[]>([]);

	const APP_NAME = process.env.GITHUB_APP_NAME || '';
	const INSTALLATION_CALLBACK_URL = `http://localhost:3000/api/auth/github/callback`;

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
					.then(repos => {
						setRepos(repos);
						setSelectingRepo(true);
					})
					.catch(err => {
						console.error("Failed to fetch repos:", err);
					});
			}
		}
	}, [isLoggedIn, repos.length]);

	// Listen for Cmd+C/Ctrl+C to re-select repo
	useInput((input, key) => {
		if (selectedRepo && (key.ctrl || key.meta) && input.toLowerCase() === 'c') {
			setSelectingRepo(true);
			setSelectedRepo(null);
		}
	});

	// Handle yes/no input for auth prompt
	useInput((input, key) => {
		if (authPrompt === null && !isLoggedIn) {
			if (key.return) {
				if (authInput.toLowerCase() === "y") {
					setAuthPrompt(true);
				} else if (authInput.toLowerCase() === "n") {
					setAuthPrompt(false);
					setExit(true);
				}
			} else if (key.backspace || key.delete) {
				setAuthInput(prev => prev.slice(0, -1));
			} else if (input && authInput.length < 1) {
				// Only allow a single character (y/n)
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
			open("http://localhost:3000/api/auth/github/login");
		}
	}, [authPrompt, authStarted]);

	const onDone = useCallback(() => setActivePrompt(null), [setActivePrompt]);

	if (isLoggedIn && repos.length > 0 && (selectingRepo || !selectedRepo)) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box justifyContent="center" marginBottom={1}>
					<Text bold color="magenta">LangChain Open SWE CLI</Text>
				</Box>
				<Box flexDirection="column" marginBottom={1}>
					<Text>Select a repository to work with (type to search):</Text>
				</Box>
				<Box borderStyle="round" borderColor="gray" paddingX={2} paddingY={1} marginTop={1} marginBottom={1}>
					<RepoSearchSelect repos={repos} onSelect={async repo => {
						let appSlug = APP_NAME;
						if (!appSlug) {
							console.log('Please enter your GitHub App slug (as in https://github.com/apps/<slug>):');
							process.stdin.resume();
							process.stdin.setEncoding('utf8');
							appSlug = await new Promise(resolve => {
								process.stdin.once('data', data => resolve(String(data).trim()));
							});
						}
						const installUrl = `https://github.com/apps/${appSlug}/installations/new?redirect_uri=${encodeURIComponent(INSTALLATION_CALLBACK_URL)}`;
						console.log('Opening GitHub App installation page in your browser...');
						await open(installUrl);
						console.log('After installing the app, your repository will be selected.');
						setSelectedRepo(repo);
						setSelectingRepo(false);
						return;
					}} />
				</Box>
			</Box>
		);
	}

	if (isLoggedIn && selectedRepo && activePrompt) {
		return <StreamTerminal
        prompt={activePrompt}
        repo={selectedRepo}
        onDone={onDone}
        logsRef={logsRef}
        setLogs={setLogs}
        setStreamedOutput={setStreamedOutput}
      />;
	}

	if (isLoggedIn && selectedRepo) {
		return <TerminalInterface
			submitted={submitted}
			setSubmitted={async (val) => {
				setSubmitted(val);
				if (val) {
          setStreamedOutput([]); // clear output for new prompt
					setActivePrompt(val);
				}
			}}
			CustomInput={CustomInput}
			repoName={selectedRepo.full_name}
			logs={logs}
      streamedOutput={streamedOutput}
		/>;
	}

	if (authPrompt === null) {
		return (
			<Box flexDirection="column" padding={1}>
				<Box justifyContent="center" marginBottom={1}>
					<Text bold color="magenta">LangChain Open SWE CLI</Text>
				</Box>
				<Box borderStyle="round" borderColor="gray" paddingX={2} paddingY={1} marginTop={1} marginBottom={1}>
					<Text>
						Do you want to start the GitHub authentication flow? (y/n) {authInput}
					</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Box justifyContent="center" marginBottom={1}>
				<Text bold color="magenta">LangChain Open SWE CLI</Text>
			</Box>
			{!submitted && (
				<CustomInput onSubmit={setSubmitted} />
			)}
			{submitted && (
				<Box marginTop={1}>
					<Text color="green">You typed: {submitted}</Text>
				</Box>
			)}
		</Box>
	);
};

render(<App />);