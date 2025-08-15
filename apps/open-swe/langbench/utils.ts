import { createLogger, LogLevel } from "../src/utils/logger.js";
import { ENV_CONSTANTS, setupEnv } from "../src/utils/env-setup.js";
import { TestResults, PytestJsonReport, RunPytestOptions } from "./types.js";
import { readFile } from "../src/utils/read-write.js";
import { Daytona, Sandbox } from "@daytonaio/sdk";
import { DEFAULT_SANDBOX_CREATE_PARAMS } from "../src/constants.js";
import { cloneRepo, checkoutFilesFromCommit } from "../src/utils/github/git.js";
import { getRepoAbsolutePath } from "@open-swe/shared/git";

const logger = createLogger(LogLevel.DEBUG, "Langbench Utils");

/**
 * Add and commit files to remote branch
 */
/**
 * Fetch diff content from a diff URL and extract test file names, this function is used in one-off situtations to get the test files from the diff url.
 */
export async function getTestFilesFromDiff(diffUrl: string): Promise<string[]> {
  try {
    const response = await fetch(diffUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.statusText}`);
    }

    const diffContent = await response.text();
    const testFiles: string[] = [];

    // Parse the diff to find modified files
    const lines = diffContent.split("\n");
    for (const line of lines) {
      // Look for diff file headers
      if (line.startsWith("diff --git ")) {
        const match = line.match(/diff --git a\/(.+?) b\//);
        if (match) {
          const filePath = match[1];
          // Check if this is a test file in libs/langgraph/tests/
          if (isLangGraphTestFile(filePath)) {
            testFiles.push(filePath);
          }
        }
      }
    }

    return [...new Set(testFiles)]; // Remove duplicates
  } catch (error) {
    logger.error(`Failed to fetch or parse diff from ${diffUrl}:`, { error });
    return [];
  }
}

/**
 * Check if a file path represents a test file in libs/langgraph/tests/
 */
function isLangGraphTestFile(filePath: string): boolean {
  return filePath.includes("libs/langgraph/tests/") && filePath.endsWith(".py");
}

// Use shared constants from env-setup utility
const { RUN_PYTHON_IN_VENV, RUN_PIP_IN_VENV } = ENV_CONSTANTS;

// Installation commands for pytest and dependencies
const PIP_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install pytest pytest-mock pytest-asyncio syrupy pytest-json-report psycopg psycopg_pool pytest-asyncio pycryptodome`;
const LANGGRAPH_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install -e ./libs/langgraph`;
const CHECKPOINT_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install -e ./libs/checkpoint -e ./libs/checkpoint-sqlite -e ./libs/checkpoint-duckdb -e ./libs/checkpoint-postgres`;
/**
 * Run pytest on specific test files in a fresh sandbox with the specified branch
 */
export async function runPytestOnFiles(
  options: RunPytestOptions,
): Promise<TestResults> {
  const { targetRepository, branchName, testFiles, timeoutSec = 300, testNames, mergeCommitSha } = options;
  
  if (testFiles.length === 0) {
    logger.warn("No test files provided, skipping pytest execution");
    return {
      success: true,
      error: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testDetails: [],
    };
  }

  logger.info(`Creating fresh sandbox for pytest execution on branch: ${branchName}`, {
    testFiles,
    targetRepository,
  });

  const daytona = new Daytona({
    organizationId: process.env.DAYTONA_ORGANIZATION_ID,
  });

  let sandbox: Sandbox | undefined;

  try {
    // Create a fresh sandbox for test execution
    sandbox = await daytona.create(DEFAULT_SANDBOX_CREATE_PARAMS);
    
    if (!sandbox || !sandbox.id) {
      throw new Error("Failed to create valid test sandbox");
    }

    logger.info(`Created test sandbox: ${sandbox.id}`);

    const repoDir = getRepoAbsolutePath(targetRepository);
    const githubToken = process.env.GITHUB_PAT;
    
    if (!githubToken) {
      throw new Error("GITHUB_PAT environment variable is required");
    }

    // Clone the repository from main branch (not baseCommit) to access pushed test branches
    const testTargetRepository = {
      ...targetRepository,
      baseCommit: undefined, // Remove baseCommit to clone from main branch
    };
    await cloneRepo(sandbox, testTargetRepository, {
      githubInstallationToken: githubToken,
      stateBranchName: branchName,
    });

    // Checkout the specific branch created by open-swe
    logger.info(`Checking out branch: ${branchName}`);
    const checkoutResult = await sandbox.process.executeCommand(
      `git checkout ${branchName}`,
      repoDir,
      undefined,
      60000,
    );

    if (checkoutResult.exitCode !== 0) {
      throw new Error(`Failed to checkout branch ${branchName}: ${checkoutResult.result}`);
    }

    logger.info(`Successfully checked out branch: ${branchName}`);

    // Checkout test files from merge commit if mergeCommitSha is provided
    if (mergeCommitSha && testFiles.length > 0) {
      logger.info(
        `Fetching and checking out test files from merge commit: ${mergeCommitSha}`,
      );
      
      // First, fetch the merge commit from origin to make it available locally
      logger.info(`Fetching merge commit from origin: ${mergeCommitSha}`);
      const fetchResult = await sandbox.process.executeCommand(
        `git fetch origin ${mergeCommitSha}`,
        repoDir,
        undefined,
        120000
      );
      
      if (fetchResult.exitCode !== 0) {
        logger.warn(`Failed to fetch specific commit, trying fetch all:`, { output: fetchResult.result });
        // Fallback to fetching all refs
        const fetchAllResult = await sandbox.process.executeCommand(
          `git fetch origin`,
          repoDir,
          undefined,
          120000
        );
        
        if (fetchAllResult.exitCode !== 0) {
          logger.error(`Failed to fetch from origin:`, { output: fetchAllResult.result });
        }
      }
      
      // Now try to checkout the files from the merge commit
      await checkoutFilesFromCommit({
        sandbox,
        repoDir,
        commitSha: mergeCommitSha,
        filePaths: testFiles,
      });
      logger.info(`Successfully checked out ${testFiles.length} test files from merge commit`);
    }

    // Setup Python environment
    logger.info("Setting up Python environment...");
    const envSetupSuccess = await setupEnv(sandbox, repoDir);
    if (!envSetupSuccess) {
      logger.warn("Failed to setup Python environment, continuing anyway");
    }

    // Install Docker
    logger.info("Installing Docker for test execution...");
    const dockerSuccess = await installDockerForTests(sandbox, repoDir);
    if (!dockerSuccess) {
      logger.warn("Docker installation failed, PostgreSQL setup may fail");
    }

    // Setup PostgreSQL database
    logger.info("Setting up PostgreSQL database for tests...");
    const postgresSuccess = await setupPostgresForTests(sandbox, repoDir);
    if (!postgresSuccess) {
      logger.warn("PostgreSQL setup failed, tests requiring database may fail");
    }

    // Install pytest dependencies
    logger.info("Installing pytest dependencies...");
    const pipInstallResult = await sandbox.process.executeCommand(
      PIP_INSTALL_COMMAND,
      repoDir,
      undefined,
      timeoutSec * 2,
    );

    logger.info(`Pip install completed`, {
      exitCode: pipInstallResult.exitCode,
      output: pipInstallResult.result?.slice(0, 500),
    });

    if (pipInstallResult.exitCode !== 0) {
      logger.error(`Pip install failed`, {
        command: PIP_INSTALL_COMMAND,
        exitCode: pipInstallResult.exitCode,
        output: pipInstallResult.result,
      });
    }

    // Install langgraph
    logger.info("Installing langgraph...");
    const langgraphInstallResult = await sandbox.process.executeCommand(
      LANGGRAPH_INSTALL_COMMAND,
      repoDir,
      undefined,
      timeoutSec * 2,
    );

    logger.info(`Langgraph install completed`, {
      exitCode: langgraphInstallResult.exitCode,
      output: langgraphInstallResult.result?.slice(0, 500),
    });

    if (langgraphInstallResult.exitCode !== 0) {
      logger.error(`Langgraph install failed`, {
        command: LANGGRAPH_INSTALL_COMMAND,
        exitCode: langgraphInstallResult.exitCode,
        output: langgraphInstallResult.result,
      });
    }

    // Install checkpoint
    logger.info("Installing checkpoint...");
    const checkpointInstallResult = await sandbox.process.executeCommand(
      CHECKPOINT_INSTALL_COMMAND,
      repoDir,
      undefined,
      timeoutSec * 2,
    );

    logger.info(`Checkpoint install completed`, {
      exitCode: checkpointInstallResult.exitCode,
      output: checkpointInstallResult.result?.slice(0, 500),
    });

    if (checkpointInstallResult.exitCode !== 0) {
      logger.error(`Checkpoint install failed`, {
        command: CHECKPOINT_INSTALL_COMMAND,
        exitCode: checkpointInstallResult.exitCode,
        output: checkpointInstallResult.result,
      });
    }

    // Build pytest command
    let testArgs = testFiles.join(" ");
    if (testNames && testNames.length > 0) {
      const testNamesPattern = testNames.join(" or ");
      testArgs += ` -k "${testNamesPattern}"`;
    }
    
    const command = `${RUN_PYTHON_IN_VENV} -m pytest ${testArgs} -v --tb=short --json-report --json-report-file=/tmp/pytest_report.json --snapshot-update 2>&1 | tee /tmp/pytest_full_output.txt`;
    logger.info("Running pytest command", { command, testNames });

    // Execute pytest
    const execution = await sandbox.process.executeCommand(
      command,
      repoDir,
      undefined,
      timeoutSec,
    );

    // Save the full pytest output to local file
    try {
      const fullOutputResult = await sandbox.process.executeCommand(
        "cat /tmp/pytest_full_output.txt",
        repoDir,
        undefined,
        30000
      );
      
      if (fullOutputResult.exitCode === 0 && fullOutputResult.result) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFilename = `pytest_output_${timestamp}.txt`;
        const outputFilepath = `langbench/results/${outputFilename}`;
        
        // Write the full output to a local file in the results directory
        const fs = await import('fs');
        fs.writeFileSync(outputFilepath, fullOutputResult.result);
        logger.info(`Full pytest output saved to: ${outputFilepath}`);
      }
    } catch (error) {
      logger.warn("Failed to save full pytest output", { error });
    }

    // Handle case where no tests match the pattern
    if (execution.exitCode === 5 && testNames && testNames.length > 0) {
      logger.warn(`No tests matched the pattern "${testNames.join(' or ')}". Listing available tests...`);
      
      const collectCommand = `${RUN_PYTHON_IN_VENV} -m pytest ${testFiles.join(' ')} --collect-only -q`;
      const collectResult = await sandbox.process.executeCommand(
        collectCommand,
        repoDir,
        undefined,
        30000,
      );
      
      logger.info("Available tests in the file:", {
        collectOutput: collectResult.result?.slice(0, 2000),
        exitCode: collectResult.exitCode,
      });
    }

    // Read and parse the JSON report
    let parsed: Omit<TestResults, "success" | "error">;
    try {
      const jsonReportResult = await readFile({
        sandbox,
        filePath: "/tmp/pytest_report.json",
        workDir: repoDir,
      });

      if (jsonReportResult.success && jsonReportResult.output) {
        const jsonReport = JSON.parse(jsonReportResult.output);
        parsed = parsePytestJsonReport(jsonReport);
        logger.debug("Successfully parsed JSON report", { jsonReport });
      } else {
        // JSON report doesn't exist - show the actual pytest error
        const pytestError = `Pytest failed to create JSON report. Exit code: ${execution.exitCode}. Output: ${execution.result}`;
        throw new Error(pytestError);
      }
    } catch (jsonError) {
      // If we can't parse JSON, show both the JSON error and pytest output
      const fullError = `Failed to parse JSON report. JSON Error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}. Pytest output: ${execution.result}`;
      throw new Error(fullError);
    }

    logger.info("Pytest execution completed", {
      exitCode: execution.exitCode,
      totalTests: parsed.totalTests,
      passedTests: parsed.passedTests,
      failedTests: parsed.failedTests,
      command,
      stdout: execution.result,
    });

    return {
      success: execution.exitCode === 0,
      error: execution.exitCode !== 0 ? `Exit code: ${execution.exitCode}` : null,
      ...parsed,
    };

  } catch (error) {
    logger.error("Failed to run pytest in isolated sandbox", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testDetails: [],
    };
  } finally {
    // Always cleanup the test sandbox
    if (sandbox) {
      try {
        await sandbox.delete();
        logger.info(`Deleted test sandbox: ${sandbox.id}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup test sandbox ${sandbox.id}:`, { cleanupError });
      }
    }
  }
}

/**
 * Parse pytest JSON report to extract test results
 */
export function parsePytestJsonReport(
  jsonReport: PytestJsonReport,
): Omit<TestResults, "success" | "error"> {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const testDetails: string[] = [];

  if (jsonReport && jsonReport.tests) {
    totalTests = jsonReport.tests.length;

    for (const test of jsonReport.tests) {
      const testName = `${test.nodeid}`;
      const outcome = test.outcome;

      if (outcome === "passed") {
        passedTests++;
        testDetails.push(`${testName} PASSED`);
      } else if (outcome === "failed" || outcome === "error") {
        failedTests++;
        testDetails.push(`${testName} ${outcome.toUpperCase()}`);
      }
    }
  }

  // Use summary data if available
  if (jsonReport && jsonReport.summary) {
    const summary = jsonReport.summary;
    if (summary.passed !== undefined) passedTests = summary.passed;
    if (summary.failed !== undefined) failedTests = summary.failed;
    if (summary.error !== undefined) failedTests += summary.error;
    totalTests = passedTests + failedTests;
  }

  logger.debug("Parsed pytest JSON report", {
    totalTests,
    passedTests,
    failedTests,
    detailsCount: testDetails.length,
  });

  return {
    totalTests,
    passedTests,
    failedTests,
    testDetails,
  };
}

/**
 * Install Docker in the test sandbox using official method
 */
async function installDockerForTests(sandbox: Sandbox, repoDir: string): Promise<boolean> {
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
    await sandbox.process.executeCommand(
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

    // Set proper permissions on docker socket
    await sandbox.process.executeCommand(
      "sudo chmod 666 /var/run/docker.sock",
      repoDir,
      undefined,
      10000
    );

    // Wait for Docker daemon to be ready
    logger.info("Waiting for Docker daemon to be ready...");
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
          break;
        } else {
          logger.info(`Docker works with sudo but not without (attempt ${i + 1})`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
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

    // Test if docker-compose is available
    const dockerComposeTestResult = await sandbox.process.executeCommand(
      "docker-compose --version",
      repoDir,
      undefined,
      10000
    );

    logger.info("docker-compose test result:", { 
      exitCode: dockerComposeTestResult.exitCode, 
      output: dockerComposeTestResult.result 
    });

    logger.info("Docker installation completed successfully");
    return true;
  } catch (error) {
    logger.error("Docker installation failed", { error });
    return false;
  }
}

/**
 * Setup PostgreSQL database in the test sandbox
 */
async function setupPostgresForTests(sandbox: Sandbox, repoDir: string): Promise<boolean> {
  try {
    logger.info("Setting up PostgreSQL for tests...");

    const langgraphDir = `${repoDir}/libs/langgraph`;

    // Check if the specific compose file exists
    const composeFileResult = await sandbox.process.executeCommand(
      "ls -la tests/compose-postgres.yml",
      langgraphDir,
      undefined,
      10000
    );
    logger.info("compose-postgres.yml file check:", { 
      exitCode: composeFileResult.exitCode,
      output: composeFileResult.result 
    });

    if (composeFileResult.exitCode !== 0) {
      logger.error("compose-postgres.yml file not found");
      return false;
    }

    // Try to start postgres with step-by-step approach
    logger.info("Trying to start postgres with step-by-step approach...");
    
    // First, try to stop any existing containers
    logger.info("Stopping any existing postgres containers...");
    await sandbox.process.executeCommand(
      "docker-compose -f tests/compose-postgres.yml down -v",
      langgraphDir,
      undefined,
      60000
    );
    
    // Try the simplest possible docker-compose up command
    logger.info("Starting postgres with simple docker-compose up...");
    const simpleUpResult = await sandbox.process.executeCommand(
      "docker-compose -f tests/compose-postgres.yml up -d",
      langgraphDir,
      undefined,
      300000
    );
    
    logger.info("Simple docker-compose up result:", { 
      exitCode: simpleUpResult.exitCode,
      output: simpleUpResult.result 
    });
    
    let postgresStarted = false;
    
    // Check if the simple command worked (not showing help text)
    if (simpleUpResult.exitCode === 0 && (!simpleUpResult.result || !simpleUpResult.result.includes('Usage: up [options]'))) {
      logger.info("Simple docker-compose up succeeded");
      postgresStarted = true;
    } else {
      logger.info("Simple docker-compose failed, trying with docker directly...");
      
      // Clean up any existing postgres containers first
      await sandbox.process.executeCommand(
        "docker rm -f postgres-test",
        langgraphDir,
        undefined,
        30000
      );
      
      // Try using docker run directly as a fallback (without port mapping to avoid networking issues)
      const dockerRunResult = await sandbox.process.executeCommand(
        "docker run -d --name postgres-test -e POSTGRES_DB=postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres postgres:16",
        langgraphDir,
        undefined,
        300000
      );
      
      logger.info("Direct docker run result:", {
        exitCode: dockerRunResult.exitCode,
        output: dockerRunResult.result
      });
      
      if (dockerRunResult.exitCode === 0) {
        logger.info("Direct docker run succeeded");
        postgresStarted = true;
      } else {
        logger.error("All postgres startup methods failed");
        return false;
      }
    }

    if (!postgresStarted) {
      logger.error("Failed to start postgres container");
      return false;
    }

    // Wait for PostgreSQL to be ready
    logger.info("Waiting for PostgreSQL to be ready...");
    let pgReady = false;
    for (let i = 0; i < 30; i++) {
      // Check if container is running
      const readyResult = await sandbox.process.executeCommand(
        "docker ps --filter name=postgres-test --format 'table {{.Names}}\t{{.Status}}'",
        langgraphDir,
        undefined,
        10000
      );

      if (readyResult.exitCode === 0 && readyResult.result?.includes("postgres-test")) {
        // Additional check to see if postgres is accepting connections
        const connectionTest = await sandbox.process.executeCommand(
          "docker exec postgres-test pg_isready -U postgres",
          langgraphDir,
          undefined,
          10000
        );

        if (connectionTest.exitCode === 0) {
          pgReady = true;
          logger.info("PostgreSQL is ready!");
          break;
        }
      }

      logger.info(`Waiting for PostgreSQL... attempt ${i + 1}/30`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!pgReady) {
      logger.error("PostgreSQL failed to become ready");
      // Log container status for debugging
      const debugResult = await sandbox.process.executeCommand(
        "docker ps -a --filter name=postgres-test",
        langgraphDir,
        undefined,
        10000
      );
      logger.error("Final container status:", { output: debugResult.result });
      return false;
    }

    logger.info("PostgreSQL setup completed successfully");
    return true;
  } catch (error) {
    logger.error("PostgreSQL setup failed", { error });
    return false;
  }
}
