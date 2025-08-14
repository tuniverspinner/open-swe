"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStandaloneTest = runStandaloneTest;
var dotenv_1 = require("dotenv");
var sdk_1 = require("@daytonaio/sdk");
var logger_js_1 = require("../src/utils/logger.js");
var constants_js_1 = require("../src/constants.js");
var git_js_1 = require("../src/utils/github/git.js");
var git_1 = require("@open-swe/shared/git");
var env_setup_js_1 = require("../src/utils/env-setup.js");
dotenv_1.default.config();
var logger = (0, logger_js_1.createLogger)(logger_js_1.LogLevel.INFO, "Standalone Test Runner");
var RUN_PYTHON_IN_VENV = env_setup_js_1.ENV_CONSTANTS.RUN_PYTHON_IN_VENV, RUN_PIP_IN_VENV = env_setup_js_1.ENV_CONSTANTS.RUN_PIP_IN_VENV;
// Installation commands
var PIP_INSTALL_COMMAND = "".concat(RUN_PIP_IN_VENV, " install pytest pytest-mock pytest-asyncio syrupy pytest-json-report psycopg psycopg_pool");
var LANGGRAPH_INSTALL_COMMAND = "".concat(RUN_PIP_IN_VENV, " install -e ./libs/langgraph");
var CHECKPOINT_INSTALL_COMMAND = "".concat(RUN_PIP_IN_VENV, " install -e ./libs/checkpoint-sqlite -e ./libs/checkpoint-duckdb -e ./libs/checkpoint-postgres");
/**
 * Setup PostgreSQL database in the sandbox
 */
function setupPostgres(sandbox, repoDir) {
    return __awaiter(this, void 0, void 0, function () {
        var updateResult, installResult, startResult, createDbResult, createUserResult, grantResult, envCommands, _i, envCommands_1, envCmd, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 11, , 12]);
                    logger.info("Setting up PostgreSQL...");
                    return [4 /*yield*/, sandbox.process.executeCommand("sudo apt-get update", repoDir, undefined, 120000)];
                case 1:
                    updateResult = _a.sent();
                    return [4 /*yield*/, sandbox.process.executeCommand("sudo apt-get install -y postgresql postgresql-contrib", repoDir, undefined, 300000)];
                case 2:
                    installResult = _a.sent();
                    if (installResult.exitCode !== 0) {
                        logger.error("Failed to install PostgreSQL", { output: installResult.result });
                        return [2 /*return*/, false];
                    }
                    return [4 /*yield*/, sandbox.process.executeCommand("sudo service postgresql start", repoDir, undefined, 60000)];
                case 3:
                    startResult = _a.sent();
                    if (startResult.exitCode !== 0) {
                        logger.error("Failed to start PostgreSQL", { output: startResult.result });
                        return [2 /*return*/, false];
                    }
                    return [4 /*yield*/, sandbox.process.executeCommand("sudo -u postgres psql -c \"CREATE DATABASE langraph_test;\"", repoDir, undefined, 30000)];
                case 4:
                    createDbResult = _a.sent();
                    return [4 /*yield*/, sandbox.process.executeCommand("sudo -u postgres psql -c \"CREATE USER langraph_user WITH PASSWORD 'test_password';\"", repoDir, undefined, 30000)];
                case 5:
                    createUserResult = _a.sent();
                    return [4 /*yield*/, sandbox.process.executeCommand("sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE langraph_test TO langraph_user;\"", repoDir, undefined, 30000)];
                case 6:
                    grantResult = _a.sent();
                    envCommands = [
                        'export POSTGRES_HOST=localhost',
                        'export POSTGRES_PORT=5432',
                        'export POSTGRES_DB=langraph_test',
                        'export POSTGRES_USER=langraph_user',
                        'export POSTGRES_PASSWORD=test_password',
                        'export DATABASE_URL="postgresql://langraph_user:test_password@localhost:5432/langraph_test"'
                    ];
                    _i = 0, envCommands_1 = envCommands;
                    _a.label = 7;
                case 7:
                    if (!(_i < envCommands_1.length)) return [3 /*break*/, 10];
                    envCmd = envCommands_1[_i];
                    return [4 /*yield*/, sandbox.process.executeCommand("echo '".concat(envCmd, "' >> ~/.bashrc"), repoDir, undefined, 10000)];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10:
                    logger.info("PostgreSQL setup completed successfully");
                    return [2 /*return*/, true];
                case 11:
                    error_1 = _a.sent();
                    logger.error("PostgreSQL setup failed", { error: error_1 });
                    return [2 /*return*/, false];
                case 12: return [2 /*return*/];
            }
        });
    });
}
/**
 * Main function to run standalone test
 */
