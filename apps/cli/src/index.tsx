#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput } from "ink";
import {
  startAuthServer,
  getAccessToken,
  getInstallationId,
} from "./auth-server.js";
import open from "open";
import TerminalInterface from "./TerminalInterface.js";

// Start the auth server immediately so callback URLs always work
startAuthServer();

const GITHUB_LOGIN_URL =
  process.env.GITHUB_LOGIN_URL || "http://localhost:3000/api/auth/github/login";

const CustomInput: React.FC<{ onSubmit: () => void }> = ({ onSubmit }) => {
  const [input, setInput] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useInput((inputChar, key) => {
    if (isSubmitted) return;
    if (key.return) {
      setIsSubmitted(true);
      onSubmit();
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (inputChar) {
      setInput((prev) => prev + inputChar);
    }
  });

  if (isSubmitted) return null;

  return (
    <Box>
      <Text color="cyan">&gt; {input}</Text>
    </Box>
  );
};

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

  useInput((input, key) => {
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
        <Text color="cyan">Search repositories: {search}</Text>
      </Box>
      {shown.length === 0 ? (
        <Box>
          <Text color="gray">No matches found.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {shown.map((_, idx) => (
            <Text
              key={shown[idx].id}
              color={idx === highlighted ? "magenta" : "white"}
            >
              {idx === highlighted ? "> " : "  "}
              {shown[idx].full_name}
            </Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor color="gray">
          Use ↑/↓ to navigate, Enter to select
        </Text>
      </Box>
    </Box>
  );
};

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
  // Removed unused: activePrompt, logs, setLogs, logsRef, streamedOutput, setStreamedOutput, APP_NAME, onDone
  const [waitingForInstall, setWaitingForInstall] = useState(false);
  const [installChecked, setInstallChecked] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [appSlug, setAppSlug] = useState(process.env.GITHUB_APP_NAME || "");
  const INSTALLATION_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || "";
  const [pollingForToken, setPollingForToken] = useState(false);

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
  useInput((input, key) => {
    if (installChecked && !waitingForInstall && key.return) {
      // User pressed Enter after install detected, go to terminal interface
      setInstallChecked(false);
      setSelectingRepo(false);
    }
    if (selectedRepo && (key.ctrl || key.meta) && input.toLowerCase() === "c") {
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
        setAuthInput((prev) => prev.slice(0, -1));
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

  if (isLoggedIn && repos.length > 0 && (selectingRepo || !selectedRepo)) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="magenta">
            LangChain Open SWE CLI
          </Text>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          <Text>Select a repository to work with (type to search):</Text>
        </Box>
        <Box
          borderStyle="round"
          borderColor="gray"
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
                // Installation already exists, skip install flow
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
              // Wait for installation_id to be set
            }}
          />
        </Box>
        {waitingForInstall && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="yellow">
              Waiting for GitHub App installation to complete...
            </Text>
            <Text color="gray">
              After installing the app, return here to continue.
            </Text>
          </Box>
        )}
        {installChecked && !waitingForInstall && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="green">
              GitHub App installation detected! You can now proceed.
            </Text>
            <Text color="gray">Press Enter to continue.</Text>
          </Box>
        )}
        {installError && (
          <Box marginTop={1}>
            <Text color="red">{installError}</Text>
          </Box>
        )}
      </Box>
    );
  } else if (
    isLoggedIn &&
    selectedRepo &&
    installChecked &&
    !waitingForInstall
  ) {
    // After install detected and user pressed Enter, show terminal interface
    return (
      <TerminalInterface
        message={submitted}
        setMessage={() => setSubmitted(null)}
        CustomInput={CustomInput}
        repoName={selectedRepo.full_name}
      />
    );
  } else if (isLoggedIn && selectedRepo) {
    return (
      <TerminalInterface
        message={submitted}
        setMessage={() => setSubmitted(null)}
        CustomInput={CustomInput}
        repoName={selectedRepo.full_name}
      />
    );
  } else if (!isLoggedIn && authPrompt === null) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="magenta">
            LangChain Open SWE CLI
          </Text>
        </Box>
        <Box
          borderStyle="round"
          borderColor="gray"
          paddingX={2}
          paddingY={1}
          marginTop={1}
          marginBottom={1}
        >
          <Text>
            Do you want to start the GitHub authentication flow? (y/n){" "}
            {authInput}
          </Text>
        </Box>
      </Box>
    );
  } else {
    return (
      <Box flexDirection="column" padding={1}>
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="magenta">
            LangChain Open SWE CLI
          </Text>
        </Box>
        {!submitted && <CustomInput onSubmit={() => setSubmitted(null)} />}
        {submitted && (
          <Box marginTop={1}>
            <Text color="green">You typed: {submitted}</Text>
          </Box>
        )}
      </Box>
    );
  }
};

render(<App />);
