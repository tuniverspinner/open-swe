import { NextRequest, NextResponse } from "next/server";
import { Client } from "@langchain/langgraph-sdk";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import { MANAGER_GRAPH_ID } from "@open-swe/shared/constants";

/**
 * API endpoint to check if a thread is public without requiring authentication
 * This endpoint uses direct LangGraph SDK calls with minimal auth bypass
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ thread_id: string }> }
) {
  try {
    const { thread_id } = await params;

    // Create LangGraph client with API key for server-side access
    const client = new Client({
      apiUrl: process.env.LANGGRAPH_API_URL ?? "http://localhost:2024",
      apiKey: process.env.LANGGRAPH_API_KEY,
    });

    // Fetch the thread data directly using the LangGraph SDK
    const thread = await client.threads.get<ManagerGraphState>(thread_id, {
      // Use the manager graph ID to ensure we're getting the right thread type
      assistantId: MANAGER_GRAPH_ID,
    });

    // Check if the thread has isPublic set to true in its values
    const isPublic = thread.values?.isPublic === true;

    return NextResponse.json({ isPublic });
  } catch (error) {
    console.error(`Failed to check thread publicity for ${params}:`, error);
    
    // Return false for security - if we can't access the thread, assume it's private
    return NextResponse.json(
      { isPublic: false, error: "Failed to check thread publicity" },
      { status: 500 }
    );
  }
}

