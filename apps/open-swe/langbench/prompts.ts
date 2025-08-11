import { PRData } from "./types.js";

export function createPRFixPrompt(prData: PRData): string {
  return `
  <request>

  Your job is to fix the issues in PR with title: ${prData.title}

  The PR has the following description:
  ${prData.body}

  The implementation of the PR should result in these tests passing: 
  ${Object.entries(prData.tests).map(([file, tests]) => `${file}: ${tests.join(", ")}`).join("\n  ")}

  </request>
  `;
}
