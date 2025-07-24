import { createLogger, LogLevel } from "../logger.js";
import { parseUrl } from "../url-parser.js";

const logger = createLogger(LogLevel.INFO, "GitHubImageExtractor");

/**
 * Regular expression patterns for extracting image URLs from markdown content
 */
const IMAGE_PATTERNS = {
  // Markdown image syntax: ![alt text](url) or ![alt text](url "title")
  markdown: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
  
  // HTML img tags: <img src="url" ... /> or <img src="url" ... >
  html: /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*\/?>/gi,
  
  // HTML img tags with single quotes: <img src='url' ... />
  htmlSingleQuote: /<img[^>]+src\s*=\s*'([^']+)'[^>]*\/?>/gi,
  
  // HTML img tags without quotes (less common but possible): <img src=url ... />
  htmlNoQuote: /<img[^>]+src\s*=\s*([^\s>]+)[^>]*\/?>/gi,
};

/**
 * Extracts image URLs from markdown content using various patterns
 */
export function extractImageUrls(content: string): string[] {
  if (!content || typeof content !== "string") {
    return [];
  }

  const imageUrls: string[] = [];
  const seenUrls = new Set<string>();

  // Extract markdown image URLs: ![alt](url)
  let match;
  while ((match = IMAGE_PATTERNS.markdown.exec(content)) !== null) {
    const url = match[2].trim();
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      imageUrls.push(url);
    }
  }

  // Reset regex lastIndex for reuse
  IMAGE_PATTERNS.markdown.lastIndex = 0;

  // Extract HTML img tag URLs with double quotes
  while ((match = IMAGE_PATTERNS.html.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      imageUrls.push(url);
    }
  }

  // Reset regex lastIndex for reuse
  IMAGE_PATTERNS.html.lastIndex = 0;

  // Extract HTML img tag URLs with single quotes
  while ((match = IMAGE_PATTERNS.htmlSingleQuote.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      imageUrls.push(url);
    }
  }

  // Reset regex lastIndex for reuse
  IMAGE_PATTERNS.htmlSingleQuote.lastIndex = 0;

  // Extract HTML img tag URLs without quotes
  while ((match = IMAGE_PATTERNS.htmlNoQuote.exec(content)) !== null) {
    const url = match[1].trim();
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      imageUrls.push(url);
    }
  }

  // Reset regex lastIndex for reuse
  IMAGE_PATTERNS.htmlNoQuote.lastIndex = 0;

  // Filter out invalid URLs and log the results
  const validUrls = imageUrls.filter(url => {
    const parseResult = parseUrl(url);
    if (!parseResult.success) {
      logger.warn("Invalid image URL found in content", { url });
      return false;
    }
    return true;
  });

  logger.debug("Extracted image URLs from content", { count: validUrls.length, urls: validUrls });
  return validUrls;
}


