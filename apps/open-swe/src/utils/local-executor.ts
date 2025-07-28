import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger, LogLevel } from './logger.js';
import { GraphConfig, TargetRepository } from '@open-swe/shared/open-swe/types';

const logger = createLogger(LogLevel.INFO, 'LocalExecutor');
const execAsync = promisify(exec);

export interface ExecuteResponse {
  exitCode: number;
  result: string;
  artifacts?: {
    stdout?: string;
    stderr?: string;
  };
}

export interface LocalExecutor {
  id: string;
  workingDirectory: string;
  process: {
    executeCommand: (
      command: string,
      workdir?: string,
      env?: Record<string, string>,
      timeout?: number
    ) => Promise<ExecuteResponse>;
  };
}

class LocalExecutorImpl implements LocalExecutor {
  public id: string;
  public workingDirectory: string;

  constructor(workingDirectory: string) {
    this.id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.workingDirectory = workingDirectory;
  }

  process = {
    executeCommand: async (
      command: string,
      workdir?: string,
      env?: Record<string, string>,
      timeout: number = 30
    ): Promise<ExecuteResponse> => {
      const cwd = workdir || this.workingDirectory;
      const environment = { ...process.env, ...(env || {}) };

      logger.info('Executing command locally', { command, cwd });

      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd,
          env: environment,
          timeout: timeout * 1000, // Convert to milliseconds
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        return {
          exitCode: 0,
          result: stdout,
          artifacts: {
            stdout,
            stderr: stderr || undefined,
          },
        };
      } catch (error: any) {
        logger.error('Command execution failed', { command, error: error.message });
        
        return {
          exitCode: error.code || 1,
          result: error.stdout || error.message,
          artifacts: {
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
          },
        };
      }
    },
  };


}

// Local executor instances cache
const localExecutors = new Map<string, LocalExecutor>();

/**
 * Create or get a local executor for the current working directory
 */
export async function createLocalExecutor(
  targetRepository: TargetRepository,
  config: GraphConfig
): Promise<LocalExecutor> {
  const workingDirectory = getLocalWorkspaceDir(targetRepository);
  
  // Check if we already have an executor for this working directory
  const existingExecutor = localExecutors.get(workingDirectory);
  if (existingExecutor) {
    return existingExecutor;
  }

  const executor = new LocalExecutorImpl(workingDirectory);
  localExecutors.set(workingDirectory, executor);

  logger.info('Created local executor', { 
    id: executor.id, 
    workingDirectory: executor.workingDirectory 
  });

  return executor;
}

/**
 * Get the local workspace directory (current project directory)
 */
export function getLocalWorkspaceDir(
  targetRepository: TargetRepository
): string {
  // Use the current working directory as the workspace
  // Or use a specified project path from environment variable
  return process.env.OPEN_SWE_PROJECT_PATH || process.cwd();
}

/**
 * Clean up a local executor (removes from cache, but doesn't delete working directory)
 */
export async function cleanupLocalExecutor(executor: LocalExecutor): Promise<void> {
  try {
    // Just remove from cache, don't delete the working directory since it's the actual project
    localExecutors.delete(executor.workingDirectory);
    logger.info('Cleaned up local executor', { id: executor.id });
  } catch (error) {
    logger.error('Failed to cleanup local executor', { id: executor.id, error });
  }
}

/**
 * Get local executor by working directory (replacement for getSandboxSessionOrThrow)
 */
export function getLocalExecutorOrThrow(
  targetRepository: TargetRepository,
  config: GraphConfig
): LocalExecutor {
  const workingDirectory = getLocalWorkspaceDir(targetRepository);
  const executor = localExecutors.get(workingDirectory);
  
  if (!executor) {
    throw new Error(`No local executor found for working directory: ${workingDirectory}`);
  }

  return executor;
} 