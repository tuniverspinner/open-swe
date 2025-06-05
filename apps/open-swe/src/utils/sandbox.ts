import { Daytona, Sandbox, SandboxState } from "@daytonaio/sdk";

// Singleton instance of Daytona
let daytonaInstance: Daytona | null = null;

/**
 * Returns a shared Daytona instance
 */
export function daytonaClient(): Daytona {
  if (!daytonaInstance) {
    daytonaInstance = new Daytona();
  }
  return daytonaInstance;
}

/**
 * Stops the sandbox. Either pass an existing sandbox client, or a sandbox session ID.
 * If no sandbox client is provided, the sandbox will be connected to.
 
 * @param sandboxSessionId The ID of the sandbox to stop.
 * @param sandbox The sandbox client to stop. If not provided, the sandbox will be connected to.
 * @returns The sandbox session ID.
 */
export async function stopSandbox(sandboxSessionId: string): Promise<string> {
  const sandbox = await daytonaClient().get(sandboxSessionId);
  if (
    sandbox.instance.state == SandboxState.STOPPED ||
    sandbox.instance.state == SandboxState.ARCHIVED
  ) {
    return sandboxSessionId;
  } else if (sandbox.instance.state == "started") {
    await daytonaClient().stop(sandbox);
  }

  return sandbox.id;
}

/**
 * Starts the sandbox.
 * @param sandboxSessionId The ID of the sandbox to start.
 * @returns The sandbox client.
 */
export async function startSandbox(sandboxSessionId: string): Promise<Sandbox> {
  const sandbox = await daytonaClient().get(sandboxSessionId);
  if (
    sandbox.instance.state == SandboxState.STOPPED ||
    sandbox.instance.state == SandboxState.ARCHIVED
  ) {
    await daytonaClient().start(sandbox);
  }
  return sandbox;
}

/**
 * Checks if a sandbox is currently running
 * @param sandboxSessionId The ID of the sandbox to check
 * @returns True if the sandbox is running, false otherwise
 */
export async function isSandboxRunning(sandboxSessionId: string): Promise<boolean> {
  try {
    const sandbox = await daytonaClient().get(sandboxSessionId);
    return sandbox.instance.state === "started";
  } catch (error) {
    // If we can't get the sandbox, it's not running
    return false;
  }
}

/**
 * Restarts a sandbox by stopping it if running and then starting it again.
 * This reuses the existing sandbox ID instead of creating a new one.
 * @param sandboxSessionId The ID of the sandbox to restart
 * @returns The sandbox client after restart
 */
export async function restartSandbox(sandboxSessionId: string): Promise<Sandbox> {
  // First stop the sandbox if it's running
  await stopSandbox(sandboxSessionId);
  
  // Then start it again
  const sandbox = await startSandbox(sandboxSessionId);
  return sandbox;
}
