<div align="center">
  <h1>🤖 Open SWE</h1>
  <p><strong>Open-source cloud-based coding agent powered by LangChain</strong></p>
  
  <p>
    <a href="#quick-start">Quick Start</a> •
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#contributing">Contributing</a> •
    <a href="#license">License</a>
  </p>
  
  <p>
    <img src="https://img.shields.io/github/license/langchain-ai/open-swe" alt="License">
    <img src="https://img.shields.io/github/stars/langchain-ai/open-swe" alt="Stars">
    <img src="https://img.shields.io/github/issues/langchain-ai/open-swe" alt="Issues">
  </p>
</div>

---

> [!WARNING]
> Open SWE is under active development and is not yet ready for production use.

## 🚀 What is Open SWE?

Open SWE is an intelligent coding agent that understands your codebase, plans changes, and automatically creates pull requests. Built on LangChain and LangGraph, it combines the power of large language models with robust software engineering practices.

### ✨ Key Features

- **🧠 Intelligent Planning**: Analyzes your codebase and creates detailed execution plans
- **🔄 Interactive Workflow**: Review and modify plans before execution
- **🛠️ Multi-Model Support**: Works with Anthropic, OpenAI, and Google models
- **🔒 Secure Integration**: GitHub App integration with proper authentication
- **☁️ Cloud Sandboxes**: Powered by Daytona for isolated development environments
- **📊 Real-time Monitoring**: Built-in tracing and observability with LangSmith

## 🏗️ Architecture

Open SWE consists of three main components:

- **🤖 Agent (`apps/open-swe`)**: LangGraph-powered coding agent with planning and execution capabilities
- **🌐 Web Interface (`apps/web`)**: Next.js frontend for interacting with the agent
- **📦 Shared Package (`packages/shared`)**: Common utilities and types

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Yarn 3.5+
- GitHub App (for repository access)
- API keys for your preferred LLM provider

### 1. Clone and Install

```bash
git clone https://github.com/langchain-ai/open-swe.git
cd open-swe
yarn install
```

### 2. Environment Setup

Copy the example environment files:

```bash
# Agent environment
cp ./apps/open-swe/.env.example ./apps/open-swe/.env

# Web app environment  
cp ./apps/web/.env.example ./apps/web/.env
```

### 3. Configure API Keys

#### Agent Configuration (`apps/open-swe/.env`)

```bash
# LangSmith (optional, for tracing)
LANGCHAIN_PROJECT="open-swe"
LANGCHAIN_API_KEY="your-langsmith-key"
LANGCHAIN_TRACING_V2=true

# LLM Provider (choose one or more)
ANTHROPIC_API_KEY="your-anthropic-key"  # Recommended
OPENAI_API_KEY="your-openai-key"        # Optional
GOOGLE_API_KEY="your-google-key"        # Optional

# Daytona (for cloud sandboxes)
DAYTONA_API_KEY="your-daytona-key"

# GitHub Integration
GITHUB_TOKEN_ENCRYPTION_KEY="$(openssl rand -hex 32)"
GITHUB_APP_NAME="your-app-name"
```

#### Web App Configuration (`apps/web/.env`)

```bash
# API URLs (adjust for production)
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
LANGGRAPH_API_URL="http://localhost:2024"
NEXT_PUBLIC_ASSISTANT_ID="open-swe"

# GitHub OAuth
GITHUB_APP_CLIENT_ID="your-client-id"
GITHUB_APP_CLIENT_SECRET="your-client-secret"
GITHUB_APP_REDIRECT_URI="http://localhost:3000/api/auth/github/callback"

# GitHub App Details
GITHUB_APP_NAME="your-app-name"
GITHUB_APP_ID="your-app-id"
GITHUB_APP_PRIVATE_KEY="your-private-key"

# Must match the agent's encryption key
GITHUB_TOKEN_ENCRYPTION_KEY="same-as-agent-key"
```

### 4. GitHub App Setup

