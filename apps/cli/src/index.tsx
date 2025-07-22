#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput } from "ink";
import { startAuthServer, getAccessToken } from "./auth-server.js";
import open from "open";
import TerminalInterface from "./TerminalInterface.js";

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

const App: React.FC = () => {
	const [authPrompt, setAuthPrompt] = useState<null | boolean>(null);
	const [authInput, setAuthInput] = useState("");
	const [submitted, setSubmitted] = useState<string | null>(null);
	const [exit, setExit] = useState(false);
	const [authStarted, setAuthStarted] = useState(false);
	const [isLoggedIn, setIsLoggedIn] = useState(false);

	// On mount, check for existing token
	useEffect(() => {
		const token = getAccessToken();
		if (token) {
			setIsLoggedIn(true);
		}
	}, []);

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
			open("http://localhost:3456/api/auth/github/login");
		}
	}, [authPrompt, authStarted]);

	if (isLoggedIn) {
		return <TerminalInterface submitted={submitted} setSubmitted={setSubmitted} CustomInput={CustomInput} />;
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