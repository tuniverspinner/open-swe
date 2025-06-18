import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check authentication status
  const authenticated = isAuthenticated(request);

  // If user is on the index page
  if (pathname === "/") {
    if (authenticated) {
      // Redirect authenticated users to /chat
      return NextResponse.redirect(new URL("/chat", request.url));
    }
    // Allow unauthenticated users to stay on index page
    return NextResponse.next();
  }

  // If user is trying to access /chat or any other protected route
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    if (!authenticated) {
      // Redirect unauthenticated users to index page
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Allow authenticated users to access /chat
    return NextResponse.next();
  }

  // For all other routes, allow access
  return NextResponse.next();
}