1. Create a new GitHub App at [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Configure the app with these settings:
   - **Callback URL**: `http://localhost:3000/api/auth/github/callback`
   - **Repository permissions**:
     - Contents: Read & Write
     - Metadata: Read & Write  
     - Pull requests: Read & Write
     - Issues: Read & Write
   - **Installation**: Any account
3. Generate and configure the required keys in your `.env` files

### 5. Start the Application

```bash
# Terminal 1: Start the agent
cd apps/open-swe
yarn dev

# Terminal 2: Start the web interface
cd apps/web  
yarn dev
```

🎉 **You're ready!** Open [http://localhost:3000](http://localhost:3000) to start using Open SWE.

## 📖 Usage Guide

### Basic Workflow

1. **🔗 Connect Repository**: Authenticate with GitHub and select your repository
2. **💬 Describe Task**: Tell the agent what you want to accomplish
3. **📋 Review Plan**: The agent will create a detailed execution plan
4. **✅ Approve & Execute**: Accept the plan or provide feedback
5. **🔄 Pull Request**: The agent automatically creates a PR with the changes

### Example Prompts

- "Add TypeScript support to the existing JavaScript files"
- "Implement user authentication with JWT tokens"
- "Fix the memory leak in the data processing module"
- "Add comprehensive error handling to the API endpoints"

### Plan Interaction

When the agent presents a plan, you can:
- ✅ **Accept**: Proceed with execution
- ✏️ **Edit**: Modify the plan before execution  
- 💬 **Provide Feedback**: Ask for plan revisions
- 🔄 **Start Over**: Create a new chat for major changes

## 🛠️ Development

### Project Structure

```
open-swe/
├── apps/
│   ├── open-swe/          # LangGraph agent
│   │   ├── src/
│   │   │   ├── nodes/     # Graph nodes
│   │   │   ├── subgraphs/ # Nested graphs
│   │   │   ├── tools/     # Agent tools
│   │   │   └── utils/     # Utilities
│   │   └── scripts/       # Development scripts
│   └── web/               # Next.js frontend
│       ├── src/
│       │   ├── app/       # App router pages
│       │   ├── components/# React components
│       │   └── lib/       # Client utilities
│       └── public/        # Static assets
├── packages/
│   └── shared/            # Shared utilities
└── .github/               # CI/CD workflows
```

### Available Scripts

```bash
# Development
yarn dev          # Start all services
yarn build        # Build all packages
yarn lint         # Run linting
yarn format       # Format code

# Testing
yarn test         # Run unit tests
yarn test:int     # Run integration tests
```

### Adding New Features

1. **Agent Nodes**: Add new capabilities in `apps/open-swe/src/nodes/`
2. **Tools**: Extend agent tools in `apps/open-swe/src/tools/`
3. **UI Components**: Add React components in `apps/web/src/components/`
4. **Shared Utilities**: Common code goes in `packages/shared/src/`

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **🍴 Fork** the repository
2. **🌿 Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **💻 Make** your changes
4. **✅ Test** your changes: `yarn test && yarn lint`
5. **📝 Commit** your changes: `git commit -m 'Add amazing feature'`
6. **🚀 Push** to your branch: `git push origin feature/amazing-feature`
7. **🔄 Create** a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Add tests for new functionality
- Update documentation as needed
- Ensure CI passes before submitting PRs

## 🐛 Troubleshooting

### Common Issues

**Agent not starting?**
- Check that all required environment variables are set
- Verify your API keys are valid
- Ensure Node.js version is 18+

**GitHub authentication failing?**
- Verify your GitHub App configuration
- Check that callback URLs match exactly
- Ensure the encryption key is the same in both apps

**Plan execution stuck?**
- Check the agent terminal for detailed logs
- Verify Daytona API key and sandbox access
- Review LangSmith traces if enabled

### Getting Help

- 📖 Check the [documentation](https://github.com/langchain-ai/open-swe/wiki)
- 🐛 Report bugs via [GitHub Issues](https://github.com/langchain-ai/open-swe/issues)
- 💬 Join discussions in [GitHub Discussions](https://github.com/langchain-ai/open-swe/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [LangChain](https://langchain.com) and [LangGraph](https://langchain-ai.github.io/langgraph/)
- Powered by [Daytona](https://daytona.io) cloud sandboxes
- UI components from [shadcn/ui](https://ui.shadcn.com)

---

<div align="center">
  <p>Made with ❤️ by the LangChain team</p>
  <p>
    <a href="https://github.com/langchain-ai/open-swe">⭐ Star us on GitHub</a> •
    <a href="https://twitter.com/langchainai">🐦 Follow on Twitter</a>
  </p>
</div>
