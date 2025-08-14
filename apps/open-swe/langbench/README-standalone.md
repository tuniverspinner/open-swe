# Standalone Test Runner

A standalone TypeScript/JavaScript test runner that creates a sandbox, clones a repository at a specific commit, sets up PostgreSQL, installs dependencies, and runs a specific test.

## Usage

Navigate to the langbench directory and run:

```bash
npx tsx standalone-test-runner.ts <commit_sha> <test_file> [test_name]
```

Or from the project root:

```bash
npx tsx langbench/standalone-test-runner.ts <commit_sha> <test_file> [test_name]
```

## Examples

```bash
# Run all tests in a file
npx tsx standalone-test-runner.ts abc123def456 libs/langgraph/tests/test_large_cases.py

# Run a specific test
npx tsx standalone-test-runner.ts abc123def456 libs/langgraph/tests/test_large_cases.py test_state_graph_packets
```

## Prerequisites

Set these environment variables:
- `DAYTONA_ORGANIZATION_ID` - Your Daytona organization ID
- `GITHUB_PAT` - Your GitHub personal access token

## What it does

1. Creates a fresh Daytona sandbox
2. Clones the langchain-ai/langgraph repository at the specified commit
3. Sets up PostgreSQL database with:
   - Database: `langraph_test` 
   - User: `langraph_user`
   - Password: `test_password`
   - Connection URL: `postgresql://langraph_user:test_password@localhost:5432/langraph_test`
4. Sets up Python virtual environment
5. Installs dependencies:
   - pytest and related packages
   - langgraph packages
   - checkpoint packages
6. Runs the specified test file/test name
7. Shows results and cleans up the sandbox

## Output

The runner will display test results including exit code, success status, and full pytest output.