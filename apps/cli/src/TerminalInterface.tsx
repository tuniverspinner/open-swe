import React from "react";
import { Box, Text } from "ink";

interface TerminalInterfaceProps {
	submitted: string | null;
	setSubmitted: (value: string) => void;
	CustomInput: React.FC<{ onSubmit: (value: string) => void }>;
	repoName?: string;
}

const TerminalInterface: React.FC<TerminalInterfaceProps> = ({ submitted, setSubmitted, CustomInput, repoName }) => {
	return (
		<Box flexDirection="column" padding={1}>
			<Box justifyContent="center" marginBottom={1}>
				<Text bold color="magenta">LangChain Open SWE CLI</Text>
			</Box>
			<Box flexDirection="column" marginBottom={1}>
				<Text>• Describe your coding task or ask a question...</Text>
			</Box>
			<Box borderStyle="round" borderColor="gray" paddingX={2} paddingY={1} marginTop={1} marginBottom={1}>
				<CustomInput onSubmit={setSubmitted} />
			</Box>
			{repoName && (
				<Box marginTop={0} marginBottom={0}>
					<Text color="gray">
						Repository: {repoName}
					</Text>
				</Box>
			)}
			{submitted && (
				<Box marginTop={1}>
					<Text>You typed: {submitted}</Text>
				</Box>
			)}
		</Box>
	);
};

export default TerminalInterface; 