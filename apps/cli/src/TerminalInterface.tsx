import React from "react";
import { Box, Text } from "ink";

interface TerminalInterfaceProps {
	submitted: string | null;
	setSubmitted: (value: string) => void;
	CustomInput: React.FC<{ onSubmit: (value: string) => void }>;
	repoName?: string;
  logs?: string[];
  streamedOutput?: string[];
}

const TerminalInterface: React.FC<TerminalInterfaceProps> = ({ submitted, setSubmitted, CustomInput, repoName, logs, streamedOutput }) => {
	return (
		<Box flexDirection="column" padding={1}>
			<Box justifyContent="center" marginBottom={1}>
				<Text bold color="magenta">LangChain Open SWE CLI</Text>
			</Box>
      {logs && logs.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {logs.map((log, idx) => (
            <Text key={idx} color="gray">{log}</Text>
          ))}
        </Box>
      )}
      {streamedOutput && streamedOutput.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {streamedOutput.map((line, idx) => (
            <Text key={idx}>{line}</Text>
          ))}
        </Box>
      )}
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
					<Text color="green">You typed: {submitted}</Text>
				</Box>
			)}
		</Box>
	);
};

export default TerminalInterface; 