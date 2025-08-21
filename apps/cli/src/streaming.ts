import { Client, StreamMode } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import {
  LOCAL_MODE_HEADER,
  OPEN_SWE_STREAM_MODE,
} from "@open-swe/shared/constants";
import { formatDisplayLog } from "./logger.js";

const LANGGRAPH_URL = process.env.LANGGRAPH_URL || "http://localhost:2024";

interface StreamingCallbacks {
  setLogs: (updater: (prev: string[]) => string[]) => void; // eslint-disable-line no-unused-vars
  setStreamingPhase: (phase: "streaming" | "done") => void; // eslint-disable-line no-unused-vars
  setLoadingLogs: (loading: boolean) => void; // eslint-disable-line no-unused-vars
}

export class StreamingService {
  private callbacks: StreamingCallbacks;
  private client: Client | null = null;
  private threadId: string | null = null;
  private rawLogs: any[] = [];

  constructor(callbacks: StreamingCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Get formatted logs for display
   */
  getFormattedLogs(): string[] {
    const formattedLogs: string[] = [];
    
    for (const chunk of this.rawLogs) {
      if (typeof chunk === "string") {
        const formatted = formatDisplayLog(chunk);
        formattedLogs.push(...formatted);
      } else if (chunk.event === "updates") {
        const formatted = formatDisplayLog(chunk);
        formattedLogs.push(...formatted);
      }
    }
    
    return formattedLogs;
  }

  /**
   * Update the display with formatted logs
   */
  private updateDisplay() {
    const formattedLogs = this.getFormattedLogs();
    this.callbacks.setLogs(() => formattedLogs);
  }

  /**
   * Get raw logs for debugging purposes
   */
  getRawLogs(): any[] {
    return [...this.rawLogs];
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.rawLogs = [];
    this.updateDisplay();
  }

  async replayFromTrace(langsmithRun: any, playbackSpeed: number = 500) {
    this.rawLogs = [];
    this.callbacks.setLogs(() => []);
    this.callbacks.setLoadingLogs(true);

    try {
      const messages = langsmithRun.messages || [];
      
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        
        // Convert LangSmith message to the format expected by formatDisplayLog
        const mockChunk = {
          event: "updates",
          data: {
            agent: {
              messages: [message]
            }
          }
        };

        // Store raw chunk instead of formatting immediately
        this.rawLogs.push(mockChunk);
        this.updateDisplay();

        if (this.rawLogs.length === 1) {
          this.callbacks.setLoadingLogs(false);
        }

        // Add delay between messages to simulate streaming
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, playbackSpeed));
        }
      }

      this.callbacks.setStreamingPhase("done");
    } catch (err: any) {
      this.rawLogs.push(`Error during replay: ${err.message}`);
      this.updateDisplay();
      this.callbacks.setLoadingLogs(false);
    } finally {
      this.callbacks.setLoadingLogs(false);
    }
  }

  async startNewSession(prompt: string) {
    this.rawLogs = [];
    this.callbacks.setLogs(() => []);
    this.callbacks.setLoadingLogs(true);

    try {
      const headers = {
        [LOCAL_MODE_HEADER]: "true",
      };

      this.client = new Client({
        apiUrl: LANGGRAPH_URL,
        defaultHeaders: headers,
      });

      const thread = await this.client.threads.create();
      console.log("thread", thread);
      this.threadId = thread.thread_id;

      // Stream using the pattern from deep-agents
      const stream = await this.client.runs.stream(
        this.threadId,
        "coding",
        {
          input: { 
            messages: [{ role: "user", content: prompt }],
            targetPath: process.env.OPEN_SWE_LOCAL_PROJECT_PATH || "",
          },
          streamMode: ["updates",] as StreamMode[],
        }
      );

      // Process the stream
      for await (const chunk of stream) {
        if (chunk.event === "updates") {
          // Store raw chunk instead of formatting immediately
          this.rawLogs.push(chunk);
          this.updateDisplay();
          
          if (this.rawLogs.length === 1) {
            this.callbacks.setLoadingLogs(false);
          }
        }
      }

      this.callbacks.setStreamingPhase("done");
    } catch (err: any) {
      this.rawLogs.push(`Error during streaming: ${err.message}`);
      this.updateDisplay();
      this.callbacks.setLoadingLogs(false);
    } finally {
      this.callbacks.setLoadingLogs(false);
    }
  }

  async submitToExistingStream(prompt: string) {
    if (!this.client || !this.threadId) {
      throw new Error("No active stream session. Start a new session first.");
    }

    try {
      // Stream to existing thread using the same pattern
      const stream = await this.client.runs.stream(
        this.threadId,
        "coding",
        {
          input: { 
            messages: [{ role: "user", content: prompt }]
          },
          streamMode: ["updates"] as StreamMode[],
        }
      );

      // Process the stream
      for await (const chunk of stream) {
        if (chunk.event === "updates") {
          // Store raw chunk instead of formatting immediately
          this.rawLogs.push(chunk);
          this.updateDisplay();
        }
      }

      this.callbacks.setStreamingPhase("done");
    } catch (err: any) {
      this.rawLogs.push(`Error submitting to stream: ${err.message}`);
      this.updateDisplay();
    }
  }
}
