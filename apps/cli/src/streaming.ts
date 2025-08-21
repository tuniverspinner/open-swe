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

  constructor(callbacks: StreamingCallbacks) {
    this.callbacks = callbacks;
  }

  async replayFromTrace(langsmithRun: any, playbackSpeed: number = 500) {
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

        const formatted = formatDisplayLog(mockChunk);
        if (formatted.length > 0) {
          this.callbacks.setLogs((prev) => {
            if (prev.length === 0) {
              this.callbacks.setLoadingLogs(false);
            }
            return [...prev, ...formatted];
          });
        }

        // Add delay between messages to simulate streaming
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, playbackSpeed));
        }
      }

      this.callbacks.setStreamingPhase("done");
    } catch (err: any) {
      this.callbacks.setLogs((prev) => [
        ...prev,
        `Error during replay: ${err.message}`,
      ]);
      this.callbacks.setLoadingLogs(false);
    } finally {
      this.callbacks.setLoadingLogs(false);
    }
  }

  async startNewSession(prompt: string) {
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
          const formatted = formatDisplayLog(chunk);
          if (formatted.length > 0) {
            this.callbacks.setLogs((prev) => {
              if (prev.length === 0) {
                this.callbacks.setLoadingLogs(false);
              }
              return [...prev, ...formatted];
            });
          }
        }
      }

      this.callbacks.setStreamingPhase("done");
    } catch (err: any) {
      this.callbacks.setLogs((prev) => [
        ...prev,
        `Error during streaming: ${err.message}`,
      ]);
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
          const formatted = formatDisplayLog(chunk);
          if (formatted.length > 0) {
            this.callbacks.setLogs((prev) => [...prev, ...formatted]);
          }
        }
      }

      this.callbacks.setStreamingPhase("done");
    } catch (err: any) {
      this.callbacks.setLogs((prev) => [
        ...prev,
        `Error submitting to stream: ${err.message}`,
      ]);
    }
  }
}
