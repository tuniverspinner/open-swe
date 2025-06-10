// Run evals over the development SWE Bench Lite dataset
import * as ls from "langsmith/vitest";
import { Client as LangSmithClient, Example } from "langsmith";
import { Client as LangGraphClient } from "@langchain/langgraph-sdk";
import { SWEBench } from "./swe-bench-types.js";
import { GraphUpdate } from "@open-swe/shared/open-swe/types";

const DATASET_NAME = "swe-bench-lite-dev";

async function loadDataset(): Promise<Example[]> {
  const client = new LangSmithClient();
  const datasetStream = client.listExamples({ datasetName: DATASET_NAME });
  let examples: Example[] = [];
  for await (const example of datasetStream) {
    examples.push(example);
  }
  return examples;
}

function convertExampleToInput(example: Example) {
  return {
    inputs: example.inputs as SWEBench,
    outputs: example.outputs,
  };
}

/**
 * The following prompt template is a modified version of the prompt template used in the SWE Bench paper.
 * We've modified it because our agent acts differently than the one used in the paper, and thus some
 * of the instructions are not relevant to our agent.
 * @see https://arxiv.org/pdf/2310.06770 - Page 30, Appendix D.3 ("PROMPT TEMPLATE EXAMPLE")
 */
const PROMPT_TEMPLATE = `You will be provided with a codebase and an issue statement explaining a problem to resolve.
<issue>
{PROBLEM_STATEMENT}
</issue>
{OPTIONAL_HINTS_TEXT}
<codebase-readme>
{CODEBASE_README}
</codebase-readme>

I need you to solve the provided issue by generating, and applying a patch to a single file which will resolve the issue.
Once you've applied the patch, you may end, and I will manually review your code to ensure it resolved the issue.`;

function formatInputs(inputs: SWEBench): GraphUpdate {
  const targetRepository = {
    owner: inputs.repo.split("/")[0],
    name: inputs.repo.split("/")[1],
    branch: inputs.environment_setup_commit,
  };
  const userMessage = PROMPT_TEMPLATE.replace(
    "{PROBLEM_STATEMENT}",
    inputs.problem_statement,
  )
    .replace(
      "{OPTIONAL_HINTS_TEXT}",
      inputs.hints_text
        ? `\nThe following is the conversation history on the GitHub issue. You may use this as context\n<issue-comments>\n${inputs.hints_text}\n</issue-comments>`
        : "",
    )
    .replace("{CODEBASE_README}", inputs.codebase_readme);
}

const DATASET = await loadDataset().then((examples) =>
  examples.map(convertExampleToInput),
);

const LANGGRAPH_URL = process.env.LANGGRAPH_URL || "http://localhost:2024";
const GRAPH_NAME = "open_swe";

ls.describe("generate sql demo", () => {
  ls.test.each(DATASET)("offtopic inputs", async ({ inputs, outputs }) => {
    const lgClient = new LangGraphClient({
      apiUrl: LANGGRAPH_URL,
    });

    const thread = await lgClient.threads.create({
      graphId: GRAPH_NAME,
    });
    const runs = await lgClient.runs.create(thread.thread_id, GRAPH_NAME, {
      input: {},
      config: {
        recursion_limit: 250,
      },
    });
  });
});
