import { createLogger, LogLevel } from "../logger.js";
import { parseUrl } from "../url-parser.js";

const logger = createLogger(LogLevel.INFO, "GitHubImageResolver");

interface ImageResolveResult {
  success: true;
  resolvedUrl: string;
}

interface ImageResolveError {
  success: false;
  errorMessage: string;
}

type ImageResolveResponse = ImageResolveResult | ImageResolveError;

/**
 * Checks if a URL is a GitHub user-attachments URL that needs resolution
 */
export function isGitHubAttachmentUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === "github.com" &&
      parsedUrl.pathname.startsWith("/user-attachments/assets/")
    );
  } catch {
    return false;
  }
}

/**
 * Resolves a GitHub user-attachments URL to its actual accessible URL by following redirects
 */
async function resolveGitHubImageUrl(
  url: string,
  maxRetries = 3,
  currentRetry = 0,
): Promise<ImageResolveResponse> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });

    if (response.ok) {
      return {
        success: true,
        resolvedUrl: response.url,
      };
    }

    // If we get a non-OK response, try with GET method as fallback
    if (currentRetry === 0) {
      const getResponse = await fetch(url, {
        method: "GET",
        redirect: "follow",
      });

      if (getResponse.ok) {
        return {
          success: true,
          resolvedUrl: getResponse.url,
        };
      }
    }

    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (error) {
    const errorString = error instanceof Error ? error.message : String(error);
    
    if (currentRetry < maxRetries) {
      logger.warn(`Retrying GitHub image URL resolution (attempt ${currentRetry + 1}/${maxRetries + 1})`, {
        url,
        error: errorString,
      });
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetry) * 1000));
      return resolveGitHubImageUrl(url, maxRetries, currentRetry + 1);
    }

    logger.error("Failed to resolve GitHub image URL", {
      url,
      error: errorString,
      retries: currentRetry,
    });

