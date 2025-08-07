import { createDevServerToolFields } from "@open-swe/shared/open-swe/tools";

export const GITHUB_WORKFLOWS_PERMISSIONS_PROMPT = `
IMPORTANT: You do not have permissions to EDIT or DELETE files inside the GitHub workflows directory (commonly found at .github/workflows/).
  - If you need to modify or create a workflow, ensure you always do so inside a 'tmp-workflows' directory.
  - Any attempt to create or modify a workflow file in the .github/workflows/ directory will result in a fatal error that will end the session.
  - Notify the user that they will need to manually move the workflow file from the 'tmp-workflows' directory to the .github/workflows/ directory since you do not have permissions to do so.
`;

const dummyDevServerToolFields = createDevServerToolFields({
  owner: "dummy",
  repo: "dummy",
});
export const DEV_SERVER_USAGE_PROMPT = `### Dev server tool
The \`${dummyDevServerToolFields.name}\` tool allows Claude to start development servers and test them during development.
**IMPORTANT: You MUST use this tool whenever you implement web applications, APIs, or services that can be run locally.**
This is a critical validation step - code that looks correct may still have runtime issues.

**Always use this tool to:**
- Test that a web application starts correctly after implementing features
- Verify API endpoints respond properly after adding/modifying them  
- Debug server startup issues or runtime errors
- Validate that changes work in a running environment

Common development server commands by technology:
- **Python/LangGraph**: \`langgraph dev\` (for LangGraph applications)
- **Node.js/React**: \`npm start\`, \`npm run dev\`, \`yarn start\`, \`yarn dev\`
- **Python/Django**: \`python manage.py runserver\`
- **Python/Flask**: \`python app.py\`, \`flask run\`
- **Python/FastAPI**: \`uvicorn main:app --reload\`
- **Go**: \`go run .\`, \`go run main.go\`
- **Ruby/Rails**: \`rails server\`, \`bundle exec rails server\`

Parameters:
    - \`command\`: The development server command to execute (e.g., ["langgraph", "dev"] or ["npm", "start"])
    - \`request\`: HTTP request to send to the server for testing (JSON format with url, method, headers, body)
    - \`workdir\`: Working directory for the command
    - \`wait_time\`: Time to wait in seconds before sending request (default: 10)

The tool will start the server, send a test request, capture logs, and return the results for validation.

**CRITICAL:** Always use this tool to verify your implementation works in practice, not just in theory. 
Do not assume code works without testing it. Runtime testing is mandatory for web applications and APIs.`;
