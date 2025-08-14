import dotenv from "dotenv";
import { Daytona, Sandbox } from "@daytonaio/sdk";
import { createLogger, LogLevel } from "../src/utils/logger.js";
import { DEFAULT_SANDBOX_CREATE_PARAMS } from "../src/constants.js";
import { cloneRepo } from "../src/utils/github/git.js";
import { TargetRepository } from "@open-swe/shared/open-swe/types";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { setupEnv, ENV_CONSTANTS } from "../src/utils/env-setup.js";

dotenv.config();

const logger = createLogger(LogLevel.INFO, "Standalone Test Runner");
const { RUN_PYTHON_IN_VENV, RUN_PIP_IN_VENV } = ENV_CONSTANTS;

// Installation commands
const PIP_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install pytest pytest-mock pytest-asyncio syrupy pytest-json-report psycopg psycopg_pool`;
const LANGGRAPH_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install -e ./libs/langgraph`;
const CHECKPOINT_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install -e ./libs/checkpoint-sqlite -e ./libs/checkpoint-postgres`;

interface TestRunnerResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  workspaceId?: string;
}

/**
 * Install Docker in the sandbox using official method
 */
async function installDocker(sandbox: Sandbox, repoDir: string): Promise<boolean> {
  try {
    logger.info("Installing Docker using official method...");

    // Update package lists and install prerequisites
    const updateResult = await sandbox.process.executeCommand(
      "sudo apt update && sudo apt install -y apt-transport-https ca-certificates curl software-properties-common",
      repoDir,
      undefined,
      120000
    );

    if (updateResult.exitCode !== 0) {
      logger.error("Failed to install prerequisites", { output: updateResult.result });
      return false;
    }

    // Add Docker's GPG key
    const keyResult = await sandbox.process.executeCommand(
      "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -",
      repoDir,
      undefined,
      60000
    );

    if (keyResult.exitCode !== 0) {
      logger.error("Failed to add Docker GPG key", { output: keyResult.result });
      return false;
    }

    // Check Ubuntu version and add appropriate Docker repository
    const versionResult = await sandbox.process.executeCommand(
      "lsb_release -cs",
      repoDir,
      undefined,
      10000
    );

    logger.info("Ubuntu version:", { output: versionResult.result?.trim() });

    // Add Docker repository - use focal for compatibility if newer version
    const ubuntuVersion = versionResult.result?.trim() || "focal";
    const dockerRepo = ["jammy", "focal", "bionic"].includes(ubuntuVersion) ? ubuntuVersion : "focal";
    
    const repoResult = await sandbox.process.executeCommand(
      `sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu ${dockerRepo} stable"`,
      repoDir,
      undefined,
      60000
    );

    if (repoResult.exitCode !== 0) {
      logger.error("Failed to add Docker repository", { output: repoResult.result });
      return false;
    }

    // Update package lists again
    const updateResult2 = await sandbox.process.executeCommand(
      "sudo apt update",
      repoDir,
      undefined,
      60000
    );

    // Install Docker CE, fallback to docker.io if it fails
    let installResult = await sandbox.process.executeCommand(
      "sudo apt install -y docker-ce",
      repoDir,
      undefined,
      300000
    );

    if (installResult.exitCode !== 0) {
      logger.warn("Docker CE installation failed, trying docker.io fallback", { output: installResult.result });
      
      installResult = await sandbox.process.executeCommand(
        "sudo apt install -y docker.io",
        repoDir,
        undefined,
        300000
      );

      if (installResult.exitCode !== 0) {
        logger.error("Failed to install Docker (both docker-ce and docker.io failed)", { output: installResult.result });
        return false;
      }
    }

    // Start Docker service using service command (not systemd)
    const startResult = await sandbox.process.executeCommand(
      "sudo service docker start",
      repoDir,
      undefined,
      60000
    );

    if (startResult.exitCode !== 0) {
      logger.error("Failed to start Docker service", { output: startResult.result });
      return false;
    }

    // Check Docker service status
    const statusResult = await sandbox.process.executeCommand(
      "sudo service docker status",
      repoDir,
      undefined,
      30000
    );

    logger.info("Docker service status:", { output: statusResult.result });

    // Add user to docker group
    const userAddResult = await sandbox.process.executeCommand(
      "sudo usermod -aG docker $USER",
      repoDir,
      undefined,
      10000
    );

    // Set proper permissions on docker socket
    const socketPermResult = await sandbox.process.executeCommand(
      "sudo chmod 666 /var/run/docker.sock",
      repoDir,
      undefined,
      10000
    );

    // Wait for Docker daemon to be ready
    logger.info("Waiting for Docker daemon to be ready...");
    let dockerReady = false;
    for (let i = 0; i < 30; i++) {
      const testResult = await sandbox.process.executeCommand(
        "sudo docker version",
        repoDir,
        undefined,
        10000
      );
      
      if (testResult.exitCode === 0) {
        // Also test without sudo to ensure user can access
        const userTestResult = await sandbox.process.executeCommand(
          "docker version",
          repoDir,
          undefined,
          10000
        );
        
        if (userTestResult.exitCode === 0) {
          dockerReady = true;
          break;
        } else {
          logger.info(`Docker works with sudo but not without (attempt ${i + 1})`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!dockerReady) {
      logger.error("Docker daemon failed to become ready");
      // Try to get more diagnostic info
      const diagResult = await sandbox.process.executeCommand(
        "sudo service docker status && ps aux | grep docker",
        repoDir,
        undefined,
        30000
      );
      logger.error("Docker diagnostic info:", { output: diagResult.result });
      return false;
    }

    // Install docker-compose
    const composeInstallResult = await sandbox.process.executeCommand(
      "sudo apt install -y docker-compose",
      repoDir,
      undefined,
      300000
    );

    if (composeInstallResult.exitCode !== 0) {
      logger.warn("Failed to install docker-compose", { output: composeInstallResult.result });
    }

    // Create wrapper script for "docker compose" command
    const wrapperScript = `#!/bin/bash
if [ "$1" = "compose" ]; then
    shift
    exec docker-compose "$@"
else
    exec /usr/bin/docker.orig "$@"
fi`;

    // Backup original docker and create wrapper
    const backupResult = await sandbox.process.executeCommand(
      "sudo mv /usr/bin/docker /usr/bin/docker.orig",
      repoDir,
      undefined,
      10000
    );

    const createWrapperResult = await sandbox.process.executeCommand(
      `echo '${wrapperScript}' | sudo tee /usr/bin/docker && sudo chmod +x /usr/bin/docker`,
      repoDir,
      undefined,
      10000
    );

    // Test the wrapper script
    const wrapperTestResult = await sandbox.process.executeCommand(
      "docker compose version",
      repoDir,
      undefined,
      30000
    );

    logger.info("Docker compose wrapper test:", { output: wrapperTestResult.result });

    logger.info("Docker installation completed successfully");
    return true;
  } catch (error) {
    logger.error("Docker installation failed", { error });
    return false;
  }
}

/**
 * Setup PostgreSQL database in the sandbox using direct Docker commands
 */
async function setupPostgres(sandbox: Sandbox, repoDir: string): Promise<boolean> {
  try {
    logger.info("Setting up PostgreSQL using direct Docker commands...");

    const langgraphDir = `${repoDir}/libs/langgraph`;

    // Since the compose file is incompatible with older docker-compose, run postgres directly
    logger.info("Starting PostgreSQL container directly...");
    
    // Stop any existing postgres containers
    const stopResult = await sandbox.process.executeCommand(
      "docker stop postgres-test 2>/dev/null || true && docker rm postgres-test 2>/dev/null || true",
      langgraphDir,
      undefined,
      30000
    );

    // Start PostgreSQL container with host networking to avoid port mapping issues
    const startResult = await sandbox.process.executeCommand(
      "docker run -d --name postgres-test --network host -e POSTGRES_DB=postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e PGPORT=5442 postgres:16 postgres -p 5442",
      langgraphDir,
      undefined,
      120000
    );

    if (startResult.exitCode !== 0) {
      logger.error("Failed to start PostgreSQL container", { output: startResult.result });
      return false;
    }

    logger.info("PostgreSQL container started:", { output: startResult.result });

    // Wait for PostgreSQL to be ready
    logger.info("Waiting for PostgreSQL to be ready...");
    let pgReady = false;
    for (let i = 0; i < 30; i++) {
      const readyResult = await sandbox.process.executeCommand(
        "docker exec postgres-test pg_isready -U postgres",
        langgraphDir,
        undefined,
        10000
      );

      if (readyResult.exitCode === 0) {
        pgReady = true;
        logger.info("PostgreSQL is ready!");
        break;
      }

      logger.info(`Waiting for PostgreSQL... attempt ${i + 1}/30`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!pgReady) {
      logger.error("PostgreSQL failed to become ready");
      return false;
    }

    // Verify container is running and check if port 5442 is listening
    const checkResult = await sandbox.process.executeCommand(
      "docker ps --filter name=postgres-test && netstat -tlnp | grep :5442 || ss -tlnp | grep :5442 || echo 'Port 5442 not listening'",
      langgraphDir,
      undefined,
      30000
    );

    logger.info("PostgreSQL container status:", { output: checkResult.result });

    // Test connection from host
    const hostConnectionResult = await sandbox.process.executeCommand(
      "docker exec postgres-test psql -U postgres -d postgres -c 'SELECT 1;'",
      langgraphDir,
      undefined,
      30000
    );

    logger.info("PostgreSQL connection test:", { output: hostConnectionResult.result });

    // Test direct connection to port 5442
    const directConnectionResult = await sandbox.process.executeCommand(
      "timeout 5 bash -c 'echo > /dev/tcp/localhost/5442' && echo 'Port 5442 is reachable' || echo 'Port 5442 is not reachable'",
      langgraphDir,
      undefined,
      10000
    );

    logger.info("Direct port 5442 test:", { output: directConnectionResult.result });

    logger.info("PostgreSQL setup completed successfully");
    return true;
  } catch (error) {
    logger.error("PostgreSQL setup failed", { error });
    return false;
  }
}

/**
 * Main function to run standalone test
 */
async function runStandaloneTest(commitSha: string, testFile: string, testName?: string): Promise<TestRunnerResult> {
  const repoOwner = "langchain-ai";
  const repoName = "langgraph";
  
  logger.info(`Starting standalone test runner`);
  logger.info(`Commit: ${commitSha}`);
  logger.info(`Test file: ${testFile}`);
  if (testName) {
    logger.info(`Test name: ${testName}`);
  }

  const daytona = new Daytona({
    organizationId: process.env.DAYTONA_ORGANIZATION_ID,
  });

  let sandbox: Sandbox | undefined;

  try {
    // Create sandbox
    logger.info("Creating sandbox...");
    sandbox = await daytona.create(DEFAULT_SANDBOX_CREATE_PARAMS);

    if (!sandbox || !sandbox.id) {
      throw new Error("Failed to create sandbox");
    }

    logger.info(`Sandbox created: ${sandbox.id}`);

    // Setup target repository
    const targetRepository: TargetRepository = {
      owner: repoOwner,
      repo: repoName,
      branch: undefined,
      baseCommit: commitSha,
    };

    const repoDir = getRepoAbsolutePath(targetRepository);
    const githubToken = process.env.GITHUB_PAT;

    if (!githubToken) {
      throw new Error("GITHUB_PAT environment variable is required");
    }

    // Clone repository at specific commit
    logger.info(`Cloning repository at commit: ${commitSha}`);
    await cloneRepo(sandbox, targetRepository, {
      githubInstallationToken: githubToken,
    });

    // Verify we're at the right commit
    const commitCheckResult = await sandbox.process.executeCommand(
      "git rev-parse HEAD",
      repoDir,
      undefined,
      10000
    );

    logger.info(`Current commit: ${commitCheckResult.result?.trim()}`);

    // Setup Python environment
    logger.info("Setting up Python environment...");
    const envSetup = await setupEnv(sandbox, repoDir);
    if (!envSetup) {
      logger.warn("Python environment setup failed, continuing anyway");
    }

    // Install pytest dependencies
    logger.info("Installing pytest dependencies...");
    const pipResult = await sandbox.process.executeCommand(
      PIP_INSTALL_COMMAND,
      repoDir,
      undefined,
      600000
    );

    if (pipResult.exitCode !== 0) {
      logger.warn("Pip install had issues", { output: pipResult.result });
    }

    // Install langgraph
    logger.info("Installing langgraph...");
    const langgraphResult = await sandbox.process.executeCommand(
      LANGGRAPH_INSTALL_COMMAND,
      repoDir,
      undefined,
      600000
    );

    if (langgraphResult.exitCode !== 0) {
      logger.warn("Langgraph install had issues", { output: langgraphResult.result });
    }

    // Install checkpoint packages
    logger.info("Installing checkpoint packages...");
    const checkpointResult = await sandbox.process.executeCommand(
      CHECKPOINT_INSTALL_COMMAND,
      repoDir,
      undefined,
      600000
    );

    if (checkpointResult.exitCode !== 0) {
      logger.warn("Checkpoint install had issues", { output: checkpointResult.result });
    }

    // Install Docker first
    logger.info("Installing Docker...");
    const dockerSuccess = await installDocker(sandbox, repoDir);
    if (!dockerSuccess) {
      logger.warn("Docker installation failed, PostgreSQL setup may fail");
    }

    // Setup PostgreSQL after checkpoint packages are installed
    logger.info("Setting up PostgreSQL database...");
    const postgresSuccess = await setupPostgres(sandbox, repoDir);
    if (!postgresSuccess) {
      logger.warn("PostgreSQL setup failed, continuing without database");
    }

    // Run the test
    let testCommand = `${RUN_PYTHON_IN_VENV} -m pytest ${testFile} -v --tb=short`;
    if (testName) {
      testCommand += ` -k "${testName}"`;
    }

    logger.info(`Running test: ${testCommand}`);

    const testResult = await sandbox.process.executeCommand(
      testCommand,
      repoDir,
      undefined,
      1200000 // 20 minutes timeout
    );

    // Log results
    console.log("\n" + "=".repeat(50));
    console.log("TEST RESULTS");
    console.log("=".repeat(50));
    console.log(`Exit code: ${testResult.exitCode}`);
    console.log(`Success: ${testResult.exitCode === 0}`);
    console.log("\nOutput:");
    console.log(testResult.result);
    console.log("=".repeat(50));

    return {
      success: testResult.exitCode === 0,
      output: testResult.result,
      exitCode: testResult.exitCode,
      workspaceId: sandbox.id
    };

  } catch (error) {
    logger.error("Test execution failed", { error });
    console.error("ERROR:", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      workspaceId: sandbox?.id
    };
  } finally {
    // Cleanup sandbox
    if (sandbox) {
      try {
        await sandbox.delete();
        logger.info(`Sandbox deleted: ${sandbox.id}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup sandbox`, { cleanupError });
      }
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: tsx standalone-test-runner.ts <commit_sha> <test_file> [test_name]");
    console.log("");
    console.log("Examples:");
    console.log("  tsx standalone-test-runner.ts abc123 libs/langgraph/tests/test_large_cases.py");
    console.log("  tsx standalone-test-runner.ts abc123 libs/langgraph/tests/test_large_cases.py test_state_graph_packets");
    process.exit(1);
  }

  const commitSha = args[0];
  const testFile = args[1];
  const testName = args[2] || undefined;

  const result = await runStandaloneTest(commitSha, testFile, testName);
  process.exit(result.success ? 0 : 1);
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error("Unhandled error:", { error });
    process.exit(1);
  });
}

export { runStandaloneTest };