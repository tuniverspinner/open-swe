import { BaseMessage, AIMessage, ToolMessage, isAIMessage, isToolMessage } from "@langchain/core/messages";
import { createLogger, LogLevel } from "../logger.js";

const logger = createLogger(LogLevel.INFO, "ValidateToolCalls");

/**
 * Validates and fixes a message chain to ensure all AI messages with tool calls
 * are followed by corresponding tool results. Removes orphaned tool calls.
 */
export function validateAndFixToolCallChain(messages: BaseMessage[]): BaseMessage[] {
  const fixedMessages: BaseMessage[] = [];
  let pendingToolCalls: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (isAIMessage(message)) {
      // If there were pending tool calls from previous AI message, remove them
      if (pendingToolCalls.length > 0) {
        logger.warn("Removing AI message with orphaned tool calls", {
          toolCallIds: pendingToolCalls.map(tc => tc.id),
          toolCallNames: pendingToolCalls.map(tc => tc.name)
        });
        // Remove the previous AI message from fixedMessages
        fixedMessages.pop();
      }

      const toolCalls = (message as AIMessage).tool_calls || [];
      if (toolCalls.length > 0) {
        pendingToolCalls = toolCalls.map(tc => ({ id: tc.id || "", name: tc.name }));
        fixedMessages.push(message);
      } else {
        pendingToolCalls = [];
        fixedMessages.push(message);
      }
    } else if (isToolMessage(message)) {
      const toolMessage = message as ToolMessage;
      const toolCallId = toolMessage.tool_call_id;

      // Check if this tool result matches a pending tool call
      const pendingIndex = pendingToolCalls.findIndex(tc => tc.id === toolCallId);
      if (pendingIndex >= 0) {
        // Remove the matched tool call from pending
        pendingToolCalls.splice(pendingIndex, 1);
        fixedMessages.push(message);
      } else {
        // Orphaned tool result - skip it
        logger.warn("Skipping orphaned tool result", {
          toolCallId,
          toolName: toolMessage.name
        });
      }
    } else {
      // Non-AI, non-tool message - clear pending tool calls and add message
      if (pendingToolCalls.length > 0) {
        logger.warn("Removing AI message with unresolved tool calls due to intervening message", {
          toolCallIds: pendingToolCalls.map(tc => tc.id)
        });
        // Remove the AI message with unresolved tool calls
        fixedMessages.pop();
      }
      pendingToolCalls = [];
      fixedMessages.push(message);
    }
  }

  // Handle any remaining pending tool calls at the end
  if (pendingToolCalls.length > 0) {
    logger.warn("Removing final AI message with unresolved tool calls", {
      toolCallIds: pendingToolCalls.map(tc => tc.id)
    });
    // Remove the last AI message if it has unresolved tool calls
    while (fixedMessages.length > 0 && isAIMessage(fixedMessages[fixedMessages.length - 1])) {
      const lastMessage = fixedMessages[fixedMessages.length - 1] as AIMessage;
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        fixedMessages.pop();
        break;
      }
      break;
    }
  }

  logger.info("Message chain validation complete", {
    originalCount: messages.length,
    fixedCount: fixedMessages.length,
    removed: messages.length - fixedMessages.length
  });

  return fixedMessages;
} 