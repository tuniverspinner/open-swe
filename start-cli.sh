#!/bin/bash

set -e

echo "🚀 Starting Open-SWE Development Environment"


# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps/open-swe-v2" ] || [ ! -d "apps/cli" ]; then
    echo "❌ Error: Please run this script from the open-swe root directory"
    exit 1
fi

echo "📦 Installing dependencies..."
yarn install

echo "🌐 Starting LangGraph server in new terminal..."
osascript -e "tell application \"Terminal\" to do script \"cd $(pwd)/apps/open-swe-v2 && echo '🐍 Setting up Python environment...' && if [ ! -d 'venv' ]; then echo 'Creating Python virtual environment...' && python3 -m venv venv; fi && source venv/bin/activate && pip install -r requirements.txt && echo '🌐 Starting LangGraph server...' && langgraph dev\""

# Wait a bit for the server to start
sleep 5

echo "💻 Starting CLI..."
cd apps/cli
yarn dev