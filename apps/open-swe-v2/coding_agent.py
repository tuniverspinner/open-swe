import os
import tempfile
from typing import List, Dict, Any, Optional, Union, Literal
from pathlib import Path

from deepagents import create_deep_agent, SubAgent
from post_model_hook import create_coding_agent_post_model_hook
from subagents import code_reviewer_agent, test_generator_agent
from langgraph.types import Command
from state import CodingAgentState
from coding_instructions import get_coding_instructions
from tools import execute_bash, http_request, web_search
from config_loader import ensure_api_keys_in_env

from langsmith import Client
from langsmith.wrappers import wrap_openai
from langchain_core.tracers.langchain import LangChainTracer
import dotenv

dotenv.load_dotenv()
ensure_api_keys_in_env()

langsmith_client = None
langchain_tracer = None

if os.environ.get("LANGCHAIN_API_KEY") or os.environ.get("LANGSMITH_API_KEY"):
    try:
        langsmith_client = Client()
        langchain_tracer = LangChainTracer(
            project_name=os.environ.get("LANGCHAIN_PROJECT", "coding-agent"),
            client=langsmith_client
        )
    except Exception as e:
        print(f"Warning: Failed to initialize LangSmith tracing: {e}")


coding_instructions = get_coding_instructions()

post_model_hook = create_coding_agent_post_model_hook()

config = {"recursion_limit": 1000}

if langchain_tracer:
    config["callbacks"] = [langchain_tracer]

agent = create_deep_agent(
    [execute_bash, http_request, web_search],
    coding_instructions,
    subagents=[code_reviewer_agent, test_generator_agent],
    local_filesystem=True,
    state_schema=CodingAgentState,
    post_model_hook=post_model_hook,
).with_config(config)
