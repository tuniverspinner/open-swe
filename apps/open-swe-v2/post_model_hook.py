"""
Post model hook for the coding agent with intelligent caching for command approvals.
Similar to Claude Code's approval system - only prompts for new commands or new directories.
"""

from typing import Dict, Any
from langchain_core.messages import AIMessage
from langgraph.types import interrupt
from .constants import WRITE_COMMANDS
from .state import CodingAgentState


def create_coding_agent_post_model_hook():
    """Create a post model hook with intelligent approval caching."""
    
    def post_model_hook(state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post model hook that checks for write tool calls and uses caching to avoid
        redundant approval prompts for the same command/directory combinations.
        """
        # Get the last message from the state
        messages = state.get("messages", [])
        if not messages:
            return state
        
        last_message = messages[-1]
        
        if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
            return state
        
        # Create a CodingAgentState instance to access approval methods
        coding_state = CodingAgentState()
        coding_state.approved_operations = state.get("approved_operations", {"cached_approvals": set()})
        
        approved_tool_calls = []
        
        # Define write tools that need approval
        write_tools = WRITE_COMMANDS
        
        for tool_call in last_message.tool_calls:
            tool_name = tool_call.get("name", "")
            tool_args = tool_call.get("args", {})
            
            if tool_name in write_tools:
                # Check if this command/directory combination has been approved before
                if coding_state.is_operation_approved(tool_name, tool_args):
                    approved_tool_calls.append(tool_call)
                else:
                    approval_key = coding_state.get_approval_key(tool_name, tool_args)
                    
                    is_approved = interrupt({
                        "command": tool_name,
                        "args": tool_args,
                        "approval_key": approval_key
                    })
                    
                    if is_approved:
                        coding_state.add_approved_operation(tool_name, tool_args)
                        approved_tool_calls.append(tool_call)

                        state["approved_operations"] = coding_state.approved_operations
                    else:
                        continue
            else:
                approved_tool_calls.append(tool_call)
        
        # Update the message if any tool calls were filtered out
        if len(approved_tool_calls) != len(last_message.tool_calls):
            new_message = AIMessage(
                content=last_message.content,
                tool_calls=approved_tool_calls,
                additional_kwargs=last_message.additional_kwargs
            )
            
            new_messages = messages[:-1] + [new_message]
            state["messages"] = new_messages
        
        return state
    
    return post_model_hook
