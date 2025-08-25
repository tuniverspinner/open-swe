#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { promptForMissingConfig, applyConfigToEnv } from '@open-swe/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

interface ServerProcess {
  process: ChildProcess;
  name: string;
  ready: boolean;
}

class OpenSWEOrchestrator {
  private langGraphServer: ServerProcess | null = null;
  private cliProcess: ServerProcess | null = null;
  private isShuttingDown = false;
  private workspaceRoot: string;

  constructor() {
    // Find the workspace root (where the main package.json is)
    this.workspaceRoot = this.findWorkspaceRoot();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('exit', () => this.shutdown());
  }

  private findWorkspaceRoot(): string {
    let currentDir = process.cwd();
    
    // Walk up the directory tree to find the workspace root
    while (currentDir !== path.parse(currentDir).root) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (packageJson.workspaces) {
            return currentDir;
          }
        } catch (e) {
          // Continue searching if package.json is invalid
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    // If we can't find workspace root, use the directory containing this package
    return path.resolve(__dirname, '../../..');
  }

  private async startLangGraphServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      
      const langGraphPath = path.join(this.workspaceRoot, 'apps', 'open-swe-v2-js');
      
      if (!fs.existsSync(langGraphPath)) {
        reject(new Error(`LangGraph server path not found: ${langGraphPath}`));
        return;
      }

      // Load .env file from the LangGraph directory
      const envPath = path.join(langGraphPath, '.env');
      let envVars = { ...process.env };
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
              envVars[key] = value;
            }
          }
        }
      }

      const serverProcess = spawn('langgraphjs', ['dev'], {
        cwd: langGraphPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...envVars,
          // Ensure these are properly set
          NODE_ENV: envVars.NODE_ENV || 'development',
          PATH: envVars.PATH || process.env.PATH
        },
        shell: true
      });

      this.langGraphServer = {
        process: serverProcess,
        name: 'LangGraph Server',
        ready: false
      };

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        
        // Check if server is ready (but don't log all output)
        if (output.includes('Server running at') || 
            output.includes('localhost:2024') || 
            output.includes('::1:2024') ||
            output.includes('Starting 10 workers')) {
          this.langGraphServer!.ready = true;
          resolve();
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        // Only log actual errors, not warnings or info messages
        if (output.toLowerCase().includes('error') && !output.includes('Warning:')) {
          console.error(`[LangGraph Error] ${output.trim()}`);
        }
      });

      serverProcess.on('error', (error) => {
        reject(error);
      });

      serverProcess.on('exit', (code, signal) => {
        if (!this.isShuttingDown) {
          console.error(`❌ LangGraph server exited with code ${code}, signal: ${signal}`);
          this.shutdown();
        }
      });

      // Timeout if server doesn't start within 30 seconds
      setTimeout(() => {
        if (!this.langGraphServer?.ready) {
          reject(new Error('LangGraph server failed to start within 30 seconds'));
        }
      }, 30000);
    });
  }

  private async startCLI(args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      
      const cliPath = path.join(this.workspaceRoot, 'apps', 'cli');
      
      if (!fs.existsSync(cliPath)) {
        reject(new Error(`CLI path not found: ${cliPath}`));
        return;
      }

      // Build the CLI command - run the built version
      const cliProcess = spawn('node', ['dist/index.js', ...args], {
        cwd: cliPath,
        stdio: 'inherit',
        env: { 
          ...process.env,
          LANGGRAPH_URL: 'http://localhost:2024',
          OPEN_SWE_LOCAL_PROJECT_PATH: process.cwd()
        }
      });

      this.cliProcess = {
        process: cliProcess,
        name: 'OpenSWE CLI',
        ready: true
      };

      cliProcess.on('error', (error) => {
        reject(error);
      });

      cliProcess.on('exit', (code, signal) => {
        if (!this.isShuttingDown) {
        }
        this.shutdown();
        process.exit(code || 0);
      });

      resolve();
    });
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    
    const shutdownPromises: Promise<void>[] = [];
    
    if (this.cliProcess?.process) {
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          this.cliProcess!.process.on('exit', () => resolve());
          this.cliProcess!.process.kill('SIGTERM');
          setTimeout(() => {
            if (!this.cliProcess!.process.killed) {
              this.cliProcess!.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        })
      );
    }
    
    if (this.langGraphServer?.process) {
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          this.langGraphServer!.process.on('exit', () => resolve());
          this.langGraphServer!.process.kill('SIGTERM');
          setTimeout(() => {
            if (!this.langGraphServer!.process.killed) {
              this.langGraphServer!.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        })
      );
    }
    
    await Promise.all(shutdownPromises);
  }

  public async start(cliArgs: string[] = []): Promise<void> {
    try {
      // Check and prompt for missing configuration first
      await promptForMissingConfig();
      
      // Apply configuration to environment
      applyConfigToEnv();
      
      // Start LangGraph server first
      await this.startLangGraphServer();
      
      // Wait a moment for server to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start CLI
      await this.startCLI(cliArgs);
    } catch (error) {
      await this.shutdown();
      process.exit(1);
    }
  }
}

// CLI Definition
program
  .name('openswe')
  .description('OpenSWE - Unified CLI tool for running OpenSWE CLI + LangGraph server')
  .version('1.0.0')
  .option('--replay <file>', 'Replay from LangSmith trace file')
  .option('--speed <ms>', 'Replay speed in milliseconds', '500')
  .helpOption('-h, --help', 'Display help for command')
  .action(async (options) => {
    
    const orchestrator = new OpenSWEOrchestrator();
    
    // Pass CLI options to the underlying CLI
    const cliArgs: string[] = [];
    if (options.replay) {
      cliArgs.push('--replay', options.replay);
    }
    if (options.speed && options.speed !== '500') {
      cliArgs.push('--speed', options.speed);
    }
    
    await orchestrator.start(cliArgs);
  });

// Parse command line arguments
program.parse();