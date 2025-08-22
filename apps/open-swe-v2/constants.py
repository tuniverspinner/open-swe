"""
Constants for Open SWE V2 coding agent.
"""

# File operation commands that require approval in the approval system
FILE_EDIT_COMMANDS = {"write_file", "str_replace_based_edit_tool", "edit_file"}

# All commands that require approval (includes file operations plus other system operations)  
WRITE_COMMANDS = {
    "write_file", 
    "execute_bash", 
    "str_replace_based_edit_tool", 
    "ls", 
    "edit_file", 
    "glob", 
    "grep"
}