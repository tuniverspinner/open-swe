#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput } from "ink";
import { startAuthServer, getAccessToken } from "./auth-server.js";
import open from "open";
import TerminalInterface from "./TerminalInterface.js";

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

	if (isLoggedIn && selectedRepo) {
		return <TerminalInterface submitted={submitted} setSubmitted={setSubmitted} CustomInput={CustomInput} repoName={selectedRepo.full_name} />;
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