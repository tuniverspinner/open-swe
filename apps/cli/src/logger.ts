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
 * Format a tool call based on its type and arguments
 */
function formatToolCall(tool: ToolCall): string {
  try {
    const args = tool.args ? JSON.parse(tool.args) : {};
    const name = tool.name || 'unknown';

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
      case 'install_dependencies':
        return `Install: ${args.command || ''}`;
      case 'apply_patch':
        return `Apply patch to: ${args.file_path || ''}`;
      default:
        const argsStr = Object.entries(args)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join(', ');
        return `${name}(${argsStr})`;
    }
  } catch (e) {
    return tool.args || '';
  }
}

/**
 * Format a tool result based on its type and content
 */
function formatToolResult(message: MessageData): string {
  const content = typeof message.content === 'string' 
    ? message.content 
    : message.content?.[0]?.text || message.content?.[0]?.input || '';
  
  if (!content) return '';

  // For successful tool executions, format nicely
  if (message.status === 'success') {
    switch (message.name?.toLowerCase()) {
      case 'shell':
      case 'grep_search':
      case 'search':
        return content;
      case 'apply_patch':
        return content.includes('Error') ? `Error: ${content}` : 'Patch applied successfully';
      case 'install_dependencies':
        return content.includes('Error') ? `Error: ${content}` : 'Dependencies installed successfully';
      default:
        if (content.length > 200) {
          return content.slice(0, 200) + '...';
        }
        return content;
    }
  }

  // For errors, show full message
  return `Error: ${content}`;
}

export function formatDisplayLog(chunk: LogChunk | string): string | null {
  if (typeof chunk === 'string') {
    if (chunk.startsWith('Human feedback:')) {
      return `[HUMAN FEEDBACK RECEIVED] ${chunk.replace('Human feedback:', '').trim()}`;
    }
    // Filter out raw file content and object references
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
    return `[SYSTEM] ${chunk}`;
  }

  const data = chunk.data;

  // Handle session events
  if (data.plannerSession) {
    return '[PLANNER SESSION STARTED]';
  }
  if (data.programmerSession) {
    return '[PROGRAMMER SESSION STARTED]';
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
    return '[INTERRUPT] Waiting for feedback...';
  }

  // Handle messages
  if ('messages' in data) {
    const messages = Array.isArray(data.messages) ? data.messages : [data.messages];
    for (const msg of messages) {
      // Handle tool results
      if (msg.type === 'tool') {
        const toolName = msg.name || 'tool';
        const result = formatToolResult(msg);
        if (!result) return null;
        return `[TOOL RESULT] ${toolName}:\n  ${result}`;
      }

      // Handle AI messages
      if (msg.type === 'ai') {
        // Handle tool calls
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          return msg.tool_calls.map((tool: ToolCall) => {
            const action = formatToolCall(tool);
            return `[TOOL CALL] ${action}`;
          }).join('\n');
        }
        
        // Handle regular AI messages
        const text = typeof msg.content === 'string'
          ? msg.content
          : msg.content?.[0]?.text || msg.content?.[0]?.input || '';
        if (!text) return null;
        return `[AI] ${text}`;
      }

      // Handle human messages
      if (msg.type === 'human') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : msg.content?.[0]?.text || msg.content?.[0]?.input || '';
        if (!text) return null;
        return `[HUMAN] ${text}`;
      }
    }
  }

  // Handle task status updates
  if (data.action) {
    const actionStr = JSON.stringify(data.action);
    if (actionStr !== '{}' && !actionStr.includes('[object Object]')) {
      return `[ACTION] ${actionStr}`;
    }
    return null;
  }

  // Handle feedback messages
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