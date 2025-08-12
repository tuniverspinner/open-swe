import { createLogger, LogLevel } from "../src/utils/logger.js";
import { ENV_CONSTANTS, setupEnv } from "../src/utils/env-setup.js";
import { TestResults, PytestJsonReport, RunPytestOptions } from "./types.js";
import { readFile } from "../src/utils/read-write.js";
import { Daytona, Sandbox } from "@daytonaio/sdk";
import { DEFAULT_SANDBOX_CREATE_PARAMS } from "../src/constants.js";
import { cloneRepo } from "../src/utils/github/git.js";
import { getRepoAbsolutePath } from "@open-swe/shared/git";

const logger = createLogger(LogLevel.DEBUG, "Langbench Utils");

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
const PIP_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install pytest pytest-mock pytest-asyncio syrupy pytest-json-report psycopg psycopg_pool`;
const LANGGRAPH_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install -e ./libs/langgraph`;
const CHECKPOINT_INSTALL_COMMAND = `${RUN_PIP_IN_VENV} install -e ./libs/checkpoint-sqlite -e ./libs/checkpoint-duckdb -e ./libs/checkpoint-postgres`;
/**
 * Run pytest on specific test files in a fresh sandbox with the specified branch
 */
export async function runPytestOnFiles(
  options: RunPytestOptions,
): Promise<TestResults> {
  const { targetRepository, branchName, testFiles, timeoutSec = 300, testNames } = options;
  
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

    // Setup Python environment
    logger.info("Setting up Python environment...");
    const envSetupSuccess = await setupEnv(sandbox, repoDir);
    if (!envSetupSuccess) {
      logger.warn("Failed to setup Python environment, continuing anyway");
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
    
    const command = `${RUN_PYTHON_IN_VENV} -m pytest ${testArgs} -v --tb=short --json-report --json-report-file=/tmp/pytest_report.json`;
    logger.info("Running pytest command", { command, testNames });

    // Execute pytest
    const execution = await sandbox.process.executeCommand(
      command,
      repoDir,
      undefined,
      timeoutSec,
    );

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
