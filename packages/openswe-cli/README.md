# OpenSWE CLI

A unified CLI tool that orchestrates the OpenSWE CLI interface and LangGraph server.

## Overview

The `openswe` command automatically starts both:
1. **LangGraph Server** - The coding agent backend running on `localhost:2024`
2. **OpenSWE CLI** - The terminal interface for interacting with the coding agent

## Installation

From the workspace root:

```bash
# Install dependencies
yarn install

# Build the CLI
cd packages/openswe-cli
yarn build

# Make globally available
npm link
```

## Usage

```bash
# Start OpenSWE with CLI + LangGraph server
openswe

# Replay from a trace file
openswe --replay /path/to/trace.json

# Replay with custom speed
openswe --replay /path/to/trace.json --speed 1000
```

## Features

- **Automatic Orchestration**: Starts LangGraph server first, then CLI
- **Workspace Detection**: Automatically finds the workspace root
- **Graceful Shutdown**: Properly terminates both services on exit
- **Error Handling**: Handles startup failures and service crashes
- **CLI Passthrough**: Supports all original CLI options (replay, speed, etc.)

## Dependencies

The package includes workspace dependencies:
- `@open-swe/cli` - The terminal interface
- `coding-agent` - The LangGraph coding agent (open-swe-v2-js)
- `@open-swe/shared` - Shared utilities

## How It Works

1. **Workspace Detection**: Finds the monorepo root by looking for `package.json` with workspaces
2. **LangGraph Server**: Spawns `langgraphjs dev` in `apps/open-swe-v2-js/`
3. **Server Readiness**: Waits for server to be ready on port 2024
4. **CLI Launch**: Starts the CLI with proper environment variables
5. **Process Management**: Handles shutdown signals and cleanup

## Environment Variables

- `LANGGRAPH_URL`: Set to `http://localhost:2024` (automatic)
- `OPEN_SWE_LOCAL_PROJECT_PATH`: Set to current working directory (automatic)

## Troubleshooting

If the command fails to start:
1. Ensure you're in a workspace with the required apps
2. Check that `langgraphjs` CLI is available globally
3. Verify that both CLI and coding-agent are built
4. Check port 2024 is not in use by another service