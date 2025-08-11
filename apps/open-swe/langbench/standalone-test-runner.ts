import dotenv from "dotenv";
import { Daytona, Sandbox } from "@daytonaio/sdk";
import { createLogger, LogLevel } from "../src/utils/logger.js";
import { DEFAULT_SANDBOX_CREATE_PARAMS } from "../src/constants.js";
import { readFileSync } from "fs";
import { cloneRepo } from "../src/utils/github/git.js";
import { TargetRepository } from "@open-swe/shared/open-swe/types";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { setupEnv } from "../src/utils/env-setup.js";
import { PRData } from "./types.js";
import { runPytestOnFiles } from "./utils.js";

dotenv.config();

const logger = createLogger(LogLevel.INFO, "Standalone Test Runner");

interface StandaloneTestResult {
  prNumber: number;
  repoName: string;
  success: boolean;
  testFiles: string[];
  testNames?: string[];
  testResults?: any;
  error?: string;
  workspaceId?: string;
  mergeCommitSha: string;
}

/**
 * Load PRs data from langgraph_prs.json
 */
function loadPRsData(): PRData[] {
  const rawPrsData = JSON.parse(
    readFileSync("langbench/static/langgraph_prs.json", "utf8"),
  );

  return rawPrsData.map((pr: any) => ({
    url: pr.url,
    htmlUrl: pr.html_url,
    diffUrl: pr.diff_url,
    patchUrl: pr.patch_url,
    repoOwner: pr.repo_owner,
    repoName: pr.repo_name,
    prNumber: pr.pr_number,
    mergeCommitSha: pr.merge_commit_sha,
    preMergeCommitSha: pr.pre_merge_commit_sha,
    title: pr.title,
    body: pr.body,
    createdAt: pr.created_at,
    mergedAt: pr.merged_at,
    tests: pr.tests || {},
  }));
}

/**
 * Run tests for a single PR at the merge commit without Open SWE
 */
async function runStandaloneTest(prData: PRData, useSpecificTests: boolean = false): Promise<StandaloneTestResult> {
  const result: StandaloneTestResult = {
    prNumber: prData.prNumber,
    repoName: prData.repoName,
    success: false,
    testFiles: Object.keys(prData.tests),
    testNames: Object.values(prData.tests).flat(),
    mergeCommitSha: prData.mergeCommitSha,
  };

  const daytona = new Daytona({
    organizationId: process.env.DAYTONA_ORGANIZATION_ID,
  });
  let sandbox: Sandbox | undefined;

  try {
    logger.info(`Running standalone test for PR #${prData.prNumber}: ${prData.title}`);

    // Create sandbox
    sandbox = await daytona.create(DEFAULT_SANDBOX_CREATE_PARAMS);

    if (!sandbox || !sandbox.id) {
      throw new Error("Failed to create valid sandbox");
    }

    result.workspaceId = sandbox.id;
    logger.info(`Created sandbox: ${sandbox.id}`);

    // Setup target repository at merge commit
    const targetRepository: TargetRepository = {
      owner: prData.repoOwner,
      repo: prData.repoName,
      branch: undefined,
      baseCommit: prData.mergeCommitSha, // Use merge commit instead of pre-merge
    };
    const repoDir = getRepoAbsolutePath(targetRepository);

    // Clone repository at merge commit
    const githubToken = process.env.GITHUB_PAT;
    if (!githubToken) {
      throw new Error("GITHUB_PAT environment variable is required");
    }

    logger.info(`Cloning repository at merge commit: ${prData.mergeCommitSha}`);
    await cloneRepo(sandbox, targetRepository, {
      githubInstallationToken: githubToken,
    });

    // Setup Python environment
    logger.info("Setting up Python environment...");
    const envSetupSuccess = await setupEnv(sandbox, repoDir);
    if (!envSetupSuccess) {
      logger.warn("Failed to setup Python environment, continuing anyway");
    }

    // Run tests if test files are available
    if (result.testFiles.length > 0) {
      const testNamesToUse = useSpecificTests && result.testNames?.length ? result.testNames : undefined;
      const testNamesInfo = testNamesToUse 
        ? ` (specific tests: ${testNamesToUse.join(', ')})`
        : '';
      logger.info(`Running tests on ${result.testFiles.length} test files${testNamesInfo}`);
      
      const testResults = await runPytestOnFiles({
        sandbox,
        testFiles: result.testFiles,
        repoDir,
        timeoutSec: 300,
        testNames: testNamesToUse,
      });
      result.testResults = testResults;

      logger.info(`Test execution completed for PR #${prData.prNumber}`, {
        totalTests: testResults.totalTests,
        passedTests: testResults.passedTests,
        failedTests: testResults.failedTests,
        success: testResults.success,
      });

      result.success = testResults.success;
    } else {
      logger.info(`No test files found for PR #${prData.prNumber}`);
      result.success = true; // Consider success if no tests to run
    }

    logger.info(`Successfully processed PR #${prData.prNumber}`);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to process PR #${prData.prNumber}:`, { error });
  } finally {
    // Cleanup sandbox
    if (sandbox) {
      try {
        await sandbox.delete();
        logger.info(`Deleted sandbox: ${sandbox.id}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup sandbox ${sandbox.id}:`, {
          cleanupError,
        });
      }
    }
  }

  return result;
}


/**
 * Run tests for all PRs
 */
async function runAllTests(useSpecificTests: boolean = false): Promise<void> {
  const prsData = loadPRsData();
  logger.info(`Running standalone tests for ${prsData.length} PRs...`);

  const results: StandaloneTestResult[] = [];
  
  for (const prData of prsData) {
    const result = await runStandaloneTest(prData, useSpecificTests);
    results.push(result);
    
    // Log summary for each PR
    logger.info(`PR #${result.prNumber} completed`, {
      success: result.success,
      testFilesCount: result.testFiles.length,
      testResults: result.testResults ? {
        totalTests: result.testResults.totalTests,
        passedTests: result.testResults.passedTests,
        failedTests: result.testResults.failedTests,
      } : null,
      error: result.error,
    });
  }

  // Print final summary
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log("\n=== FINAL SUMMARY ===");
  console.log(`Total PRs: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log("\nFailed PRs:");
    results.filter(r => !r.success).forEach(r => {
      console.log(`  PR #${r.prNumber}: ${r.error || 'Unknown error'}`);
    });
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // No arguments - run all tests (all tests in test files)
    await runAllTests(false);
  } else if (args.length === 1 && args[0] === '--specific') {
    // Run with --specific flag - only run test_names from JSON
    await runAllTests(true);
  } else {
    console.log("Usage:");
    console.log("  yarn standalone-test             # Run all tests in test files");
    console.log("  yarn standalone-test --specific  # Run only test_names from JSON");
    process.exit(1);
  }
}

// Run main function if this file is executed directly
main().catch(error => {
  logger.error("Unhandled error:", { error });
  process.exit(1);
});

export { runStandaloneTest, loadPRsData };