import { isAIMessage } from "@langchain/core/messages";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { createLogger, LogLevel } from "./logger.js";
import { getMessageContentString } from "@open-swe/shared/messages";

const logger = createLogger(LogLevel.INFO, "GetGenUIMessageId");

export function getGenUIMessageIdAndContent(state: GraphState): {
  id: string;
  content: string;
} {
  const lastMessage = state.messages.findLast(isAIMessage);
  const genUiId = lastMessage?.additional_kwargs?.gen_ui_id;
  if (!genUiId || typeof genUiId !== "string") {
    const errorMessage = "Failed to get gen_ui_id from last message";
    logger.error(errorMessage, {
      lastMessage,
    });
    throw new Error(errorMessage);
  }
  return {
    id: genUiId,
    content: getMessageContentString(lastMessage.content),
  };
}
