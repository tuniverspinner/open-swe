import { HumanInterrupt } from "@langchain/langgraph/prebuilt";

const SHELL_COMMAND_INTERRUPT_ACTION_TITLE = "Approve Shell Command";

export function isShellCommandInterrupt(
  interrupt: HumanInterrupt | undefined,
): boolean {
  return (
    interrupt?.action_request?.action === SHELL_COMMAND_INTERRUPT_ACTION_TITLE
  );
}

export function formatShellCommandPrompt(interrupt: HumanInterrupt): string {
  const args = interrupt.action_request.args as { command: string; workdir: string };
  return `🔧 Shell Command Approval Required

Command: ${args.command}
Working Directory: ${args.workdir}

Do you want to allow this command to run on your local machine?

Type 'yes' to approve or 'no' to deny:`;
}

export function parseShellCommandResponse(response: string): "accept" | "ignore" {
  const lowerResponse = response.toLowerCase().trim();
  if (lowerResponse === "yes" || lowerResponse === "y" || lowerResponse === "accept") {
    return "accept";
  } else {
    return "ignore";
  }
} 