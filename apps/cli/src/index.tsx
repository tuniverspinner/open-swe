#!/usr/bin/env node
import React, { useState } from "react";
import { render, Box, Text, useInput } from "ink";

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
	const [submitted, setSubmitted] = useState<string | null>(null);

	return (
		<Box flexDirection="column" padding={1}>
			<Box justifyContent="center" marginBottom={1}>
				<Text bold color="magenta">LangChain</Text>
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