/**
 * Utility functions for detecting programming languages from file extensions,
 * command patterns, and content analysis for syntax highlighting
 */

// File extension to language mapping
const FILE_EXTENSION_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  '.js': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.mjs': 'js',
  '.cjs': 'js',
  
  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',
  
  // Shell/Bash
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.fish': 'bash',
  
  // Web technologies
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  
  // Data formats
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.toml': 'toml',
  
  // Documentation
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.rst': 'rst',
  
  // Database
  '.sql': 'sql',
  
  // Docker
  'dockerfile': 'dockerfile',
  '.dockerfile': 'dockerfile',
  
  // Programming languages
  '.java': 'java',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.php': 'php',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.r': 'r',
  '.R': 'r',
  '.m': 'matlab',
  '.pl': 'perl',
  '.lua': 'lua',
  '.vim': 'vim',
  '.tex': 'latex',
  '.dart': 'dart',
  '.elm': 'elm',
  '.clj': 'clojure',
  '.hs': 'haskell',
  '.ml': 'ocaml',
  '.fs': 'fsharp',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.jl': 'julia',
  '.nim': 'nim',
  '.zig': 'zig',
};

// Command patterns that indicate specific languages or content types
const COMMAND_PATTERNS: Array<{ pattern: RegExp; language: string }> = [
  // Git commands
  { pattern: /^git\s+(diff|show|log)/, language: 'diff' },
  { pattern: /^git\s+/, language: 'bash' },
  
  // Package managers
  { pattern: /^(npm|yarn|pnpm)\s+/, language: 'bash' },
  { pattern: /^pip\s+/, language: 'bash' },
  { pattern: /^cargo\s+/, language: 'bash' },
  { pattern: /^go\s+(build|run|test)/, language: 'bash' },
  
  // File operations with specific extensions
  { pattern: /\.(js|jsx|ts|tsx|mjs|cjs)(\s|$)/, language: 'javascript' },
  { pattern: /\.py(\s|$)/, language: 'python' },
  { pattern: /\.(sh|bash)(\s|$)/, language: 'bash' },
  { pattern: /\.json(\s|$)/, language: 'json' },
  { pattern: /\.(yaml|yml)(\s|$)/, language: 'yaml' },
  { pattern: /\.sql(\s|$)/, language: 'sql' },
  { pattern: /dockerfile/i, language: 'dockerfile' },
  
  // Common shell commands
  { pattern: /^(ls|cat|grep|find|sed|awk|sort|uniq|head|tail|wc)/, language: 'bash' },
  { pattern: /^(cd|pwd|mkdir|rmdir|rm|cp|mv|chmod|chown)/, language: 'bash' },
  { pattern: /^(curl|wget|ssh|scp|rsync)/, language: 'bash' },
];

/**
 * Detect language from file extension
 */
export function detectLanguageFromExtension(filename: string): string | null {
  const lowerFilename = filename.toLowerCase();
  
  // Check for exact filename matches (like Dockerfile)
  if (FILE_EXTENSION_MAP[lowerFilename]) {
    return FILE_EXTENSION_MAP[lowerFilename];
  }
  
  // Extract extension and check mapping
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return null;
  
  const extension = filename.substring(lastDotIndex).toLowerCase();
  return FILE_EXTENSION_MAP[extension] || null;
}

/**
 * Detect language from shell command patterns
 */
export function detectLanguageFromCommand(command: string[]): string | null {
  const fullCommand = command.join(' ');
  
  for (const { pattern, language } of COMMAND_PATTERNS) {
    if (pattern.test(fullCommand)) {
      return language;
    }
  }
  
  return 'bash'; // Default to bash for shell commands
}

/**
 * Detect language from patch/diff file paths
 */
export function detectLanguageFromPatchFile(filePath: string): string | null {
  // Remove any leading path indicators (a/, b/, etc.)
  const cleanPath = filePath.replace(/^[ab]\//, '');
  return detectLanguageFromExtension(cleanPath);
}

/**
 * Analyze content to detect if it contains structured data
 */
export function detectLanguageFromContent(content: string): string | null {
  const trimmedContent = content.trim();
  
  // JSON detection
  if ((trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) ||
      (trimmedContent.startsWith('[') && trimmedContent.endsWith(']'))) {
    try {
      JSON.parse(trimmedContent);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  
  // YAML detection (basic heuristics)
  if (trimmedContent.includes('---') || 
      /^[\w-]+:\s*[\w\s-]+$/m.test(trimmedContent)) {
    return 'yaml';
  }
  
  // XML detection
  if (trimmedContent.startsWith('<?xml') || 
      (trimmedContent.startsWith('<') && trimmedContent.endsWith('>'))) {
    return 'xml';
  }
  
  // SQL detection (basic keywords)
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(trimmedContent)) {
    return 'sql';
  }
  
  return null;
}

/**
 * Main function to detect language for shell output
 */
export function detectLanguageForShellOutput(
  command: string[],
  output: string
): string | null {
  // First try to detect from command pattern
  const commandLanguage = detectLanguageFromCommand(command);
  if (commandLanguage && commandLanguage !== 'bash') {
    return commandLanguage;
  }
  
  // Then try to detect from output content
  const contentLanguage = detectLanguageFromContent(output);
  if (contentLanguage) {
    return contentLanguage;
  }
  
  // For file viewing commands, try to detect from filename
  const fullCommand = command.join(' ');
  const fileMatch = fullCommand.match(/(?:cat|less|more|head|tail)\s+([^\s]+)/);
  if (fileMatch) {
    const filename = fileMatch[1];
    const extensionLanguage = detectLanguageFromExtension(filename);
    if (extensionLanguage) {
      return extensionLanguage;
    }
  }
  
  return null; // No specific language detected, will use plain text
}

/**
 * Main function to detect language for patch content
 */
export function detectLanguageForPatch(filePath: string): string | null {
  return detectLanguageFromPatchFile(filePath);
}

