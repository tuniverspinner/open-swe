/* eslint-disable no-console */
import { createDeepAgent } from "deepagents";
import "dotenv/config";
import { code_reviewer_agent, test_generator_agent } from "./subagents.js";
import { get_coding_instructions } from "./coding_instructions.js";
import { createCodingAgentPostModelHook } from "./coding_post_model_hook.js";
import { CodingAgentState } from "./coding_agent_state.js";
import { executeBash, httpRequest, webSearch, glob, ls, readFile, writeFile, strReplaceBasedEditTool, grep, writeTodos } from "./tools.js";

// LangSmith tracing setup
if (process.env.LANGCHAIN_TRACING_V2 !== "false") {
  process.env.LANGCHAIN_TRACING_V2 = "true";
  if (!process.env.LANGCHAIN_PROJECT) {
    process.env.LANGCHAIN_PROJECT = "coding_agent";
  }
}

const codingInstructions = get_coding_instructions();
const postModelHook = createCodingAgentPostModelHook();
console.log("WORKING DIR", CodingAgentState.working_directory);
// Create the coding agent
const agent = createDeepAgent({
  tools: [executeBash, httpRequest, webSearch, glob, ls, readFile, writeFile, strReplaceBasedEditTool, grep, writeTodos],
  instructions: codingInstructions,
  subagents: [code_reviewer_agent, test_generator_agent],
  skipBuiltinTools: true,
  postModelHook: postModelHook,
  stateSchema: CodingAgentState,
}).withConfig({ recursionLimit: 50 }) as any; // reduced to prevent token overflow

export { agent, executeBash, httpRequest, webSearch, glob, ls, readFile, writeFile, strReplaceBasedEditTool, grep, writeTodos };
