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
  const [isDone, setIsDone] = useState(false);
  const [awaitingFollowup, setAwaitingFollowup] = useState(false);
  const [followupPrompt, setFollowupPrompt] = useState("");
  const [threadIdState, setThreadIdState] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const chunksRef = useRef<string[]>([]);
  const runIdsRef = useRef<Set<string>>(new Set());
  const hasStartedRef = useRef(false);

  // Helper to detect if the last message is an AI message expecting a response
  function needsFollowup(messages: any[]): boolean {
    if (!messages || messages.length === 0) return false;
    const last = messages[messages.length - 1];
    // Heuristic: AI message with a question or tool call
    if (last.type === "ai" && last.content && Array.isArray(last.content)) {
      const textBlock = last.content.find((c: any) => c.type === "text");
      if (textBlock && typeof textBlock.text === "string" && textBlock.text.trim().endsWith("?")) {
        return true;
      }
    }
    // TODO: Add more robust checks for tool calls or interrupts if needed
    return false;
  }

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    let cancelled = false;
    chunksRef.current = [];
    runIdsRef.current = new Set();
    setOutput([]);
    setError(null);
    setIsDone(false);
    setAwaitingFollowup(false);
    setFollowupPrompt("");
    setThreadIdState(null);
    setLastRunId(null);
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
        // Create a thread
        const thread = await client.threads.create();
        const threadId = thread["thread_id"];
        setThreadIdState(threadId);
        let currentRunId: string | null = null;
        // Helper to stream and collect output, and recursively follow subgraph sessions
        async function streamAllSubgraphs(threadId: string, runId: string) {
          // Stream the current run
          for await (const chunk of client.runs.joinStream(threadId, runId)) {
            logsRef.current.push(`[stream] event: ${chunk.event} data: ${JSON.stringify(chunk.data)}`);
            setLogs([...logsRef.current]);
            let str = "";
            if (typeof chunk.data === "string") {
              str = chunk.data;
            } else if (chunk.event === "custom" || chunk.event === "tool_calls" || chunk.event === "tool_call" || chunk.event === "interrupt" || chunk.event === "error") {
              str = `[${chunk.event}] ${JSON.stringify(chunk.data, null, 2)}`;
            } else if (chunk.event === "messages" && Array.isArray(chunk.data)) {
              str = chunk.data.map((msg: any) => msg.content ? JSON.stringify(msg.content) : JSON.stringify(msg)).join("\n");
            } else {
              str = JSON.stringify(chunk.data);
            }
            chunksRef.current.push(str);
            setOutput([...chunksRef.current]);
            setStreamedOutput([...chunksRef.current]);
          }
          // After streaming, check for subgraph sessions
          const threadInfo = await client.threads.get(threadId);
          const possibleSessionKeys = ["plannerSession", "programmerSession", "reviewerSession"];
          if (threadInfo?.values && typeof threadInfo.values === 'object' && !Array.isArray(threadInfo.values)) {
            const valuesObj = threadInfo.values as Record<string, any>;
            for (const key of possibleSessionKeys) {
              const session = valuesObj[key];
              if (session && typeof session === 'object' && typeof session.threadId === 'string' && typeof session.runId === 'string') {
                if (!runIdsRef.current.has(session.runId)) {
                  runIdsRef.current.add(session.runId);
                  await streamAllSubgraphs(session.threadId, session.runId);
                }
              }
            }
          }
        }
        // Start the initial stream (create the run and then stream recursively)
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
          await streamAllSubgraphs(threadId, run.run_id);
        }
        // After stream ends, keep joining if still running or if a new run is detected
        while (!cancelled && currentRunId) {
          // Fetch run status
          const run = await client.runs.get(threadId, currentRunId);
          if (run.status === "success" || run.status === "error" || run.status === "timeout" || run.status === "interrupted") {
            break;
          }
          // Check for new background runs on the thread
          const threadInfo = await client.threads.get(threadId);
          if (threadInfo?.metadata) {
            console.log('Thread metadata:', JSON.stringify(threadInfo.metadata));
            logsRef.current.push(`Thread metadata: ${JSON.stringify(threadInfo.metadata)}`);
            setLogs([...logsRef.current]);
          }
          // Find the latest runId if present and is a string
          let latestRunId = (typeof threadInfo?.metadata?.latest_run_id === 'string') ? threadInfo.metadata.latest_run_id : null;

          // --- Enhanced: Check for subgraph session runIds and threadIds in values ---
          const possibleSessionKeys = ["plannerSession", "programmerSession", "reviewerSession"];
          let foundSubgraphRunId: string | null = null;
          let foundSubgraphThreadId: string | null = null;
          if (threadInfo?.values && typeof threadInfo.values === 'object' && !Array.isArray(threadInfo.values)) {
            const valuesObj = threadInfo.values as Record<string, any>;
            for (const key of possibleSessionKeys) {
              const session = valuesObj[key];
              if (session && typeof session === 'object') {
                // If both threadId and runId are present and new, follow them
                if (typeof session.threadId === 'string' && typeof session.runId === 'string') {
                  if (!runIdsRef.current.has(session.runId)) {
                    foundSubgraphThreadId = session.threadId;
                    foundSubgraphRunId = session.runId;
                    break;
                  }
                }
              }
            }
          }

          // Prefer subgraph thread/run if found, else latestRunId from metadata
          if (foundSubgraphThreadId && foundSubgraphRunId && !runIdsRef.current.has(foundSubgraphRunId)) {
            currentRunId = foundSubgraphRunId;
            runIdsRef.current.add(foundSubgraphRunId);
            // Recursively follow subgraph session in new thread
            await (async function joinSubgraphStream(subThreadId: string, subRunId: string) {
              for await (const chunk of client.runs.joinStream(subThreadId, subRunId)) {
                const str = typeof chunk.data === "string" ? chunk.data : JSON.stringify(chunk.data);
                chunksRef.current.push(str);
                if (!cancelled) {
                  setOutput([...chunksRef.current]);
                  setStreamedOutput([...chunksRef.current]);
                }
              }
              // After streaming, check for further subgraph sessions recursively
              const subThreadInfo = await client.threads.get(subThreadId);
              if (subThreadInfo?.values && typeof subThreadInfo.values === 'object' && !Array.isArray(subThreadInfo.values)) {
                const subValuesObj = subThreadInfo.values as Record<string, any>;
                for (const key of possibleSessionKeys) {
                  const subSession = subValuesObj[key];
                  if (subSession && typeof subSession === 'object') {
                    if (typeof subSession.threadId === 'string' && typeof subSession.runId === 'string') {
                      if (!runIdsRef.current.has(subSession.runId)) {
                        runIdsRef.current.add(subSession.runId);
                        await joinSubgraphStream(subSession.threadId, subSession.runId);
                      }
                    }
                  }
                }
              }
            })(foundSubgraphThreadId, foundSubgraphRunId);
          } else if (latestRunId && !runIdsRef.current.has(latestRunId)) {
            currentRunId = latestRunId;
            runIdsRef.current.add(latestRunId);
            await streamAllSubgraphs(threadId, currentRunId!); // Use the main threadId for joining
          } else {
            // No new run, just re-join the current one
            await new Promise(res => setTimeout(res, 1000)); // 1s delay
            await streamAllSubgraphs(threadId, currentRunId!); // Use the main threadId for joining
          }
        }
        // After all streaming, check if follow-up is needed
        const threadInfo = await client.threads.get(threadId);
        let messages: any[] = [];
        if (threadInfo?.values && typeof threadInfo.values === 'object' && !Array.isArray(threadInfo.values)) {
          const valuesObj = threadInfo.values as Record<string, any>;
          if (Array.isArray(valuesObj.messages)) {
            messages = valuesObj.messages;
          }
        }
        if (needsFollowup(messages)) {
          setAwaitingFollowup(true);
        } else {
          if (!cancelled) {
            setIsDone(true);
            onDone();
          }
        }
      } catch (err: any) {
        setError(err?.message || String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [prompt, repo]);

  // Handle follow-up submission
  const handleFollowupSubmit = async () => {
    if (!threadIdState || !lastRunId || !followupPrompt.trim()) return;
    setAwaitingFollowup(false);
    setFollowupPrompt("");
    setError(null);
    setIsDone(false);
    try {
      const client = new Client({ apiUrl: LANGGRAPH_URL });
      const newMessage = {
        id: uuidv4(),
        type: "human",
        content: [{ type: "text", text: followupPrompt.trim() }],
      };
      // Use updateState to append the new message to the thread
      await client.threads.updateState(threadIdState, {
        values: {
          messages: [newMessage],
        },
      });
      // Resume streaming for the same thread
      let cancelled = false;
      chunksRef.current.push(`\n> You: ${followupPrompt.trim()}`);
      setOutput([...chunksRef.current]);
      setStreamedOutput([...chunksRef.current]);
      // Wait for new runId
      let nextRunId = null;
      for (let i = 0; i < 10; i++) {
        const threadInfo = await new Client({ apiUrl: LANGGRAPH_URL }).threads.get(threadIdState);
        const runs = threadInfo?.metadata?.runs || [];
        if (Array.isArray(runs) && runs.length > 0) {
          const latest = runs[runs.length - 1];
          if (latest && latest.run_id && latest.run_id !== lastRunId) {
            nextRunId = latest.run_id;
            break;
          }
        }
        await new Promise(res => setTimeout(res, 1000));
      }
      if (nextRunId) {
        // Stream the new run
        await (async () => {
          for await (const chunk of new Client({ apiUrl: LANGGRAPH_URL }).runs.joinStream(threadIdState, nextRunId)) {
            const str = typeof chunk.data === "string" ? chunk.data : JSON.stringify(chunk.data);
            chunksRef.current.push(str);
            setOutput([...chunksRef.current]);
            setStreamedOutput([...chunksRef.current]);
          }
        })();
      }
      // After streaming, check for further follow-up
      const threadInfo2 = await new Client({ apiUrl: LANGGRAPH_URL }).threads.get(threadIdState);
      let messages2: any[] = [];
      if (threadInfo2?.values && typeof threadInfo2.values === 'object' && !Array.isArray(threadInfo2.values)) {
        const valuesObj2 = threadInfo2.values as Record<string, any>;
        if (Array.isArray(valuesObj2.messages)) {
          messages2 = valuesObj2.messages;
        }
      }
      if (needsFollowup(messages2)) {
        setAwaitingFollowup(true);
      } else {
        setIsDone(true);
        onDone();
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  // Reset hasStartedRef when prompt or repo changes
  useEffect(() => {
    hasStartedRef.current = false;
  }, [prompt, repo]);

  return (
    <Box flexDirection="column">
      <Text color="yellow">Streaming output for: {prompt}</Text>
      {error ? (
        <Text color="red">{error}</Text>
      ) : output.length > 0 ? (
        output.map((msg, idx) => <Text key={idx}>{msg}</Text>)
      ) : (
        <Text color="gray">Waiting for output...</Text>
      )}
      {awaitingFollowup && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan">The assistant is awaiting your response:</Text>
          <Box>
            <Text color="magenta">&gt; </Text>
            <Text color="white">{followupPrompt}</Text>
          </Box>
          <Box>
            <Text color="gray">Type your response and press Enter:</Text>
          </Box>
          <Box>
            <input
              style={{ color: 'white', background: 'black', border: '1px solid gray', padding: 2, fontSize: 14 }}
              value={followupPrompt}
              onChange={e => setFollowupPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleFollowupSubmit();
              }}
              autoFocus
            />
          </Box>
        </Box>
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