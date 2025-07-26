import { createLogger, LogLevel } from "../src/utils/logger.js";

const logger = createLogger(LogLevel.INFO, "DeploymentRevisionTrigger");

interface DeploymentRevisionConfig {
  controlPlaneHost: string;
  langsmithApiKey: string;
  deploymentId: string;
}

interface ApiResponse {
  status: number;
  data?: any;
  error?: string;
}

/**
 * Validates that all required environment variables are present.
 */
function validateEnvironmentVariables(): DeploymentRevisionConfig {
  const controlPlaneHost = process.env.CONTROL_PLANE_HOST;
  const langsmithApiKey = process.env.LANGSMITH_API_KEY;
  const deploymentId = process.env.DEPLOYMENT_ID;

  if (!controlPlaneHost) {
    throw new Error("CONTROL_PLANE_HOST environment variable is required");
  }

  if (!langsmithApiKey) {
    throw new Error("LANGSMITH_API_KEY environment variable is required");
  }

  if (!deploymentId) {
    throw new Error("DEPLOYMENT_ID environment variable is required");
  }

  logger.info("Environment variables validated successfully");

  return {
    controlPlaneHost,
    langsmithApiKey,
    deploymentId,
  };
}

/**
 * Makes a PATCH request to trigger a new deployment revision.
 */
async function triggerDeploymentRevision(
  config: DeploymentRevisionConfig,
): Promise<ApiResponse> {
  const url = `${config.controlPlaneHost}/v2/deployments/${config.deploymentId}`;
  
  const requestBody = {
    source_revision_config: {
      repo_ref: "main",
      langgraph_config_path: "langgraph.json",
    },
  };

  const headers = {
    "X-Api-Key": config.langsmithApiKey,
    "Content-Type": "application/json",
  };

  logger.info("Triggering deployment revision", {
    deploymentId: config.deploymentId,
    url,
  });

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        status: response.status,
        error: `HTTP ${response.status}: ${JSON.stringify(responseData)}`,
      };
    }

    return {
      status: response.status,
      data: responseData,
    };
  } catch (error) {
    return {
      status: 0,
      error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Main function to trigger a new deployment revision.
 */
async function main(): Promise<void> {
  try {
    logger.info("Starting deployment revision trigger process");

    const config = validateEnvironmentVariables();
    const result = await triggerDeploymentRevision(config);

    if (result.error) {
      logger.error("Failed to trigger deployment revision", { error: result.error });
      throw new Error(result.error);
    }

    logger.info("Deployment revision triggered successfully", {
      status: result.status,
      deploymentId: config.deploymentId,
    });
  } catch (error) {
    logger.error("Deployment revision trigger failed", {
      error: error instanceof Error ? error.message : String(error),
