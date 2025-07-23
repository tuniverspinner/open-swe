import { Client } from "@langchain/langgraph-sdk";

export function createLangGraphClient(options?: {
  defaultHeaders?: Record<string, string>;
  includeApiKey?: boolean;
}) {
  // TODO: Remove the need for this after issues with port are resolved.
  const productionUrl = process.env.LANGGRAPH_PROD_URL;
  const port = process.env.PORT ?? "2024";
  if (options?.includeApiKey && !(process.env.LANGCHAIN_API_KEY || process.env.LANGGRAPH_API_KEY)) {
    throw new Error("LANGCHAIN_API_KEY or LANGGRAPH_API_KEY not found");
  }
  const apiKey = process.env.LANGCHAIN_API_KEY || process.env.LANGGRAPH_API_KEY;
  return new Client({
    ...(options?.includeApiKey && {
      apiKey,
    }),
    apiUrl: productionUrl ?? `http://localhost:${port}`,
    defaultHeaders: options?.defaultHeaders,
  });
}