function runStandaloneTest(commitSha, testFile, testName) {
    return __awaiter(this, void 0, void 0, function () {
        var repoOwner, repoName, daytona, sandbox, targetRepository, repoDir, githubToken, commitCheckResult, postgresSuccess, envSetup, pipResult, langgraphResult, checkpointResult, testCommand, testResult, error_2, cleanupError_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    repoOwner = "langchain-ai";
                    repoName = "langgraph";
                    logger.info("Starting standalone test runner");
                    logger.info("Commit: ".concat(commitSha));
                    logger.info("Test file: ".concat(testFile));
                    if (testName) {
                        logger.info("Test name: ".concat(testName));
                    }
                    daytona = new sdk_1.Daytona({
                        organizationId: process.env.DAYTONA_ORGANIZATION_ID,
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 11, 12, 17]);
                    // Create sandbox
                    logger.info("Creating sandbox...");
                    return [4 /*yield*/, daytona.create(constants_js_1.DEFAULT_SANDBOX_CREATE_PARAMS)];
                case 2:
                    sandbox = _b.sent();
                    if (!sandbox || !sandbox.id) {
                        throw new Error("Failed to create sandbox");
                    }
                    logger.info("Sandbox created: ".concat(sandbox.id));
                    targetRepository = {
                        owner: repoOwner,
                        repo: repoName,
                        branch: undefined,
                        baseCommit: commitSha,
                    };
                    repoDir = (0, git_1.getRepoAbsolutePath)(targetRepository);
                    githubToken = process.env.GITHUB_PAT;
                    if (!githubToken) {
                        throw new Error("GITHUB_PAT environment variable is required");
                    }
                    // Clone repository at specific commit
                    logger.info("Cloning repository at commit: ".concat(commitSha));
                    return [4 /*yield*/, (0, git_js_1.cloneRepo)(sandbox, targetRepository, {
                            githubInstallationToken: githubToken,
                        })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, sandbox.process.executeCommand("git rev-parse HEAD", repoDir, undefined, 10000)];
                case 4:
                    commitCheckResult = _b.sent();
                    logger.info("Current commit: ".concat((_a = commitCheckResult.result) === null || _a === void 0 ? void 0 : _a.trim()));
                    // Setup PostgreSQL
                    logger.info("Setting up PostgreSQL database...");
                    return [4 /*yield*/, setupPostgres(sandbox, repoDir)];
                case 5:
                    postgresSuccess = _b.sent();
                    if (!postgresSuccess) {
                        logger.warn("PostgreSQL setup failed, continuing without database");
                    }
                    // Setup Python environment
                    logger.info("Setting up Python environment...");
                    return [4 /*yield*/, (0, env_setup_js_1.setupEnv)(sandbox, repoDir)];
                case 6:
                    envSetup = _b.sent();
                    if (!envSetup) {
                        logger.warn("Python environment setup failed, continuing anyway");
                    }
                    // Install pytest dependencies
                    logger.info("Installing pytest dependencies...");
                    return [4 /*yield*/, sandbox.process.executeCommand(PIP_INSTALL_COMMAND, repoDir, undefined, 600000)];
                case 7:
                    pipResult = _b.sent();
                    if (pipResult.exitCode !== 0) {
                        logger.warn("Pip install had issues", { output: pipResult.result });
                    }
                    // Install langgraph
                    logger.info("Installing langgraph...");
                    return [4 /*yield*/, sandbox.process.executeCommand(LANGGRAPH_INSTALL_COMMAND, repoDir, undefined, 600000)];
                case 8:
                    langgraphResult = _b.sent();
                    if (langgraphResult.exitCode !== 0) {
                        logger.warn("Langgraph install had issues", { output: langgraphResult.result });
                    }
                    // Install checkpoint packages
                    logger.info("Installing checkpoint packages...");
                    return [4 /*yield*/, sandbox.process.executeCommand(CHECKPOINT_INSTALL_COMMAND, repoDir, undefined, 600000)];
                case 9:
                    checkpointResult = _b.sent();
                    if (checkpointResult.exitCode !== 0) {
                        logger.warn("Checkpoint install had issues", { output: checkpointResult.result });
                    }
                    testCommand = "".concat(RUN_PYTHON_IN_VENV, " -m pytest ").concat(testFile, " -v --tb=short");
                    if (testName) {
                        testCommand += " -k \"".concat(testName, "\"");
                    }
                    logger.info("Running test: ".concat(testCommand));
                    return [4 /*yield*/, sandbox.process.executeCommand(testCommand, repoDir, undefined, 1200000 // 20 minutes timeout
                        )];
                case 10:
                    testResult = _b.sent();
                    // Log results
                    console.log("\n" + "=".repeat(50));
                    console.log("TEST RESULTS");
                    console.log("=".repeat(50));
                    console.log("Exit code: ".concat(testResult.exitCode));
                    console.log("Success: ".concat(testResult.exitCode === 0));
                    console.log("\nOutput:");
                    console.log(testResult.result);
                    console.log("=".repeat(50));
                    return [2 /*return*/, {
                            success: testResult.exitCode === 0,
                            output: testResult.result,
                            exitCode: testResult.exitCode,
                            workspaceId: sandbox.id
                        }];
                case 11:
                    error_2 = _b.sent();
                    logger.error("Test execution failed", { error: error_2 });
                    console.error("ERROR:", error_2 instanceof Error ? error_2.message : String(error_2));
                    return [2 /*return*/, {
                            success: false,
                            error: error_2 instanceof Error ? error_2.message : String(error_2),
                            workspaceId: sandbox === null || sandbox === void 0 ? void 0 : sandbox.id
                        }];
                case 12:
                    if (!sandbox) return [3 /*break*/, 16];
                    _b.label = 13;
                case 13:
                    _b.trys.push([13, 15, , 16]);
                    return [4 /*yield*/, sandbox.delete()];
                case 14:
                    _b.sent();
                    logger.info("Sandbox deleted: ".concat(sandbox.id));
                    return [3 /*break*/, 16];
                case 15:
                    cleanupError_1 = _b.sent();
                    logger.warn("Failed to cleanup sandbox", { cleanupError: cleanupError_1 });
                    return [3 /*break*/, 16];
                case 16: return [7 /*endfinally*/];
                case 17: return [2 /*return*/];
            }
        });
    });
}
/**
 * Main entry point
 */
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, commitSha, testFile, testName, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    args = process.argv.slice(2);
                    if (args.length < 2) {
                        console.log("Usage: tsx standalone-test-runner.ts <commit_sha> <test_file> [test_name]");
                        console.log("");
                        console.log("Examples:");
                        console.log("  tsx standalone-test-runner.ts abc123 libs/langgraph/tests/test_large_cases.py");
                        console.log("  tsx standalone-test-runner.ts abc123 libs/langgraph/tests/test_large_cases.py test_state_graph_packets");
                        process.exit(1);
                    }
                    commitSha = args[0];
                    testFile = args[1];
                    testName = args[2] || undefined;
                    return [4 /*yield*/, runStandaloneTest(commitSha, testFile, testName)];
                case 1:
                    result = _a.sent();
                    process.exit(result.success ? 0 : 1);
                    return [2 /*return*/];
            }
        });
    });
}
// Run main function if this file is executed directly
if (import.meta.url === "file://".concat(process.argv[1])) {
    main().catch(function (error) {
        logger.error("Unhandled error:", { error: error });
        process.exit(1);
    });
}
