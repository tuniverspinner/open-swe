import os
import json
from pathlib import Path
from typing import Dict, Optional

def load_cli_config() -> Dict[str, str]:
    """
    Load API keys from the CLI config file located in the user's home directory.
    
    Returns:
        Dict containing the API keys from the config file
    """
    config_file_path = Path.home() / ".open-swe-config.json"
    
    try:
        if config_file_path.exists():
            with open(config_file_path, 'r') as f:
                config = json.load(f)
                return config
    except Exception as e:
        print(f"Warning: Could not load CLI config: {e}")
    
    return {}

def ensure_api_keys_in_env() -> None:
    """
    Load API keys from CLI config file and set them as environment variables
    if they're not already set.
    """
    # First try to get from environment variables
    required_keys = ["TAVILY_API_KEY", "ANTHROPIC_API_KEY", "LANGSMITH_API_KEY"]
    
    # Load from CLI config if any keys are missing
    cli_config = load_cli_config()
    
    for key in required_keys:
        if not os.environ.get(key) and cli_config.get(key):
            os.environ[key] = cli_config[key]

def get_api_key(key_name: str) -> Optional[str]:
    """
    Get an API key, first from environment variables, then from CLI config.
    
    Args:
        key_name: Name of the API key (e.g., "TAVILY_API_KEY")
    
    Returns:
        The API key value or None if not found
    """
    # First check environment variables
    env_value = os.environ.get(key_name)
    if env_value:
        return env_value
    
    # Fallback to CLI config
    cli_config = load_cli_config()
    return cli_config.get(key_name)