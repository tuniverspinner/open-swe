import { MessageContent } from "@langchain/core/messages";

export function getMessageContentString(content: MessageContent): string {
  if (typeof content === "string") return content;

  const parts: string[] = [];

  for (const block of content) {
    if (block.type === "text") {
      parts.push(block.text);
    } else if (block.type === "image_url") {
      // Extract meaningful description from image URL or provide generic description
      const imageUrl = block.image_url?.url || "";
      if (imageUrl) {
        // Try to extract filename or provide generic description
        const urlParts = imageUrl.split("/");
        const filename = urlParts[urlParts.length - 1];
        const description = filename && filename.includes(".") 
          ? `[Image: ${filename}]` 
          : "[Image]";
        parts.push(description);
      }
    }
  }

  return parts.join(" ");
}

