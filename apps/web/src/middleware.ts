import { NextRequest, NextResponse } from "next/server";
import { GITHUB_TOKEN_COOKIE } from "@open-swe/shared/constants";
import { verifyGithubUser } from "@open-swe/shared/github/verify-user";

/**
 * Extract thread ID from chat URL path
 */
function extractThreadIdFromPath(pathname: string): string | null {
  const chatThreadMatch = pathname.match(/^\/chat\/([^\/]+)$/);
  return chatThreadMatch ? chatThreadMatch[1] : null;
}

/**
 * Check if a thread is public using the API endpoint
 */
async function isThreadPublic(threadId: string, request: NextRequest): Promise<boolean> {
  try {
    const response = await fetch(`${request.nextUrl.origin}/api/threads/${threadId}/public`);
    return response.ok && (await response.json()).isPublic === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(GITHUB_TOKEN_COOKIE)?.value;
  const user = token ? await verifyGithubUser(token) : null;

  if (request.nextUrl.pathname === "/") {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/chat";
      return NextResponse.redirect(url);
    }
  }

  if (request.nextUrl.pathname.startsWith("/chat")) {
    if (!user) {
      // Check if this is a specific thread URL
      const threadId = extractThreadIdFromPath(request.nextUrl.pathname);
      
      if (threadId) {
        // Check if the thread is public
        const isPublic = await isThreadPublic(threadId, request);
        if (isPublic) {
          // Allow access to public threads
          return NextResponse.next();
        }
      }
      
      // Redirect unauthenticated users away from private threads or general chat routes
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/chat/:path*"],
};

