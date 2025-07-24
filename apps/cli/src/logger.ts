import { isAgentInboxInterruptSchema } from "./utils.js";

interface LogChunk {
  event: string;
  data: any;
  ops?: Array<{ value: string }>;
}

interface MessageData {
  id: string;
  type: 'ai' | 'tool' | 'human';
  content: Array<{ type: string; text?: string; input?: string }> | string;
  tool_calls?: Array<ToolCall>;
  name?: string;
  tool_call_id?: string;
  status?: 'success' | 'error';
  graph_id?: string;
  langgraph_node?: string;
}

interface ToolCall {
  type: string;
  args?: string;
  name?: string;
  index?: number;
  id?: string;
}

/**
 * Formats a tool call into a human-readable string.
 * @param toolCall The tool call to format
 * @returns A formatted string describing the tool call
 */
function formatToolCall(toolCall: ToolCall): string {
  try {
    const args = toolCall.args ? JSON.parse(toolCall.args) : {};
    const name = toolCall.name || 'unknown';

    switch (name.toLowerCase()) {
      case 'shell':
        return `$ ${args.command?.join(' ') || ''}`;
      case 'search':
        return `Search: "${args.query}"${args.include_pattern ? ` in ${args.include_pattern}` : ''}`;
      case 'edit_file':
        return `Edit: ${args.target_file}`;
      case 'read_file':
        return `Read: ${args.target_file}`;
      case 'grep_search':
        return `Grep: "${args.query}"`;
      case 'list_dir':
        return `List: ${args.relative_workspace_path}`;
      case 'file_search':
        return `Find file: ${args.query}`;
      case 'delete_file':
        return `Delete: ${args.target_file}`;
      default:
        const argsStr = Object.entries(args)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(', ');
        return `${name}(${argsStr})`;
    }
  } catch (e) {
    return toolCall.args || '';
  }
}

/**
 * Formats a tool result into a human-readable string.
 * @param message The tool message to format
 * @returns A formatted string with the tool result
 */
function formatToolResult(message: MessageData): string {
  const content = typeof message.content === 'string' 
    ? message.content 
    : message.content?.[0]?.text || message.content?.[0]?.input || '';
  
  if (!content) return '';

  // For successful tool executions, format nicely
  if (message.status === 'success') {
    if (message.name?.toLowerCase() === 'shell') {
      return content;
    }
    // Truncate long results for readability
    if (content.length > 200) {
      return content.slice(0, 200) + '...';
    }
    return content;
  }

  // For errors, show the full message
  return `Error: ${content}`;
}

/**
 * Formats a log chunk into a human-readable string, or returns null if the chunk
 * should not be displayed.
 */
export function formatDisplayLog(chunk: LogChunk | string): string | null {
  if (typeof chunk === 'string') {
    // Handle feedback messages
    if (chunk.startsWith('Human feedback:')) {
      return `[HUMAN FEEDBACK RECEIVED] ${chunk.replace('Human feedback:', '').trim()}`;
    }
    // Filter out [object Object] and raw file content dumps
    if (chunk === '[object Object]' || 
        chunk.includes('total 4') ||
        chunk.includes('drwxr-xr-x') ||
        chunk.includes('Exit code 1') ||
        chunk.startsWith('#') ||
        chunk.startsWith('-') ||
        chunk.startsWith('./')
    ) {
      return null;
    }
    return `[STRING] ${chunk}`;
  }

  const data = chunk.data;

  if (data.plannerSession) {
    return `[PLANNER SESSION STARTED]`;
  }
  if (data.programmerSession) {
    return `[PROGRAMMER SESSION STARTED]`;
  }

  // Handle interrupts and plans
  if (data.__interrupt__) {
    const interrupt = data.__interrupt__[0]?.value;
    if (interrupt?.action_request?.args?.plan) {
      const plan = interrupt.action_request.args.plan;
      const steps = plan.split(':::')
        .map((s: string) => s.trim())
        .filter(Boolean);
      return [
        '[PROPOSED PLAN]',
        ...steps.map((step: string, idx: number) => `  ${idx + 1}. ${step}`)
      ].join('\n');
    }
    return `[INTERRUPT] Waiting for feedback...`;
    
  }

  if (data.action) {
    const actionStr = JSON.stringify(data.action);
    // Only show action if it's not just an object reference
    if (actionStr !== '{}' && !actionStr.includes('[object Object]')) {
      return `[ACTION] ${actionStr}`;
    }
    return null;
  }

  if ('messages' in data) {
    // Look for tool_calls with args
    const messages = Array.isArray(data.messages) ? data.messages : [data.messages];
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tool of msg.tool_calls) {
          if (tool.args) {
            return `[TOOL CALL] ${JSON.stringify(tool.args, null, 2)}`;
          }
        }
      }
      else {
        return `[MESSAGE] ${JSON.stringify(msg, null, 2)}`;
      }
    }
  }

  // Handle feedback messages in command data
  if (data.command?.resume?.[0]?.type) {
    const type = data.command.resume[0].type;
    return `[HUMAN FEEDBACK RECEIVED] ${type}`;
  }

  return null;
}

/**
 * Formats a log chunk for debug purposes, showing all raw data.
 * This should only be used during development.
 */
export function formatDebugLog(chunk: LogChunk | string): string {
  if (typeof chunk === 'string') return chunk;
  return JSON.stringify(chunk, null, 2);
}